"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LogoClient from "../components/LogoClient";
import { SignatureKontrolshop } from "../components/LogoKontrolshop";

export default function LoginForm({ nomEntreprise }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deconnecteInactivite = searchParams.get("deconnecte") === "inactivite";
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  // Double vérification : null, ou { courriel } quand un code a été envoyé
  const [etapeCode, setEtapeCode] = useState(null);
  const [code, setCode] = useState("");
  const [memoriser, setMemoriser] = useState(true);

  function entrer(role) {
    router.push(role === "DEVELOPPEUR" || role === "NIVEAU4" ? "/gerant" : `/${role.toLowerCase()}`);
    router.refresh();
  }

  async function seConnecter(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courriel, motDePasse }),
    });
    setChargement(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Courriel ou mot de passe incorrect.");
      return;
    }
    const data = await res.json();
    if (data.etape === "code") {
      setCode("");
      setEtapeCode({ courriel: data.courriel });
      return;
    }
    entrer(data.role);
  }

  async function validerCode(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const res = await fetch("/api/auth/login/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, memoriser }),
    });
    setChargement(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErreur(data.erreur || "Code incorrect.");
      setCode("");
      if (data.expire) setEtapeCode(null); // retour au mot de passe
      return;
    }
    entrer(data.role);
  }

  if (etapeCode) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <form onSubmit={validerCode} style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <LogoClient alt={nomEntreprise} width={220} height={147} priority />
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 4, textAlign: "center" }}>Vérification</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20, textAlign: "center" }}>
            Un code à 6 chiffres vient d&apos;être envoyé à {etapeCode.courriel}. Il est valide 10 minutes.
          </p>

          <label htmlFor="code-connexion" style={{ fontSize: 12, color: "var(--text-muted)" }}>Code reçu par courriel</label>
          <input
            id="code-connexion" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={7}
            value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            style={{ ...champStyle, fontSize: 22, letterSpacing: 6, textAlign: "center" }}
            placeholder="000000"
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={memoriser} onChange={(e) => setMemoriser(e.target.checked)} style={{ width: 18, height: 18 }} />
            Ne plus demander sur cet appareil pendant 30 jours
          </label>

          {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{erreur}</p>}

          <button
            type="submit" disabled={chargement}
            style={{ width: "100%", marginTop: 20, padding: "12px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {chargement ? "Vérification…" : "Valider"}
          </button>
          <button
            type="button" onClick={() => { setEtapeCode(null); setErreur(""); }}
            style={{ width: "100%", marginTop: 10, padding: 10, background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}
          >
            Recommencer la connexion
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={seConnecter} style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <LogoClient alt={nomEntreprise} width={220} height={147} priority />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4, textAlign: "center" }}>{nomEntreprise}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24, textAlign: "center" }}>Connecte-toi pour continuer</p>

        {deconnecteInactivite && (
          <p style={{ color: "var(--accent)", fontSize: 12.5, marginBottom: 16, textAlign: "center" }}>
            Déconnecté après une période d'inactivité.
          </p>
        )}

        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Courriel</label>
        <input
          type="email"
          required
          value={courriel}
          onChange={(e) => setCourriel(e.target.value)}
          style={champStyle}
          placeholder="toi@tondomaine.com"
        />

        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Mot de passe</label>
        <input
          type="password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          style={champStyle}
        />

        {erreur && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 4 }}>{erreur}</p>}

        <button
          type="submit"
          disabled={chargement}
          style={{
            width: "100%", marginTop: 20, padding: "12px", borderRadius: 8, border: "none",
            background: "var(--accent)", color: "#17150f", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}
        >
          {chargement ? "Connexion…" : "Se connecter"}
        </button>

        {/* Marque du logiciel — discrète, sous le logo du client */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <SignatureKontrolshop />
        </div>
      </form>
    </div>
  );
}

const champStyle = {
  width: "100%", marginTop: 4, marginBottom: 14, padding: "10px 12px",
  borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)",
  color: "var(--text)", fontSize: 14,
};
