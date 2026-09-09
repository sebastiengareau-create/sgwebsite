"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";

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
      <BandeauSection icone="🧑‍🤝‍🧑" titre="Clients" sousTitre="Touche un client pour voir sa fiche complète — coordonnées, bons de commande, soumissions." />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          className="bouton-3d"
          style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouveau client"}
        </button>
      </div>
      <Link
        href="/gerant/comptabilite/rapports/comptes-clients"
        target="_blank"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
      >
        💰 Rapport de comptes à recevoir
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {clientsFiltres.map((c) => (
          <Link key={c.id} href={`/secretaire/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="bouton-3d-sombre" style={{ borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(180deg, var(--accent-clair), var(--accent))",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#17150f",
              }}>
                {c.nom.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {c.nom}
                  {c.numero && <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>#{c.numero}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[c.telephone, c.adresse, [c.ville, c.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                {c.garantieProlongee && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent)" }}>🛡️ Garantie</span>}
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{c.bons.length} bon{c.bons.length !== 1 ? "s" : ""}</span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 16 }}>›</span>
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
  const [garantieProlongee, setGarantieProlongee] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse, ville, codePostal, garantieProlongee }),
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
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 4 }}>
      <input required placeholder="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
      <input placeholder="Courriel" type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
      <input placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)} style={{ ...champStyle, flex: 1 }} />
        <input placeholder="Code postal" value={codePostal} onChange={(e) => setCodePostal(e.target.value.toUpperCase())} maxLength={7} style={{ ...champStyle, width: 110 }} />
      </div>
      <input
        placeholder="Garantie prolongée — numéro de contrat (optionnel)"
        value={garantieProlongee}
        onChange={(e) => setGarantieProlongee(e.target.value)}
        style={champStyle}
      />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 8, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Création…" : "Créer le client"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
