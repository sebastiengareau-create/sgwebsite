"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function InfosEntrepriseClient({ infosInit }) {
  const router = useRouter();
  const [nomEntreprise, setNomEntreprise] = useState(infosInit.nomEntreprise);
  const [adresseLigne1, setAdresseLigne1] = useState(infosInit.adresseLigne1);
  const [adresseLigne2, setAdresseLigne2] = useState(infosInit.adresseLigne2);
  const [telephone, setTelephone] = useState(infosInit.telephone);
  const [courriel, setCourriel] = useState(infosInit.courriel);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function sauvegarder(e) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/administrateur/entreprise", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomEntreprise, adresseLigne1, adresseLigne2, telephone, courriel }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "erreur", texte: data.erreur || "Erreur." });
      return;
    }
    setMessage({ type: "succes", texte: "Informations sauvegardées ✓" });
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>🏢 Informations de l'entreprise</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Ces informations apparaissent partout dans le logiciel — factures, courriels, documents imprimés. Change-les
        ici pour adapter l'installation à un nouveau garage, sans toucher au code.
      </p>

      <form onSubmit={sauvegarder} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <label style={labelStyle}>Nom de l'entreprise</label>
        <input required value={nomEntreprise} onChange={(e) => setNomEntreprise(e.target.value)} style={champStyle} />

        <label style={labelStyle}>Adresse — ligne 1</label>
        <input value={adresseLigne1} onChange={(e) => setAdresseLigne1(e.target.value)} placeholder="Ex : 880 Rang Ste Philomène" style={champStyle} />

        <label style={labelStyle}>Adresse — ligne 2</label>
        <input value={adresseLigne2} onChange={(e) => setAdresseLigne2(e.target.value)} placeholder="Ex : Sainte-Geneviève-de-Berthier, QC J0K 0E8" style={champStyle} />

        <label style={labelStyle}>Téléphone</label>
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex : 438-526-8936" style={champStyle} />

        <label style={labelStyle}>Courriel (optionnel — affiché sur certains documents)</label>
        <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="Ex : info@garage.com" style={{ ...champStyle, marginBottom: 12 }} />

        {message && (
          <p style={{ fontSize: 12, marginBottom: 10, color: message.type === "succes" ? "var(--success)" : "var(--danger)" }}>{message.texte}</p>
        )}

        <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 11, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
          {enCours ? "Enregistrement…" : "Sauvegarder"}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 8 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
