"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { STATUTS_COMMANDE } from "@/lib/commandesFournisseurs";

const FILTRES = [
  { code: "encours", label: "En cours", statuts: ["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE"] },
  { code: "recues", label: "Reçues", statuts: ["RECUE"] },
  { code: "annulees", label: "Annulées", statuts: ["ANNULEE"] },
  { code: "toutes", label: "Toutes", statuts: null },
];

const dateFr = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

export default function CommandesClient({ commandes, fournisseurs, suggestions, fournisseurInitial }) {
  const router = useRouter();
  const [fournisseurId, setFournisseurId] = useState(fournisseurInitial || "");
  const [filtre, setFiltre] = useState("encours");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const statutsFiltre = FILTRES.find((f) => f.code === filtre).statuts;
  const affichees = commandes.filter((c) => !statutsFiltre || statutsFiltre.includes(c.statut));

  async function creer(fournisseur, lignes = []) {
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/commandes-fournisseurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fournisseurId: fournisseur, lignes, ajouterAuBrouillon: lignes.length > 0 }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Erreur.");
    router.push(`/secretaire/inventaire/commandes/${data.id}`);
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>
      <div style={{ marginTop: 10 }}>
        <BandeauSection icone="🛒" titre="Commandes de pièces" sousTitre="Commande des pièces, puis reçois la marchandise : chaque réception entre le stock au prix de la facture et crée la dépense à payer." />
      </div>

      <div className="carte carte-m" style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Nouvelle commande chez</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} style={{ ...champStyle, marginBottom: 0, flex: 1 }}>
            <option value="">Choisir un fournisseur…</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <button onClick={() => creer(fournisseurId)} disabled={!fournisseurId || enCours} className="bouton-3d" style={{ padding: "0 14px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            + Créer
          </button>
        </div>
        {fournisseurs.length === 0 && (
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0 0" }}>Aucun fournisseur actif — ajoute-en dans la section Fournisseurs.</p>
        )}
        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>{erreur}</p>}
      </div>

      {suggestions.length > 0 && (
        <Reapprovisionnement suggestions={suggestions} fournisseurs={fournisseurs} enCours={enCours} onCommander={creer} />
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
        {FILTRES.map((f) => (
          <button
            key={f.code}
            onClick={() => setFiltre(f.code)}
            style={{ flex: 1, fontSize: 11.5, fontWeight: 700, padding: "7px 6px", borderRadius: 7, border: "none", cursor: "pointer", background: filtre === f.code ? "var(--accent)" : "none", color: filtre === f.code ? "#17150f" : "var(--text-muted)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((c) => {
          const statut = STATUTS_COMMANDE[c.statut] || { label: c.statut, couleur: "var(--text)" };
          const total = c.lignes.reduce((s, l) => s + l.qteCommandee * l.coutUnitaire, 0);
          return (
            <Link key={c.id} href={`/secretaire/inventaire/commandes/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.numero} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>— {c.fournisseur.nom}</span></div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {dateFr(c.dateEnvoi || c.creeLe)} · {c.lignes.length} ligne{c.lignes.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: statut.couleur }}>{statut.label}</div>
                  <div style={{ fontSize: 12 }}>{total.toFixed(2)} $</div>
                </div>
              </div>
            </Link>
          );
        })}
        {affichees.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune commande dans cette liste.</p>}
      </div>
    </div>
  );
}

// Pièces sous le seuil minimum, regroupées par fournisseur proposé : une
// commande par fournisseur en un clic (le fournisseur reste modifiable
// pièce par pièce).
function Reapprovisionnement({ suggestions, fournisseurs, enCours, onCommander }) {
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState(() => Object.fromEntries(suggestions.map((s) => [s.pieceId, { fournisseurId: s.fournisseurId || "", qte: String(s.qte), coche: true }])));

  const maj = (pieceId, champ, valeur) => setChoix((c) => ({ ...c, [pieceId]: { ...c[pieceId], [champ]: valeur } }));
  const parFournisseur = {};
  for (const s of suggestions) {
    const c = choix[s.pieceId];
    if (!c.coche || !c.fournisseurId || !(parseInt(c.qte) > 0)) continue;
    (parFournisseur[c.fournisseurId] ||= []).push({ pieceId: s.pieceId, qte: parseInt(c.qte) });
  }
  const nomFournisseur = (id) => fournisseurs.find((f) => f.id === id)?.nom || "?";

  return (
    <div className="carte carte-m" style={{ marginBottom: 12, border: "1px solid #C9A227" }}>
      <button onClick={() => setOuvert((v) => !v)} style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 0, fontSize: 13, fontWeight: 700 }}>
        <span>⚠️ {suggestions.length} pièce{suggestions.length > 1 ? "s" : ""} à réapprovisionner</span>
        <span style={{ color: "var(--text-muted)" }}>{ouvert ? "▴" : "▾"}</span>
      </button>
      {ouvert && (
        <>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 10px" }}>
            Stock (plus ce qui est déjà commandé, brouillons compris) au seuil minimum ou sous. Quantité proposée : jusqu'au seuil maximum. Les pièces s'ajoutent au brouillon déjà ouvert chez le fournisseur, s'il y en a un.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s) => {
              const c = choix[s.pieceId];
              return (
                <div key={s.pieceId} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8, opacity: c.coche ? 1 : 0.5 }}>
                  <input type="checkbox" checked={c.coche} onChange={(e) => maj(s.pieceId, "coche", e.target.checked)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.nom}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      {s.numero} · stock {s.stock} / min {s.qteMin}{s.enCommande > 0 ? ` · ${s.enCommande} déjà commandée${s.enCommande > 1 ? "s" : ""}` : ""}
                    </div>
                    <select value={c.fournisseurId} onChange={(e) => maj(s.pieceId, "fournisseurId", e.target.value)} style={{ ...champStyle, marginBottom: 0, marginTop: 4, padding: "5px 8px", fontSize: 12 }}>
                      <option value="">Choisir le fournisseur…</option>
                      {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                    </select>
                  </div>
                  <input type="number" min={1} value={c.qte} onChange={(e) => maj(s.pieceId, "qte", e.target.value)} style={{ ...champStyle, width: 60, marginBottom: 0, textAlign: "center" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {Object.entries(parFournisseur).map(([id, lignes]) => (
              <button key={id} onClick={() => onCommander(id, lignes)} disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
                🛒 Commander {lignes.length} pièce{lignes.length > 1 ? "s" : ""} chez {nomFournisseur(id)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
