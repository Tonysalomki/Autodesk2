(() => {
  const config = window.SALOMAKI_SUPABASE_CONFIG || {};
  const keys = {
    tasks: "autodesk_tasks_v2",
    leads: "autodesk_leads_v2",
    personal: "salomaki_personal_v1",
    complaints: "salomaki_complaints_v1"
  };
  const validConfig = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || "") &&
    typeof config.publishableKey === "string" && config.publishableKey.length > 20;
  const isAppHost = location.hostname === "app.salomaki.fi";
  const requiresAuth = isAppHost || validConfig;
  const main = document.getElementById("appMain");
  const gate = document.getElementById("authGate");
  const form = document.getElementById("authForm");
  const message = document.getElementById("authMessage");
  const email = document.getElementById("authEmail");
  const password = document.getElementById("authPassword");
  const reset = document.getElementById("authReset");
  const signOut = document.getElementById("signOut");
  const sessionLabel = document.getElementById("sessionLabel");
  const cloudSession = document.getElementById("cloudSession");
  let client = null, currentUser = null, suppress = false, channel = null;
  const timers = new Map();

  if (!requiresAuth) {
    gate.hidden = true;
    document.documentElement.classList.remove("auth-required");
    return;
  }
  document.documentElement.classList.add("auth-required");
  gate.hidden = false;

  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
    const status = document.getElementById("cloudStatus");
    if (status) {
      status.textContent = error ? "Tallennusvirhe" :
        /tallennettu|synkronoitu|päivitettiin/i.test(text) ? "Synkronoitu" : "Synkronoidaan…";
      status.classList.toggle("error", error);
      status.title = error ? text : "Tiedot tallentuvat pilveen";
    }
  }
  function showGate() {
    document.documentElement.classList.add("auth-required");
    gate.hidden = false;
    cloudSession.hidden = true;
  }
  function showApp() {
    document.documentElement.classList.remove("auth-required");
    gate.hidden = true;
    cloudSession.hidden = false;
    sessionLabel.textContent = currentUser?.email || "Kirjautunut";
  }
  function friendlyError(error) {
    const msg = error?.message || "Yhteys ei onnistunut.";
    if (/invalid login credentials/i.test(msg)) return "Sähköposti tai salasana ei täsmää.";
    if (/failed to fetch|network/i.test(msg)) return "Palveluun ei saada yhteyttä. Tarkista verkko ja Supabase-asetukset.";
    return msg;
  }
  function setLocal(key, value) {
    suppress = true;
    try { localStorage.setItem(key, JSON.stringify(value)); }
    finally { suppress = false; }
  }
  function refreshViews() {
    if (typeof render === "function") render();
    if (typeof renderPersonal === "function") renderPersonal();
    if (typeof renderComplaints === "function") renderComplaints();
  }
  function hydrateGlobals() {
    try { if (typeof TKEY !== "undefined") tasks = JSON.parse(localStorage.getItem(TKEY) || "[]"); } catch {}
    try { if (typeof LKEY !== "undefined") leads = JSON.parse(localStorage.getItem(LKEY) || "[]"); } catch {}
    try { personalData = typeof loadPersonal === "function" ? loadPersonal() : personalData; } catch {}
    try {
      const saved = JSON.parse(localStorage.getItem(keys.complaints) || "[]");
      complaintItems = Array.isArray(saved) ? saved : [];
    } catch { complaintItems = []; }
    refreshViews();
  }
  async function writeDocument(key, value) {
    if (!client || !currentUser) return;
    const { error } = await client.from("user_documents").upsert({
      user_id: currentUser.id,
      document_key: key,
      payload: value,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,document_key" });
    if (error) throw error;
  }
  function queueWrite(key, raw) {
    if (!currentUser || suppress || !Object.values(keys).includes(key)) return;
    const documentKey = Object.keys(keys).find(name => keys[name] === key);
    clearTimeout(timers.get(documentKey));
    timers.set(documentKey, setTimeout(async () => {
      try {
        await writeDocument(documentKey, JSON.parse(raw));
        showMessage("Muutokset tallennettu verkkoon.");
      } catch (error) {
        showMessage("Pilvitallennus epäonnistui: " + friendlyError(error), true);
      }
    }, 450));
  }
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    const result = originalSetItem.call(this, key, value);
    if (this === localStorage) queueWrite(key, String(value));
    return result;
  };
  async function syncOnLogin() {
    showMessage("Ladataan tietoja…");
    const { data, error } = await client.from("user_documents")
      .select("document_key,payload").eq("user_id", currentUser.id);
    if (error) throw error;
    const remote = new Map((data || []).map(row => [row.document_key, row.payload]));
    for (const [documentKey, localKey] of Object.entries(keys)) {
      if (remote.has(documentKey)) {
        setLocal(localKey, remote.get(documentKey));
      } else {
        const local = localStorage.getItem(localKey);
        if (local !== null) {
          let payload;
          try { payload = JSON.parse(local); } catch { continue; }
          await writeDocument(documentKey, payload);
        }
      }
    }
    hydrateGlobals();
    showMessage("Tiedot synkronoitu.");
  }
  function startRealtime() {
    if (channel) client.removeChannel(channel);
    channel = client.channel("salomaki-user-documents")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "user_documents",
        filter: "user_id=eq." + currentUser.id
      }, event => {
        const row = event.new;
        if (!row?.document_key || !keys[row.document_key]) return;
        const raw = JSON.stringify(row.payload);
        if (localStorage.getItem(keys[row.document_key]) === raw) return;
        setLocal(keys[row.document_key], row.payload);
        hydrateGlobals();
        showMessage("Toisella laitteella tehdyt muutokset päivitettiin.");
      }).subscribe();
  }
  async function onSession(session) {
    currentUser = session?.user || null;
    if (!currentUser) {
      showGate();
      return;
    }
    try {
      await syncOnLogin();
      showApp();
      startRealtime();
    } catch (error) {
      currentUser = null;
      showGate();
      showMessage("Tietojen lataus epäonnistui: " + friendlyError(error), true);
    }
  }
  if (!validConfig || !window.supabase?.createClient) {
    showMessage(validConfig ? "Kirjautumiskirjastoa ei saatu ladattua." : "Kirjautuminen otetaan käyttöön, kun Supabase-asetukset on lisätty.", true);
    return;
  }
  client = window.supabase.createClient(config.url, config.publishableKey);
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) setTimeout(() => onSession(session), 0);
    else onSession(null);
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) showMessage(friendlyError(error), true);
    else if (data.session) onSession(data.session);
    else showMessage("Kirjaudu sisään jatkaaksesi.");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) return;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage("Kirjaudutaan…");
    const { error } = await client.auth.signInWithPassword({
      email: email.value.trim(), password: password.value
    });
    button.disabled = false;
    if (error) showMessage(friendlyError(error), true);
    password.value = "";
  });
  reset.addEventListener("click", async () => {
    if (!client || !email.value.trim()) {
      showMessage("Kirjoita sähköpostiosoitteesi ensin.", true);
      email.focus();
      return;
    }
    const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: location.origin + location.pathname
    });
    showMessage(error ? friendlyError(error) : "Salasanan palautuslinkki lähetettiin sähköpostiin.", !!error);
  });
  signOut.addEventListener("click", async () => {
    if (!client) return;
    await client.auth.signOut();
    showMessage("Kirjaudu sisään jatkaaksesi.");
  });
})();
