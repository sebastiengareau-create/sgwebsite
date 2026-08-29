"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginForm({ nomEntreprise }) {
  const router = useRouter();
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

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
    const { role } = await res.json();
    router.push(role === "DEVELOPPEUR" ? "/gerant" : `/${role.toLowerCase()}`);
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={seConnecter} style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Image src="/logo.png" alt={nomEntreprise} width={90} height={90} priority style={{ objectFit: "contain" }} />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4, textAlign: "center" }}>{nomEntreprise}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24, textAlign: "center" }}>Connecte-toi pour continuer</p>

        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Courriel</label>
        <input
          type="email"
          required
          value={courriel}
          onChange={(e) => setCourriel(e.target.value)}
          style={champStyle}
          placeholder="toi@vrpremium.com"
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
      </form>
    </div>
  );
}

const champStyle = {
  width: "100%", marginTop: 4, marginBottom: 14, padding: "10px 12px",
  borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)",
  color: "var(--text)", fontSize: 14,
};
