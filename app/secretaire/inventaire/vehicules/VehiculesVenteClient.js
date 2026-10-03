"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import ChampsVehicule, { VEHICULE_VIDE } from "../../../components/ChampsVehicule";
import { libelleVehicule } from "@/lib/vehicules";

const FILTRES = [
  { code: "EN_STOCK", label: "En stock" },
  { code: "VENDU", label: "Vendus" },
  { code: "TOUS", label: "Tous" },
];

const argent = (n) => `${(n || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export default function VehiculesVenteClient({ vehicules }) {
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
      <ChampsVehicule valeur={vehicule} onChange={setVehicule} />
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
