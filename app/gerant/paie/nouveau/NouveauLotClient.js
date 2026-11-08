"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../../../components/StyleSection";

export default function NouveauLotClient({ employes }) {
  const router = useRouter();
  const [periodeDebut, setPeriodeDebut] = useState("");
  const [periodeFin, setPeriodeFin] = useState(dateAujourdhuiQuebec());
  const [dateVersement, setDateVersement] = useState(dateAujourdhuiQuebec());
  const [typePaie, setTypePaie] = useState("REGULIERE");
  const [selectionnes, setSelectionnes] = useState(() => new Set(employes.map((e) => e.id)));
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  function basculer(id) {
    setSelectionnes((prev) => {
      const nouveau = new Set(prev);
      if (nouveau.has(id)) nouveau.delete(id); else nouveau.add(id);
      return nouveau;
    });
  }

  async function calculerLot(e) {
    e.preventDefault();
    setErreur("");
    if (!periodeDebut || !periodeFin) {
      setErreur("Choisis une période complète.");
      return;
    }
    if (selectionnes.size === 0) {
      setErreur("Sélectionne au moins un employé.");
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/paie/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typePaie,
        periodeDebut: `${periodeDebut}T00:00:00`,
        periodeFin: `${periodeFin}T23:59:59`,
        dateVersement: `${dateVersement}T00:00:00`,
        employeIds: Array.from(selectionnes),
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors du calcul du lot.");
      return;
    }
    const data = await res.json();
    router.push(`/gerant/paie/lots/${data.id}`);
  }

  const TYPES = [
    { code: "REGULIERE", icone: "calculatrice", teinte: TEINTES.ambre, titre: "Paie régulière", detail: "Heures et salaires de la période" },
    { code: "VACANCES", icone: "drapeau", teinte: TEINTES.vert, titre: "Paie de vacances", detail: "Verse les vacances accumulées" },
  ];

  return (
    <div className="conteneur-page">
      <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la paie</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🧾" titre="Nouveau lot de paie" sousTitre="Choisis le type, la période et les employés, puis calcule le lot — tu pourras le vérifier avant de le finaliser." />
      </div>

      <form onSubmit={calculerLot}>
        <div style={stylePanneau}>
          <TitrePanneau icone="liste" teinte={TEINTES.ambre} titre="Type de paie" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {TYPES.map((t) => {
              const actif = typePaie === t.code;
              return (
                <button
                  key={t.code} type="button" onClick={() => setTypePaie(t.code)} aria-pressed={actif}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                    background: actif ? t.teinte.fond : "var(--surface)", border: `1.5px solid ${actif ? t.teinte.couleur : "var(--border)"}`, color: "var(--text)",
                  }}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: actif ? "var(--surface)" : t.teinte.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icone nom={t.icone} taille={19} couleur={t.teinte.couleur} />
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 800 }}>{t.titre}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{t.detail}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={stylePanneau}>
          <TitrePanneau icone="calendrier" teinte={TEINTES.bleu} titre="Période et versement" sousTitre="La date de versement est la même pour tout le lot, même si un employé est ajouté après coup." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Début de la période</label>
              <input type="date" max="9999-12-31" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} style={champStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fin de la période</label>
              <input type="date" max="9999-12-31" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} style={champStyle} />
            </div>
          </div>
          <label style={labelStyle}>Date du versement</label>
          <input type="date" max="9999-12-31" value={dateVersement} onChange={(e) => setDateVersement(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
        </div>

        <div style={stylePanneau}>
          <TitrePanneau
            icone="utilisateurs" teinte={TEINTES.vert} titre="Employés"
            sousTitre="Coche les employés à payer dans ce lot."
            droite={<Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>{selectionnes.size} / {employes.length}</Pastille>}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <BoutonAction icone="crochet" compact onClick={() => setSelectionnes(new Set(employes.map((e) => e.id)))}>Tout cocher</BoutonAction>
            <BoutonAction icone="bloque" compact couleur="var(--text-muted)" onClick={() => setSelectionnes(new Set())}>Tout décocher</BoutonAction>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
            {employes.map((emp) => {
              const coche = selectionnes.has(emp.id);
              return (
                <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: "pointer", background: coche ? "var(--success-fond)" : "var(--bg)", border: `1px solid ${coche ? "var(--success)" : "var(--border)"}` }}>
                  <input type="checkbox" checked={coche} onChange={() => basculer(emp.id)} style={{ width: 18, height: 18, accentColor: "var(--success)", flexShrink: 0 }} />
                  <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
                    {emp.nom.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.nom}</span>
                  {emp.typeRemuneration === "SALAIRE"
                    ? <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>Salarié</Pastille>
                    : <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>À l'heure</Pastille>}
                </label>
              );
            })}
            {employes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun employé actif.</p>}
          </div>
        </div>

        {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          {enCours ? "Calcul…" : `Calculer le lot · ${selectionnes.size} employé${selectionnes.size !== 1 ? "s" : ""}`}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const champStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box",
};
