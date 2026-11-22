"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resume, etapeInspection, ETATS_POINT, avecUnite } from "@/lib/grillesInspection";
import { argent } from "@/lib/format";
import { Icone, TEINTES, Pastille } from "../components/StyleSection";

// Carte « Inspection numérique » du bon (module Inspection, lib/inspections.js) :
// les inspections faites sur ce véhicule, où elles en sont, et le bouton
// pour en commencer une. grilles : celles offertes sur les bons (Paramètres
// → Grilles d'inspection). aRevoir : points notés à surveiller aux visites
// précédentes de ce véhicule (lib/inspections.js, pointsARevoir). modifiable :
// bon pas encore facturé ; comptoir : accès « Opérations ».
export default function CarteInspection({ bonId, inspections, grilles, aRevoir = [], modifiable, comptoir }) {
  const router = useRouter();
  const [choix, setChoix] = useState(inspections.length === 0);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState("");
  // Points réglés ici (ajoutés au bon ou écartés) : gardés à l'écran avec leur
  // confirmation, même quand le bon rafraîchi ne les compte plus à revoir
  const [regles, setRegles] = useState([]); // [{ point, action: "ajoute" | "ecarte" }]
  const idsRegles = new Set(regles.map((r) => r.point.id));
  const liste = [...aRevoir.filter((p) => !idsRegles.has(p.id)).map((point) => ({ point })), ...regles];

  if (inspections.length === 0 && !modifiable && liste.length === 0) return null;

  async function regler(point, action) {
    setEnCours(point.id);
    setErreur("");
    const res = await fetch(`/api/inspections/rappels/${point.id}`, {
      method: action === "ajoute" ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: action === "ajoute" ? JSON.stringify({ bonId }) : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(null);
    if (!res?.ok) return setErreur(data?.erreur || "Rien n'a été changé : vérifie la connexion et réessaie.");
    setRegles((r) => [...r, { point, action }]);
    if (action === "ajoute") router.refresh(); // la tâche apparaît sur le bon
  }

  async function commencer(grille) {
    setEnCours(grille);
    setErreur("");
    const res = await fetch(`/api/bons/${bonId}/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grille }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setEnCours(null);
      setErreur(data?.erreur || "L'inspection n'a pas pu être commencée.");
      return;
    }
    router.push(`/bons/${bonId}/inspection/${data.id}`);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: inspections.length || liste.length || (modifiable && choix) ? 12 : 0 }}>
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: TEINTES.bleu.fond, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="liste" taille={20} couleur={TEINTES.bleu.couleur} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>Inspection numérique</div>
          {inspections.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Points vérifiés avec photos, rapport au client et travaux approuvés en ligne.</div>
          )}
        </div>
        {modifiable && inspections.length > 0 && !choix && (
          <button type="button" onClick={() => setChoix(true)} style={boutonDiscret}>+ Nouvelle</button>
        )}
      </div>

      {liste.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, margin: "0 0 6px" }}>À revoir depuis la dernière visite</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {liste.map(({ point: p, action }) => (
              <PointARevoir
                key={p.id} point={p} regle={action} enCours={enCours === p.id}
                peutAjouter={comptoir && modifiable} peutEcarter={comptoir}
                onAjouter={() => regler(p, "ajoute")} onEcarter={() => regler(p, "ecarte")}
              />
            ))}
          </div>
        </div>
      )}

      {inspections.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {inspections.map((i) => <LigneInspection key={i.id} bonId={bonId} inspection={i} />)}
        </div>
      )}

      {modifiable && choix && (
        <div style={{ marginTop: inspections.length ? 12 : 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {grilles.map((g) => (
              <button
                key={g.cle} type="button" onClick={() => commencer(g.cle)} disabled={!!enCours}
                className="bouton-3d"
                style={{ flex: "1 1 180px", padding: "12px 14px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", textAlign: "left" }}
              >
                {enCours === g.cle ? "Préparation…" : `Commencer : ${g.titre}`}
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, opacity: 0.75 }}>{g.nbPoints} points</span>
              </button>
            ))}
          </div>
          {inspections.length > 0 && (
            <button type="button" onClick={() => setChoix(false)} style={{ ...boutonDiscret, marginTop: 8 }}>Annuler</button>
          )}
        </div>
      )}
      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0 0" }}>{erreur}</p>}
    </div>
  );
}

const DATE_COURTE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Toronto" });

function PointARevoir({ point, regle, enCours, peutAjouter, peutEcarter, onAjouter, onEcarter }) {
  const etat = ETATS_POINT[point.etat];
  const refuse = point.approbation === "REFUSE";
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: `4px solid ${etat.couleur}`, borderRadius: 12, padding: "9px 12px", background: "var(--bg)", opacity: regle ? 0.6 : 1 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{point.recommandation || point.libelle}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ color: etat.couleur, fontWeight: 700 }}>{etat.libelle}</span>
            {point.recommandation ? ` · ${point.libelle}` : ""}{point.mesure ? ` · ${avecUnite(point.mesure, point.unite)}` : ""}
            {` · ${DATE_COURTE.format(new Date(point.date))}, bon #${point.bonNumero}`}
            {refuse ? " · refusé par le client" : ""}
          </div>
          {point.constat && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{point.constat}</div>}
        </div>
        {point.prixEstime != null && <span style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(point.prixEstime)}</span>}
      </div>
      {regle ? (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: regle === "ajoute" ? "var(--success)" : "var(--text-muted)", marginTop: 6 }}>
          {regle === "ajoute" ? "✓ Ajouté au bon" : "Écarté : ne reviendra plus"}
        </div>
      ) : (peutAjouter || peutEcarter) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {peutAjouter && (
            <button type="button" onClick={onAjouter} disabled={enCours} style={{ ...boutonDiscret, borderColor: "var(--success)", color: "var(--success)" }}>
              ➕ Ajouter au bon
            </button>
          )}
          {peutEcarter && (
            <button type="button" onClick={onEcarter} disabled={enCours} title="Le point ne reviendra plus (ex. fait ailleurs)" style={{ ...boutonDiscret, color: "var(--text-muted)" }}>
              Écarter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LigneInspection({ bonId, inspection }) {
  const r = resume(inspection.points);
  const etape = etapeInspection(inspection);
  const approuves = inspection.points.filter((pt) => pt.approbation === "APPROUVE");
  const aAjouter = approuves.filter((pt) => !pt.problemeId).length;
  const date = new Date(inspection.creeLe).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Toronto" });

  return (
    <Link
      href={`/bons/${bonId}/inspection/${inspection.id}`}
      style={{ display: "block", textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", background: "var(--bg)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{inspection.titre}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{date}</span>
        <span style={{ marginLeft: "auto" }}><Pastille couleur={etape.couleur} fond="var(--surface-alt)">{etape.libelle}</Pastille></span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
        {inspection.statut !== "TERMINEE" && <span>{r.total - r.aVerifier} / {r.total} vérifiés</span>}
        <Compte couleur="var(--danger)" n={r.URGENT} libelle={r.URGENT > 1 ? "urgents" : "urgent"} />
        <Compte couleur="var(--avertissement)" n={r.SURVEILLER} libelle="à surveiller" />
        <Compte couleur="var(--success)" n={r.OK} libelle="OK" />
        {approuves.length > 0 && (
          <span style={{ color: aAjouter ? "var(--success)" : "var(--text-muted)", fontWeight: aAjouter ? 700 : 400 }}>
            {approuves.length} approuvé{approuves.length > 1 ? "s" : ""}{aAjouter ? ` · ${aAjouter} à ajouter au bon` : " · sur le bon"}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex" }}><Icone nom="chevron" taille={16} /></span>
      </div>
    </Link>
  );
}

function Compte({ couleur, n, libelle }) {
  if (!n) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: couleur }} />
      <b style={{ color: "var(--text)" }}>{n}</b> {libelle}
    </span>
  );
}

const boutonDiscret = { fontSize: 12.5, fontWeight: 700, color: "var(--text)", background: "none", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 999, cursor: "pointer" };
