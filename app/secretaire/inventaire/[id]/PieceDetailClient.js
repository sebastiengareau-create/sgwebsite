"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ONGLETS = [
  { code: "resume", label: "Résumé" },
  { code: "mouvements", label: "Mouvements" },
  { code: "achats", label: "Achats" },
  { code: "ventes", label: "Ventes" },
  { code: "fournisseurs", label: "Fournisseurs" },
  { code: "historique", label: "Historique" },
];

const TYPE_MOUVEMENT = {
  RECEPTION: { label: "Réception", couleur: "var(--success)" },
  VENTE: { label: "Vente", couleur: "var(--danger)" },
  AJUSTEMENT: { label: "Ajustement", couleur: "var(--text-muted)" },
};

export default function PieceDetailClient({ piece, categories, fournisseurs }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("resume");

  const [nom, setNom] = useState(piece.nom);
  const [numero, setNumero] = useState(piece.numero);
  const [qte, setQte] = useState(piece.qte);
  const [qteMin, setQteMin] = useState(piece.qteMin);
  const [qteMax, setQteMax] = useState(piece.qteMax ?? "");
  const [emplacement, setEmplacement] = useState(piece.emplacement || "");
  const [fournisseurId, setFournisseurId] = useState(piece.fournisseurId || "");
  const [prix, setPrix] = useState(piece.prix);
  const [coutant, setCoutant] = useState(piece.coutant || 0);
  const [categorie, setCategorie] = useState(piece.categorie || "PIECE");

  const marge = piece.prix - (piece.coutant || 0);
  const margePct = piece.prix > 0 ? (marge / piece.prix) * 100 : 0;
  const stockBas = piece.qte <= piece.qteMin;
  const nomCategorie = categories.find((c) => c.code === piece.categorie)?.nom || piece.categorie;

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom, numero, qte, qteMin, prix, coutant, categorie,
        qteMax: qteMax === "" ? null : qteMax,
        emplacement: emplacement.trim() || null,
        fournisseurId: fournisseurId || null,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setModeEdition(false);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer "${piece.nom}" de l'inventaire ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/inventaire");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>

      <div style={{ background: "var(--surface)", border: stockBas ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{piece.nom}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{piece.numero}</div>
        <span className="bouton-3d" style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{nomCategorie}</span>
        {stockBas && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8, fontWeight: 700 }}>⚠ Stock sous le seuil minimum</div>}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <label style={labelStyle}>Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <label style={labelStyle}>Numéro de référence</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} style={champStyle} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Stock</label>
              <input type="number" min={0} value={qte} onChange={(e) => setQte(e.target.value)} style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Seuil min.</label>
              <input type="number" min={0} value={qteMin} onChange={(e) => setQteMin(e.target.value)} style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Seuil max.</label>
              <input type="number" min={0} value={qteMax} onChange={(e) => setQteMax(e.target.value)} placeholder="optionnel" style={champStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Coût moyen ($)</label>
              <input type="number" min={0} step="0.01" value={coutant} onChange={(e) => setCoutant(e.target.value)} style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Prix de vente ($)</label>
              <input type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} style={champStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Emplacement</label>
              <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="ex. A-03-02" style={champStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Fournisseur habituel</label>
              <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} style={champStyle}>
                <option value="">Aucun</option>
                {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
          </div>
          <label style={labelStyle}>Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ ...champStyle, marginBottom: 12 }}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button onClick={() => setModeEdition(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
            {ONGLETS.map((o) => (
              <button
                key={o.code}
                onClick={() => setOnglet(o.code)}
                style={{
                  flex: "1 0 auto", fontSize: 11.5, fontWeight: 700, padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  background: onglet === o.code ? "var(--accent)" : "none",
                  color: onglet === o.code ? "#17150f" : "var(--text-muted)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {onglet === "resume" && (
            <OngletResume piece={piece} marge={marge} margePct={margePct} />
          )}
          {onglet === "mouvements" && <OngletMouvements mouvements={piece.mouvements} />}
          {onglet === "achats" && <OngletAchats lignesDepense={piece.lignesDepense} />}
          {onglet === "ventes" && <OngletVentes utilisee={piece.utilisee} />}
          {onglet === "fournisseurs" && <OngletFournisseurs piece={piece} lignesDepense={piece.lignesDepense} />}
          {onglet === "historique" && <OngletHistorique historique={piece.historique} />}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
            </button>
            <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function OngletResume({ piece, marge, margePct }) {
  return (
    <>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <SectionTitre>Stock</SectionTitre>
        <Champ label="Stock actuel" valeur={`${piece.qte}`} />
        <Champ label="Seuil minimum" valeur={`${piece.qteMin}`} />
        {piece.qteMax != null && <Champ label="Seuil maximum" valeur={`${piece.qteMax}`} />}
        {piece.emplacement && <Champ label="Emplacement" valeur={piece.emplacement} />}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <SectionTitre>Prix et marge</SectionTitre>
        <Champ label="Coût moyen" valeur={`${(piece.coutant || 0).toFixed(2)} $`} />
        <Champ label="Prix de vente" valeur={`${piece.prix.toFixed(2)} $`} />
        <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6 }}>
          <Champ label="Marge par unité" valeur={`${marge.toFixed(2)} $ (${margePct.toFixed(0)} %)`} accent />
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <SectionTitre>Fournisseur</SectionTitre>
        <Champ label="Fournisseur habituel" valeur={piece.fournisseur?.nom || "Aucun"} />
      </div>
    </>
  );
}

function OngletMouvements({ mouvements }) {
  if (mouvements.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun mouvement de stock enregistré pour cet article pour l'instant.</p>;
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <SectionTitre>Historique des mouvements de stock</SectionTitre>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mouvements.map((m) => {
          const info = TYPE_MOUVEMENT[m.type] || { label: m.type, couleur: "var(--text)" };
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: info.couleur }}>{info.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{new Date(m.creeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
                {m.note && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{m.note}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.qte >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {m.qte >= 0 ? "+" : ""}{m.qte}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Solde : {m.solde}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OngletAchats({ lignesDepense }) {
  if (lignesDepense.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun achat lié à cet article — utilise l'option "Réception d'inventaire" en créant une dépense fournisseur pour en enregistrer.</p>;
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <SectionTitre>Réceptions liées à des factures fournisseur</SectionTitre>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lignesDepense.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{l.depense.fournisseur.nom}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                {new Date(l.depense.dateFacture).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {l.depense.description}
              </div>
              <div style={{ fontSize: 10.5, color: l.depense.statut === "PAYEE" ? "var(--success)" : "var(--danger)" }}>
                {l.depense.statut === "PAYEE" ? "Payée" : "Impayée"}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>+{l.qteRecue}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{(l.montant / l.qteRecue).toFixed(2)} $ / unité</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OngletVentes({ utilisee }) {
  if (utilisee.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Cette pièce n'a pas encore été utilisée sur un bon de travail.</p>;
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <SectionTitre>Utilisations sur des bons de travail</SectionTitre>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {utilisee.map((u) => (
          <Link key={u.id} href={`/bons/${u.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>#{u.probleme.bon.numero} — {u.probleme.bon.client.nom}</span>
              <span>{u.qte} × {u.prix.toFixed(2)} $</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function OngletFournisseurs({ piece, lignesDepense }) {
  const parFournisseur = new Map();
  for (const l of lignesDepense) {
    const cle = l.depense.fournisseur.id;
    const existant = parFournisseur.get(cle);
    const coutUnitaire = l.montant / l.qteRecue;
    if (!existant || new Date(l.depense.dateFacture) > new Date(existant.derniereDate)) {
      parFournisseur.set(cle, {
        nom: l.depense.fournisseur.nom,
        derniereDate: l.depense.dateFacture,
        dernierCout: coutUnitaire,
        totalRecu: (existant?.totalRecu || 0) + l.qteRecue,
      });
    } else {
      parFournisseur.set(cle, { ...existant, totalRecu: existant.totalRecu + l.qteRecue });
    }
  }
  const fournisseursHistorique = Array.from(parFournisseur.values()).sort((a, b) => new Date(b.derniereDate) - new Date(a.derniereDate));

  return (
    <>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <SectionTitre>Fournisseur habituel</SectionTitre>
        <Champ label="Fournisseur par défaut" valeur={piece.fournisseur?.nom || "Aucun — configurable dans Modifier"} />
      </div>
      {fournisseursHistorique.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <SectionTitre>Fournisseurs ayant déjà livré cet article</SectionTitre>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fournisseursHistorique.map((f) => (
              <div key={f.nom} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{f.nom}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                    Dernière réception : {new Date(f.derniereDate).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{f.dernierCout.toFixed(2)} $ / unité</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{f.totalRecu} reçues au total</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function OngletHistorique({ historique }) {
  if (historique.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune modification enregistrée sur la fiche de cet article.</p>;
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <SectionTitre>Modifications de la fiche</SectionTitre>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {historique.map((h) => (
          <div key={h.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            <div style={{ fontSize: 12 }}>
              <strong>{h.champ}</strong> : {h.ancienneValeur ?? "—"} → {h.nouvelleValeur ?? "—"}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {new Date(h.modifieLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}{h.modifiePar ? ` · ${h.modifiePar}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitre({ children }) {
  return <div style={{ fontSize: 10.5, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.04em", marginBottom: 10 }}>{children}</div>;
}
function Champ({ label, valeur, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>{valeur}</span>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4, marginTop: 8 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
