"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, BoutonPlein, Panneau, Pastille, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

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
    setMessage({ type: "succes", texte: `Amortissement de ${argent(data.montant)} comptabilisé ✓` });
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

  const actives = immobilisations.filter((im) => im.actif);
  const coutTotal = actives.reduce((s, im) => s + im.coutAcquisition, 0);
  const enAmortissement = actives.filter((im) => im.amortissementCumule < Math.max(0, im.coutAcquisition - im.valeurResiduelle) - 0.005);
  const amortissementMensuelTotal = enAmortissement.reduce((s, im) => s + im.amortissementMensuel, 0);

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection
          icone="🏗️" titre="Immobilisations"
          sousTitre="Équipement significatif (pont élévateur, outils dispendieux, véhicule) — sa valeur s'étale sur sa durée de vie plutôt que d'être une dépense d'un coup."
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={afficherFormulaire ? null : "plus"} onClick={() => setAfficherFormulaire((v) => !v)}>
          {afficherFormulaire ? "Annuler" : "Nouvelle immobilisation"}
        </BoutonPlein>
      </div>

      {afficherFormulaire && <FormulaireImmobilisation onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />}

      <div className="grille-trois" style={{ marginBottom: 28 }}>
        <CarteChiffre titre="Valeur nette" montant={argent(valeurNetteTotale)} teinte="var(--accent)" note="Après amortissement à ce jour" />
        <CarteChiffre titre="Coût d'achat" montant={argent(coutTotal)} teinte="var(--bleu)" note={`${actives.length} immobilisation${actives.length !== 1 ? "s" : ""} active${actives.length !== 1 ? "s" : ""}`} />
        <CarteChiffre
          titre="Amortissement mensuel" montant={argent(amortissementMensuelTotal)} teinte="var(--success)"
          note={enAmortissement.length > 0 ? `${enAmortissement.length} en cours d'amortissement` : "Rien à amortir"}
        />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau
          icone="calculatrice" teinte={TEINTES.vert} titre="Comptabiliser l'amortissement"
          sousTitre="Une écriture par mois pour toutes les immobilisations actives."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input type="month" max="9999-12" value={moisAmortir} onChange={(e) => { setMoisAmortir(e.target.value); setMessage(null); }} style={{ ...champStyle, marginBottom: 0, padding: "11px 12px", fontSize: 14, borderRadius: 12 }} />
          <button
            onClick={comptabiliserAmortissement} disabled={amortissementEnCours || dejaAmorti}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 12px", borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: dejaAmorti ? "default" : "pointer",
              color: dejaAmorti ? "var(--success)" : "#fff", background: dejaAmorti ? "var(--success-fond)" : "var(--success)", border: "1px solid var(--success)",
            }}
          >
            <Icone nom="crochet" taille={18} couleur={dejaAmorti ? "var(--success)" : "#fff"} />
            {amortissementEnCours ? "…" : dejaAmorti ? "Déjà comptabilisé" : "Comptabiliser"}
          </button>
        </div>
        {message && (
          <p style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 0", color: message.type === "succes" ? "var(--success)" : "var(--danger)" }}>{message.texte}</p>
        )}
      </div>

      <Panneau titre="Immobilisations">
        {immobilisations.length > 0 && (
          <div style={{ display: "flex", padding: "0 4px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "2px solid var(--accent)", marginBottom: 4 }}>
            <span style={{ flex: 1 }}>{immobilisations.length} immobilisation{immobilisations.length !== 1 ? "s" : ""}</span>
            <span>Valeur nette</span>
          </div>
        )}
        {immobilisations.map((im, i) => {
          const base = Math.max(0, im.coutAcquisition - im.valeurResiduelle);
          const pourcent = base > 0 ? Math.min(100, Math.round((im.amortissementCumule / base) * 100)) : 100;
          return (
            <div key={im.id} style={{ padding: "14px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)", opacity: im.actif ? 1 : 0.55 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icone nom="outils" taille={20} couleur={TEINTES.ambre.couleur} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{im.nom}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(im.valeurNette)}</span>
                  </div>
                  {im.description && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{im.description}</div>}
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    Achetée le {new Date(im.dateAcquisition).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} à {argent(im.coutAcquisition)} · {im.dureeVieAns} an{im.dureeVieAns > 1 ? "s" : ""} · {argent(im.amortissementMensuel)}/mois
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden" }}>
                      <div style={{ width: `${pourcent}%`, height: "100%", borderRadius: 999, background: pourcent >= 100 ? "var(--success)" : "var(--accent)" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{pourcent} % amorti</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
                    {!im.actif && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Retirée</Pastille>}
                    {im.actif && pourcent >= 100 && <Pastille couleur="var(--success)" fond="var(--success-fond)">Entièrement amortie</Pastille>}
                    {im.actif && (
                      <button onClick={() => retirer(im.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--danger)", background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 10, cursor: "pointer" }}>
                        <Icone nom="poubelle" taille={14} couleur="var(--danger)" /> Retirer (vendue / mise au rebut)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {immobilisations.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune immobilisation encore — ajoute-en une avec « Nouvelle immobilisation ».</p>
        )}
      </Panneau>

      {amortissements.length > 0 && (
        <div style={stylePanneau}>
          <TitrePanneau icone="calendrier" teinte={TEINTES.bleu} titre="Historique des amortissements" sousTitre="Les 12 derniers mois comptabilisés." />
          {amortissements.map((a, i) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 4px", borderTop: i === 0 ? "none" : "1px solid var(--border)", fontSize: 14 }}>
              <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{nomMois(a.mois)}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{argent(a.montant)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// "2026-10" → "octobre 2026"
function nomMois(mois) {
  const [a, m] = mois.split("-").map(Number);
  if (!a || !m) return mois;
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" });
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
    <form onSubmit={creer} style={stylePanneau}>
      <TitrePanneau icone="outils" titre="Nouvelle immobilisation" sousTitre="L'achat est comptabilisé, puis amorti chaque mois sur sa durée de vie." />
      <input required placeholder="Nom (ex : Pont élévateur 2 colonnes)" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date d'achat</label>
          <input type="date" max="9999-12-31" value={dateAcquisition} onChange={(e) => setDateAcquisition(e.target.value)} style={champStyle} />
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
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
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
