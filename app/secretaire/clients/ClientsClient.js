"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ClientsClient({ clients }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  const clientsFiltres = clients.filter((c) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    const champs = [c.nom, c.telephone, c.courriel, c.adresse, c.ville, c.codePostal];
    return champs.some((champ) => champ && champ.toLowerCase().includes(q));
  });

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Clients</h1>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          style={{ background: "var(--accent)", color: "#17150f", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouveau client"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 4 }}>
        {clients.length} client{clients.length !== 1 ? "s" : ""} au total. Touche un client pour voir ses détails.
      </p>
      <Link href="/gerant/comptabilite/rapports/comptes-clients" target="_blank" style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", marginBottom: 12 }}>
        📋 Comptes clients (âgé) →
      </Link>

      {afficherFormulaire && (
        <FormulaireCreation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />
      )}

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par nom, ville, téléphone, courriel…"
        style={{
          width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, marginTop: 12, marginBottom: 16, boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clientsFiltres.map((c) => (
          <Link key={c.id} href={`/secretaire/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 600 }}>{c.nom}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {[c.telephone, c.adresse, [c.ville, c.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Aucune coordonnée"}
              </div>
              {c.garantieProlongee && (
                <div style={{ fontSize: 11, marginTop: 6, padding: "3px 8px", background: "var(--bg)", borderRadius: 6, display: "inline-block" }}>
                  🛡️ Garantie prolongée — #{c.garantieProlongee}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                {c.bons.length} bon{c.bons.length !== 1 ? "s" : ""} de commande
              </div>
            </div>
          </Link>
        ))}
        {clientsFiltres.length === 0 && clients.length > 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun client ne correspond à "{recherche}".</p>
        )}
        {clients.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Aucun client encore — ajoute-en un avec "+ Nouveau client", ou démarre un{" "}
            <Link href="/secretaire/nouveau" style={{ color: "var(--accent)" }}>nouveau bon de travail</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

function FormulaireCreation({ onCree }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, codePostal }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 12 }}>
      <input required placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
      <input placeholder="Courriel" type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
      <input placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)} style={{ ...champStyle, flex: 1 }} />
        <input placeholder="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value.toUpperCase())} maxLength={7} style={{ ...champStyle, width: 110 }} />
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}>
        {enCours ? "Création…" : "Créer le client"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
