"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ImmobilisationsClient({ immobilisations, amortissements }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [moisAmortir, setMoisAmortir] = useState(new Date().toISOString().slice(0, 7));
  const [amortissementEnCours, setAmortissementEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const valeurNetteTotale = immobilisations.filter((im) => im.actif).reduce((s, im) => s + im.valeurNette, 0);
  const dejaAmorti = amortissements.some((a) => a.mois === moisAmortir);

  async function comptabiliserAmortissement() {
    if (!window.confirm(`Comptabiliser l'amortissement de ${moisAmortir} pour toutes les immobilisations actives ?`)) return;
    setAmortissementEnCours(true);
    setMessage(null);
    const res = await fetch("/api/immobilisations/amortir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mois: moisAmortir }),
    });
    const data = await res.json();
    setAmortissementEnCours(false);
    if (!res.ok) {
      setMessage({ type: "erreur", texte: data.erreur });
      return;
    }
    setMessage({ type: "succes", texte: `Amortissement de ${data.montant.toFixed(2)} $ comptabilisé ✓` });
    router.refresh();
  }

  async function retirer(id) {
    if (!window.confirm("Retirer cette immobilisation (vendue ou mise au rebut) ? Garde son historique.")) return;
    await fetch(`/api/immobilisations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>🏗️ Immobilisations</h1>
        <button onClick={() => setAfficherFormulaire((v) => !v)} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {afficherFormulaire ? "Annuler" : "+ Ajouter"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Équipement significatif (pont élévateur, outils dispendieux, véhicule) — sa valeur s'étale sur sa durée de vie
        plutôt que d'être une dépense d'un coup.
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{valeurNetteTotale.toFixed(2)} $</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Valeur nette totale (après amortissement à ce jour)</div>
      </div>

      {afficherFormulaire && <FormulaireImmobilisation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Comptabiliser l'amortissement</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="month" value={moisAmortir} onChange={(e) => setMoisAmortir(e.target.value)} style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }} />
          <button onClick={comptabiliserAmortissement} disabled={amortissementEnCours || dejaAmorti} className="bouton-3d" style={{ padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, opacity: dejaAmorti ? 0.5 : 1 }}>
            {amortissementEnCours ? "…" : dejaAmorti ? "Déjà fait" : "Comptabiliser"}
          </button>
        </div>
        {message && (
          <p style={{ fontSize: 12, marginTop: 8, color: message.type === "succes" ? "var(--success)" : "var(--danger)" }}>{message.texte}</p>
        )}
      </div>

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Immobilisations</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {immobilisations.map((im) => (
          <div key={im.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, opacity: im.actif ? 1 : 0.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{im.nom}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{im.valeurNette.toFixed(2)} $</span>
            </div>
            {im.description && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{im.description}</div>}
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
              Acheté {new Date(im.dateAcquisition).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} à {im.coutAcquisition.toFixed(2)} $ ·
              Durée de vie {im.dureeVieAns} ans · Amortissement {im.amortissementMensuel.toFixed(2)} $/mois
            </div>
            {im.actif && (
              <button onClick={() => retirer(im.id)} style={{ marginTop: 6, fontSize: 11, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
                Retirer (vendue / mise au rebut)
              </button>
            )}
          </div>
        ))}
        {immobilisations.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune immobilisation encore.</p>}
      </div>

      {amortissements.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20, marginBottom: 8 }}>Historique des amortissements</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {amortissements.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ color: "var(--text-muted)" }}>{a.mois}</span>
                <span style={{ fontWeight: 700 }}>{a.montant.toFixed(2)} $</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FormulaireImmobilisation({ onCree }) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [dateAcquisition, setDateAcquisition] = useState(new Date().toISOString().slice(0, 10));
  const [coutAcquisition, setCoutAcquisition] = useState("");
  const [valeurResiduelle, setValeurResiduelle] = useState("0");
  const [dureeVieAns, setDureeVieAns] = useState("5");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/immobilisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, description, dateAcquisition, coutAcquisition, valeurResiduelle, dureeVieAns }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <input required placeholder="Nom (ex : Pont élévateur 2 colonnes)" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date d'achat</label>
          <input type="date" value={dateAcquisition} onChange={(e) => setDateAcquisition(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Coût d'achat ($)</label>
          <input required type="number" min={0} step="0.01" value={coutAcquisition} onChange={(e) => setCoutAcquisition(e.target.value)} style={champStyle} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Durée de vie (années)</label>
          <input required type="number" min={1} value={dureeVieAns} onChange={(e) => setDureeVieAns(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Valeur résiduelle ($)</label>
          <input type="number" min={0} step="0.01" value={valeurResiduelle} onChange={(e) => setValeurResiduelle(e.target.value)} style={champStyle} />
        </div>
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Enregistrement…" : "Ajouter l'immobilisation"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };
