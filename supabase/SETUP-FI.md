# Salomäki-paneelin kirjautumisen käyttöönotto

Kirjautuminen ja pilvitallennus käyttävät Supabasea. Tietokanta rajaa jokaisen rivin vain sen omistavalle käyttäjälle.

## 1. Luo Supabase-projekti

Avaa [supabase.com](https://supabase.com), kirjaudu sisään ja luo uusi projekti. Tallenna projektin tietokannan salasana itsellesi turvalliseen paikkaan.

## 2. Luo tietotaulu

Avaa projektissa **SQL Editor** → **New query**. Kopioi GitHub-varaston tiedoston supabase/schema.sql koko sisältö ja paina **Run**.

Tämä luo käyttäjäkohtaisen taulun ja käyttöoikeudet. Älä poista taulun RLS-käytäntöjä käytöstä.

## 3. Luo oma käyttäjätunnus

Avaa **Authentication** → **Users** → **Add user** ja luo oma käyttäjä sähköpostiosoitteellasi. Käytä vahvaa salasanaa. Sovelluksessa ei ole julkista rekisteröitymistä.

## 4. Lähetä sovelluksen kytkentätiedot

Avaa **Project Settings** → **API Keys**. Tarvitaan:

- **Project URL**
- **Publishable key** (avaimen nimi voi alkaa sb_publishable_)

Lähetä nämä kaksi arvoa Codexille, niin kytken ne sovelluksen asetustiedostoon. Ne ovat selaimessa näkyviä julkisia arvoja. **Älä lähetä service_role-avainta, secret keytä tai tietokannan salasanaa.**

Kun Supabase on kytketty ja taulu luotu, voimme testata kirjautumisen Netlifyn preview-versiossa. Ensimmäisellä kirjautumisella tällä selaimella olevat tehtävät, liidit, Personal-tiedot ja reklamaatiot siirtyvät tilillesi. Sen jälkeen muutokset tallentuvat verkkoon ja päivittyvät muilla kirjautuneilla laitteilla.

## Huomio salasanan palautuksesta

Sovelluksen “Unohditko salasanan?” -linkin toimimiseksi lisää Supabasen **Authentication → URL Configuration → Redirect URLs** -listaan käytettävän sivuston URL. Preview-osoite ja lopullinen app.salomaki.fi voidaan lisätä erikseen.
