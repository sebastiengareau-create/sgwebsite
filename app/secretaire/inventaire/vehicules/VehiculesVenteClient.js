"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import ChampsVehicule, { VEHICULE_VIDE } from "../../../components/ChampsVehicule";
import { libelleVehicule } from "@/lib/vehicules";
import { useOrdreFiches } from "../../../components/NavigationFiches";

const FILTRES = [
  { code: "EN_STOCK", label: "En stock" },
  { code: "VENDU", label: "Vendus" },
  { code: "TOUS", label: "Tous" },
];

const argent = (n) => `${(n || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export default function VehiculesVenteClient({ vehicules, alignement = null }) {
  const router = useRouter();
  const [filtre, setFiltre] = useState("EN_STOCK");
  const [recherche, setRecherche] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  const q = recherche.trim().toLowerCase();
  const affiches = vehicules.filter((v) => {
    if (filtre !== "TOUS" && v.statut !== filtre) return false;
    if (!q) return true;
    return [v.numero, libelleVehicule(v.vehicule), v.vehicule.niv, v.vente?.client?.nom].some((t) => t?.toLowerCase().includes(q));
  });
  useOrdreFiches("vehicules-vente", affiches.map((v) => v.id));
  const enStock = vehicules.filter((v) => v.statut === "EN_STOCK");
  const valeurStock = enStock.reduce((s, v) => s + v.coutant, 0);

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>
      <div style={{ marginTop: 10 }}>
        <BandeauSection icone="🚐" titre="Véhicules à vendre" sousTitre="Les véhicules qui nous appartiennent. Les bons faits dessus sont payés en augmentant leur coûtant." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div className="carte carte-s">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{enStock.length}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>En stock</div>
        </div>
        <div className="carte carte-s">
          <div style={{ fontSize: 20, fontWeight: 700 }}>{argent(valeurStock)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Coûtant total en stock</div>
        </div>
      </div>

      {alignement && <AlignementVehicules alignement={alignement} />}

      <button
        onClick={() => setAfficherFormulaire((v) => !v)}
        className="bouton-3d"
        style={{ display: "block", width: "100%", padding: 11, borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 12 }}
      >
        {afficherFormulaire ? "Annuler" : "+ Nouveau véhicule à vendre"}
      </button>
      {afficherFormulaire && <NouveauVehicule onCree={(id) => router.push(`/secretaire/inventaire/vehicules/${id}`)} />}

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher (numéro, marque, modèle, NIV, acheteur)…"
        style={{ ...champStyle, marginBottom: 10 }}
      />
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
        {affiches.map((v) => {
          const prix = v.vente ? v.vente.prixVente : v.prixDemande;
          const profit = prix - (v.vente ? v.vente.coutantVehicule : v.coutant);
          return (
            <Link key={v.id} href={`/secretaire/inventaire/vehicules/${v.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{libelleVehicule(v.vehicule) || "Véhicule"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {v.numero}
                    {v.vehicule.niv && ` · NIV ${v.vehicule.niv}`}
                    {v.vente && ` · vendu à ${v.vente.client.nom}`}
                    {v.bonsOuverts > 0 && ` · ${v.bonsOuverts} bon${v.bonsOuverts > 1 ? "s" : ""} à facturer`}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: v.vente ? "#6FA96B" : "#C9A227" }}>{v.vente ? "Vendu" : "En stock"}</div>
                  <div>Coûtant {argent(v.vente ? v.vente.coutantVehicule : v.coutant)}</div>
                  <div style={{ color: "var(--text-muted)" }}>{v.vente ? "Vendu" : "Demandé"} {argent(prix)}</div>
                  {prix > 0 && <div style={{ fontWeight: 700, color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>Profit {argent(profit)}</div>}
                </div>
              </div>
            </Link>
          );
        })}
        {affiches.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun véhicule dans cette liste.</p>}
      </div>
    </div>
  );
}

function NouveauVehicule({ onCree }) {
  const [vehicule, setVehicule] = useState(VEHICULE_VIDE);
  const [fiche, setFiche] = useState({ coutantAchat: "", prixDemande: "", dateAchat: "", provenance: "", kilometrage: "", description: "" });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function creer() {
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/vehicules-a-vendre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fiche, vehicule }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Erreur.");
    onCree(data.id);
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 14 }}>
      <ChampsVehicule valeur={vehicule} onChange={setVehicule} sansKilometrage />
      <ChampsFiche fiche={fiche} maj={maj} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <button onClick={creer} disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
        {enCours ? "…" : "Créer la fiche"}
      </button>
    </div>
  );
}

// Champs de la fiche (hors véhicule) — partagés avec la fiche détaillée
export function ChampsFiche({ fiche, maj, coutantModifiable = true }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <div>
          <label style={labelStyle}>Coûtant d'achat (avant taxes)</label>
          <input inputMode="decimal" value={fiche.coutantAchat} onChange={maj("coutantAchat")} disabled={!coutantModifiable} placeholder="0,00" style={champStyle} />
        </div>
        <div>
          <label style={labelStyle}>Prix demandé</label>
          <input inputMode="decimal" value={fiche.prixDemande} onChange={maj("prixDemande")} placeholder="0,00" style={champStyle} />
        </div>
        <div>
          <label style={labelStyle}>Date d'achat</label>
          <input type="date" value={fiche.dateAchat} onChange={maj("dateAchat")} disabled={!coutantModifiable} style={champStyle} />
        </div>
        <div>
          <label style={labelStyle}>Kilométrage</label>
          <input inputMode="numeric" value={fiche.kilometrage} onChange={maj("kilometrage")} style={champStyle} />
        </div>
      </div>
      <label style={labelStyle}>Acheté de</label>
      <input value={fiche.provenance} onChange={maj("provenance")} placeholder="Vendeur, encan, échange…" disabled={!coutantModifiable} style={champStyle} />
      <label style={labelStyle}>Description (équipement, état…)</label>
      <textarea value={fiche.description} onChange={maj("description")} rows={3} style={{ ...champStyle, resize: "vertical" }} />
    </>
  );
}

const champStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };

// Coûtant des véhicules en stock comparé au compte 1250 du grand livre, avec
// l'alignement contre 3010 Soldes d'ouverture (lib/vehiculesAVendre.js)
function AlignementVehicules({ alignement }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const aligne = Math.abs(alignement.ecart) < 0.005;

  async function aligner() {
    if (!window.confirm(`Passer une écriture de ${argent(Math.abs(alignement.ecart))} entre 1250 Véhicules à vendre et 3010 Soldes d'ouverture ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/vehicules-a-vendre/aligner", { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{
      background: aligne ? "rgba(111,169,107,0.10)" : "rgba(201,162,39,0.12)",
      border: `1px solid ${aligne ? "var(--success)" : "#C9A227"}`,
      borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12.5,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>Coûtant des véhicules en stock</span><strong>{argent(alignement.valeurStock)}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <span>Grand livre — 1250 Véhicules à vendre</span><strong>{argent(alignement.soldeGL)}</strong>
      </div>
      <p style={{ margin: "8px 0 0", fontWeight: 700 }}>
        {aligne ? "✅ Véhicules alignés avec le grand livre" : `⚠️ Écart de ${argent(alignement.ecart)}`}
      </p>
      {!aligne && (
        <>
          <p style={{ margin: "4px 0 8px", color: "var(--text-muted)" }}>
            Pour les véhicules déjà à l'entreprise avant la comptabilité : l'alignement passe une écriture entre 1250 et 3010 Soldes d'ouverture, sans toucher au bénéfice. Un achat payé par l'entreprise se saisit plutôt dans les comptes à payer (poste « Achat de véhicule à vendre »).
          </p>
          <button onClick={aligner} disabled={enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            {enCours ? "…" : "Aligner les véhicules sur le grand livre"}
          </button>
        </>
      )}
      {erreur && <p style={{ color: "var(--danger)", margin: "6px 0 0" }}>{erreur}</p>}
    </div>
  );
}
