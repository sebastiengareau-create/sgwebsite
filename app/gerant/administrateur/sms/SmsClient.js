"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function Champ({ label, aide, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      {children}
      {aide && <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{aide}</span>}
    </label>
  );
}

export default function SmsClient({ init }) {
  const router = useRouter();
  const [accountSid, setAccountSid] = useState(init.accountSid);
  const [authToken, setAuthToken] = useState("");
  const [numero, setNumero] = useState(init.numero);
  const [adressePublique, setAdressePublique] = useState(init.adressePublique);
  const [telephoneTest, setTelephoneTest] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  // Adresse publique proposée : celle où la page est ouverte en ce moment
  useEffect(() => {
    if (!init.adressePublique && !window.location.hostname.match(/^(localhost|127\.)/)) setAdressePublique(window.location.origin);
  }, [init.adressePublique]);

  async function appeler(methode, corps, succes) {
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/administrateur/sms", {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: data.message || data.erreur || `Erreur (code ${res.status}).` });
      return false;
    }
    setMessage({ type: "succes", texte: data.message || succes });
    return true;
  }

  async function sauvegarder(e) {
    e.preventDefault();
    if (await appeler("PATCH", { accountSid, authToken, numero, adressePublique }, "Configuration sauvegardée ✓")) {
      setAuthToken("");
      router.refresh();
    }
  }

  const configure = accountSid && numero && (init.jetonEnregistre || authToken);

  return (
    <div className="conteneur-page">
      <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>📱 SMS (Twilio)</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Sert à avertir les employés par texto quand un bon leur est envoyé (Jobs en déplacement). Les identifiants se trouvent dans la console Twilio, section « Account Info ».
      </p>

      <form onSubmit={sauvegarder} className="carte" style={{ marginBottom: 16 }}>
        <Champ label="Account SID" aide="Commence par « AC », 34 caractères.">
          <input className="champ" value={accountSid} onChange={(e) => setAccountSid(e.target.value)} placeholder="AC0123456789abcdef…" autoComplete="off" style={{ marginTop: 4 }} />
        </Champ>
        <Champ
          label="Auth Token"
          aide={init.jetonEnregistre ? "✓ Un jeton est déjà enregistré — laisse vide pour le garder." : "Clique « Show » à côté de l'Auth Token dans la console Twilio."}
        >
          <input
            className="champ"
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder={init.jetonEnregistre ? "••••••••••••••••" : ""}
            autoComplete="new-password"
            style={{ marginTop: 4 }}
          />
        </Champ>
        <Champ label="Numéro Twilio qui envoie" aide="Le numéro acheté dans Twilio (Phone Numbers), ex. +15145550123.">
          <input className="champ" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="+15145550123" style={{ marginTop: 4 }} />
        </Champ>
        <Champ label="Adresse publique de l'app" aide="Utilisée pour le lien « Voir » dans le SMS, ex. https://garage.mondomaine.com">
          <input className="champ" value={adressePublique} onChange={(e) => setAdressePublique(e.target.value)} placeholder="https://…" style={{ marginTop: 4 }} />
        </Champ>
        <button type="submit" className="bouton-3d" disabled={enCours} style={{ padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
          {enCours ? "…" : "Sauvegarder"}
        </button>
      </form>

      <div className="carte">
        <div className="titre-section">Tester</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
          Sauvegarde d'abord, puis envoie un SMS test à ton cellulaire.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="champ" value={telephoneTest} onChange={(e) => setTelephoneTest(e.target.value)} placeholder="514 555-0123" inputMode="tel" />
          <button
            className="bouton-3d-sombre"
            disabled={enCours || !configure || !telephoneTest.trim()}
            onClick={() => appeler("POST", { telephone: telephoneTest })}
            style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            Envoyer un test
          </button>
        </div>
      </div>

      {message && (
        <p style={{ marginTop: 12, fontSize: 13, color: message.type === "erreur" ? "var(--danger)" : "#6FA96B" }}>{message.texte}</p>
      )}
    </div>
  );
}
