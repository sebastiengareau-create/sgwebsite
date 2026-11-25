"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { libelleVehicule } from "@/lib/vehicules";
import { MESSAGES_TEXTO } from "@/lib/textos";
import {
  STATUTS_JEU, SAISONS, JANTES, ETATS_JEU, CONDITIONS_RECU_DEFAUT, libelleJeu, libelleJeuMinuscule, saisonAVenir, estARappeler, dejaRappele,
  evaluerJeu, occupationPlan, progressionSaison, estOublie, entreLe, emplacementsRangee,
} from "@/lib/pneusCalculs";
import { Icone, TEINTES, Pastille } from "../components/StyleSection";
import BoutonTexto from "../components/BoutonTexto";
import { PastilleEtat } from "./EtatJeu";
import ChampArgent from "@/app/components/ChampArgent";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Toronto" });

// Couleur de chaque saison sur le plan de l'entrepôt
const COULEURS_SAISON = {
  HIVER: { couleur: "var(--bleu)", fond: "var(--bleu-fond)" },
  ETE: { couleur: "var(--accent-ombre)", fond: "rgba(232,163,61,0.16)" },
  QUATRE_SAISONS: { couleur: "var(--success)", fond: "var(--success-fond)" },
};

// Comparaison d'emplacements « A-2 » < « A-10 » (nombres comparés comme nombres)
const parEmplacement = (a, b) => String(a.emplacement || "").localeCompare(String(b.emplacement || ""), "fr-CA", { numeric: true });
const parClient = (a, b) => a.client.nom.localeCompare(b.client.nom, "fr-CA");
const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

export default function PneusClient({ jeux: jeuxInitiaux, reglages: reglagesInitiaux, peutRegler, nomEntreprise, courrielPret }) {
  const [jeux, setJeux] = useState(jeuxInitiaux);
  const [reglages, setReglages] = useState(reglagesInitiaux);
  const [onglet, setOnglet] = useState("entrepot");
  const [recherche, setRecherche] = useState("");
  const [saison, setSaison] = useState("");
  const aVenir = saisonAVenir();
  const { plan, seuils } = reglages;

  const filtre = useMemo(() => {
    const mots = recherche.toLowerCase().split(/\s+/).filter(Boolean);
    if (!mots.length) return () => true;
    return (j) => {
      const texte = [j.numero, j.client.nom, j.client.telephone, j.emplacement, j.dimension, j.marque, j.modele, j.vehicule && libelleVehicule(j.vehicule), j.vehicule?.plaque]
        .filter(Boolean).join(" ").toLowerCase();
      return mots.every((m) => texte.includes(m));
    };
  }, [recherche]);

  const etats = useMemo(() => new Map(jeux.map((j) => [j.id, evaluerJeu(j, seuils)])), [jeux, seuils]);
  const entrepot = jeux.filter((j) => j.statut === "ENTREPOSE");
  const poses = jeux.filter((j) => j.statut === "POSE");
  const remis = jeux.filter((j) => j.statut === "REMIS");
  const aRappeler = entrepot.filter((j) => estARappeler(j, aVenir));
  const restantARappeler = aRappeler.filter((j) => !dejaRappele(j, aVenir));
  const aRemplacer = jeux.filter((j) => j.statut !== "REMIS" && etats.get(j.id)?.code === "REMPLACER");
  const oublies = entrepot.filter((j) => estOublie(j));
  const progression = progressionSaison(jeux, aVenir);
  const occupation = occupationPlan(plan, entrepot);
  const aPlan = plan.rangees.length > 0;

  const onglets = [
    { cle: "entrepot", libelle: `À l'entrepôt (${entrepot.length})` },
    { cle: "plan", libelle: aPlan ? `Plan (${occupation.libres} libres)` : "Plan" },
    { cle: "poses", libelle: `Posés (${poses.length})` },
    { cle: "rappels", libelle: `Rappels (${restantARappeler.length})` },
    { cle: "remplacer", libelle: `À remplacer (${aRemplacer.length})` },
    ...(oublies.length ? [{ cle: "oublies", libelle: `Oubliés (${oublies.length})` }] : []),
    { cle: "remis", libelle: `Remis (${remis.length})` },
    ...(peutRegler ? [{ cle: "reglages", libelle: "⚙ Réglages" }] : []),
  ];
  const listes = {
    entrepot: [...entrepot].filter((j) => !saison || j.saison === saison).sort(parEmplacement),
    poses: [...poses].sort(parClient),
    rappels: [...aRappeler].sort(parClient),
    remplacer: [...aRemplacer].sort(parClient),
    oublies: [...oublies].sort((a, b) => new Date(entreLe(a) || a.creeLe) - new Date(entreLe(b) || b.creeLe)),
    remis: [...remis].sort(parClient),
  };
  const liste = (listes[onglet] || []).filter(filtre);

  const marquerRappele = (ids) => setJeux((js) => js.map((j) => (ids.includes(j.id) ? { ...j, rappelLe: new Date().toISOString() } : j)));

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: TEINTES.bleu.fond, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="pneu" taille={22} couleur={TEINTES.bleu.couleur} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>Entreposage de pneus</h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{pluriel(entrepot.length, "jeu", "jeux")} à l&apos;entrepôt · {poses.length} sur les véhicules</div>
        </div>
        <Link href="/pneus/nouveau" className="bouton-3d" style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
          + Nouveau jeu
        </Link>
      </div>

      {/* Suivi : l'entrepôt, la saison, les ventes à proposer */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 8, marginBottom: 14 }}>
        <Tuile
          titre="À l'entrepôt" valeur={entrepot.length} teinte={TEINTES.bleu} onClick={() => setOnglet(aPlan ? "plan" : "entrepot")}
          note={aPlan ? `${pluriel(occupation.libres, "place libre", "places libres")} sur ${occupation.total}` : "Plan de l'entrepôt à définir"}
          barre={aPlan && occupation.total ? occupation.occupees / occupation.total : null}
        />
        <Tuile
          titre={aVenir.titre} valeur={progression.total ? `${progression.faits} / ${progression.total}` : "—"} teinte={TEINTES.vert} onClick={() => setOnglet("rappels")}
          note={progression.total ? `${progression.restants} encore à l'entrepôt · ${restantARappeler.length} à rappeler` : `Aucun jeu ${SAISONS[aVenir.saison].deSaison} suivi`}
          barre={progression.total ? progression.faits / progression.total : null}
        />
        <Tuile
          titre="À remplacer" valeur={aRemplacer.length} teinte={TEINTES.rouge} couleur={aRemplacer.length ? "var(--danger)" : undefined}
          note={aRemplacer.length ? "Pneus neufs à proposer" : "Aucun jeu usé ou trop vieux"} onClick={() => setOnglet("remplacer")}
        />
        {oublies.length > 0 ? (
          <Tuile titre="Oubliés" valeur={oublies.length} teinte={TEINTES.ambre} couleur="var(--avertissement)" note="À l'entrepôt depuis plus d'un an" onClick={() => setOnglet("oublies")} />
        ) : (
          <Tuile titre="Sur les véhicules" valeur={poses.length} teinte={TEINTES.neutre} note="Jeux de l'autre saison suivis" onClick={() => setOnglet("poses")} />
        )}
      </div>

      {onglet !== "reglages" && (
        <input
          type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ"
          placeholder="Client, plaque, PN-…, emplacement, dimension" aria-label="Rechercher un jeu de pneus"
          style={{ fontSize: 15, padding: "11px 12px", marginBottom: 10 }}
        />
      )}

      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {onglets.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle} onClick={() => setOnglet(o.cle)} style={puce(onglet === o.cle)}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === "reglages" && <Reglages reglages={reglages} onEnregistre={setReglages} />}

      {onglet === "plan" && <PlanEntrepot occupation={occupation} etats={etats} filtre={recherche ? filtre : null} peutRegler={peutRegler} onRegler={() => setOnglet("reglages")} />}

      {onglet === "rappels" && (
        <Rappels
          aVenir={aVenir} jeux={liste} etats={etats} restants={restantARappeler.filter(filtre)} nomEntreprise={nomEntreprise}
          courrielPret={courrielPret} onRappeles={marquerRappele}
        />
      )}

      {onglet === "remplacer" && <ARemplacer jeux={liste} etats={etats} nomEntreprise={nomEntreprise} />}

      {onglet === "entrepot" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {[["", "Toutes les saisons"], ...Object.entries(SAISONS).map(([cle, s]) => [cle, s.libelle])].map(([cle, libelle]) => (
            <button key={cle || "toutes"} type="button" aria-pressed={saison === cle} onClick={() => setSaison(cle)} style={{ ...puce(saison === cle), fontSize: 12, padding: "5px 10px" }}>{libelle}</button>
          ))}
          <button type="button" onClick={() => exporterCsv(liste, etats)} disabled={!liste.length} style={{ ...petitBouton, marginLeft: "auto", cursor: liste.length ? "pointer" : "default" }}>⬇ Liste en CSV</button>
        </div>
      )}

      {["entrepot", "poses", "oublies", "remis"].includes(onglet) && (
        liste.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
            {recherche ? "Aucun jeu ne correspond à la recherche." : onglet === "entrepot" ? "Aucun jeu à l'entrepôt pour l'instant. « + Nouveau jeu » pour en inscrire un, ou faites un changement de saison sur un bon." : "Aucun jeu ici."}
          </p>
        ) : (
          <>
            {onglet === "oublies" && (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
                Des jeux à l&apos;entrepôt depuis plus d&apos;un an : le client a sauté une saison. À rappeler — ou à remettre, s&apos;il ne les veut plus.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {liste.map((j) => <LigneJeu key={j.id} jeu={j} etat={etats.get(j.id)} depuis={onglet === "oublies"} />)}
            </div>
          </>
        )
      )}
    </div>
  );
}

// Tuile chiffrée du haut de la page, qui ouvre l'onglet correspondant
function Tuile({ titre, valeur, note, teinte, couleur = "var(--text)", barre = null, onClick }) {
  return (
    <button
      type="button" onClick={onClick} className="tuile-immo"
      style={{ position: "relative", overflow: "hidden", textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px 10px 15px", minWidth: 0 }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte.couleur }} />
      <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</span>
      <span style={{ display: "block", fontSize: 24, fontWeight: 800, color: couleur, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", margin: "2px 0" }}>{valeur}</span>
      {barre != null && (
        <span style={{ display: "block", height: 5, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden", margin: "2px 0 5px" }}>
          <span style={{ display: "block", height: "100%", width: `${Math.round(Math.min(1, barre) * 100)}%`, background: teinte.couleur, borderRadius: 999 }} />
        </span>
      )}
      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.35 }}>{note}</span>
    </button>
  );
}

function LigneJeu({ jeu, etat, depuis = false }) {
  const statut = STATUTS_JEU[jeu.statut];
  const entre = entreLe(jeu);
  return (
    <Link href={`/pneus/${jeu.id}`} style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ width: 64, flexShrink: 0, textAlign: "center" }}>
        {jeu.statut === "ENTREPOSE"
          ? <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{jeu.emplacement || "—"}</div>
          : <Pastille couleur={statut.couleur} fond={statut.fond}>{jeu.statut === "POSE" ? "Posé" : "Remis"}</Pastille>}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{jeu.numero}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>{jeu.client.nom}</span>
          {jeu.statut !== "REMIS" && <PastilleEtat etat={etat} bonAussi={false} />}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {jeu.vehicule ? `${libelleVehicule(jeu.vehicule)}${jeu.vehicule.plaque ? ` · ${jeu.vehicule.plaque}` : ""}` : "Véhicule non précisé"}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 2 }}>
          {libelleJeu(jeu)}{jeu.marque ? ` · ${jeu.marque}` : ""}{etat?.usureMin != null ? ` · ${String(etat.usureMin).replace(".", ",")}/32` : ""}{etat?.age != null ? ` · ${etat.age} an${etat.age > 1 ? "s" : ""}` : ""}
        </div>
        {depuis && <div style={{ fontSize: 12, color: "var(--avertissement)", fontWeight: 700, marginTop: 2 }}>À l&apos;entrepôt depuis le {DATE.format(new Date(entre || jeu.creeLe))}</div>}
      </div>
      <Icone nom="chevron" taille={16} />
    </Link>
  );
}

// Plan de l'entrepôt : chaque rangée et ses places, colorées selon la saison
// du jeu qui l'occupe ; une place libre mène au nouveau jeu, à cette place.
// filtre : la recherche, qui fait ressortir les places correspondantes.
function PlanEntrepot({ occupation, etats, filtre, peutRegler, onRegler }) {
  if (!occupation.rangees.length) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14, padding: 16, fontSize: 13.5 }}>
        <b>Aucun plan de l&apos;entrepôt.</b>
        <p style={{ margin: "6px 0 10px", color: "var(--text-muted)" }}>
          Inscrivez vos rangées (ex. A : 24 places, B : 24 places) : le plan montre les places libres et occupées, les formulaires proposent une place libre, et une place déjà prise est refusée.
        </p>
        {peutRegler ? <button type="button" onClick={onRegler} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Définir le plan</button>
          : <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Un gérant le définit dans Entreposage de pneus → Réglages.</span>}
      </div>
    );
  }
  const presentes = Object.keys(COULEURS_SAISON).filter((s) => occupation.rangees.some((r) => r.cases.some((c) => c.jeux.some((j) => j.saison === s))));
  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13.5 }}>
          <b>{occupation.occupees} / {occupation.total} places occupées</b>
          <span style={{ color: "var(--text-muted)" }}>{pluriel(occupation.libres, "place libre", "places libres")} · {Math.round((occupation.occupees / Math.max(1, occupation.total)) * 100)} %</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden", margin: "6px 0 8px" }}>
          <div style={{ height: "100%", width: `${(occupation.occupees / Math.max(1, occupation.total)) * 100}%`, background: "var(--bleu)" }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: "var(--text-muted)" }}>
          {presentes.map((s) => <Legende key={s} couleur={COULEURS_SAISON[s].couleur}>{SAISONS[s].libelle}</Legende>)}
          <Legende couleur="var(--danger)" rond>À remplacer</Legende>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, border: "1.5px dashed var(--border)", display: "inline-block" }} />Libre (toucher pour y inscrire un jeu)</span>
        </div>
      </div>

      {occupation.rangees.map((r) => {
        const occupees = r.cases.filter((c) => c.jeux.length).length;
        return (
          <div key={r.code} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 6px" }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>Rangée {r.code}{r.nom ? ` — ${r.nom}` : ""}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{occupees} / {r.cases.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 96px), 1fr))", gap: 6 }}>
              {r.cases.map((c) => <CasePlan key={c.nom} place={c} etats={etats} filtre={filtre} />)}
            </div>
          </div>
        );
      })}

      {occupation.horsPlan.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px", fontSize: 13 }}>
          <b>Hors plan ({occupation.horsPlan.length})</b>
          <span style={{ color: "var(--text-muted)" }}> — à un emplacement qui n&apos;est pas au plan : </span>
          {[...occupation.horsPlan].sort(parEmplacement).map((j, i) => (
            <span key={j.id}>{i > 0 && ", "}<Link href={`/pneus/${j.id}`} style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>{j.emplacement}</Link> ({j.numero}, {j.client.nom})</span>
          ))}
        </div>
      )}
    </div>
  );
}

function CasePlan({ place, etats, filtre }) {
  const [jeu, ...autres] = place.jeux;
  const attenue = filtre && !(jeu && place.jeux.some(filtre));
  const base = { display: "flex", flexDirection: "column", gap: 1, minWidth: 0, minHeight: 58, borderRadius: 9, padding: "6px 7px", textDecoration: "none", color: "var(--text)", position: "relative", opacity: attenue ? 0.3 : 1 };
  if (!jeu) {
    return (
      <Link href={`/pneus/nouveau?emplacement=${encodeURIComponent(place.nom)}`} title={`${place.nom} : libre — inscrire un jeu ici`} style={{ ...base, border: "1.5px dashed var(--border)", background: "transparent" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>{place.nom}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Libre</span>
      </Link>
    );
  }
  const c = COULEURS_SAISON[jeu.saison] || COULEURS_SAISON.QUATRE_SAISONS;
  const remplacer = place.jeux.some((j) => etats.get(j.id)?.code === "REMPLACER");
  return (
    <Link href={`/pneus/${jeu.id}`} title={`${place.nom} : ${jeu.numero} · ${jeu.client.nom} · ${libelleJeu(jeu)}${remplacer ? " · à remplacer" : ""}`} style={{ ...base, border: "1px solid var(--border)", borderLeft: `4px solid ${c.couleur}`, background: c.fond }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{place.nom}{autres.length ? <span style={{ color: "var(--danger)" }}> +{autres.length}</span> : null}</span>
      <span style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{jeu.client.nom}</span>
      <span style={{ fontSize: 10.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{jeu.numero}{jeu.dimension ? ` · ${jeu.dimension}` : ""}</span>
      {remplacer && <span aria-label="À remplacer" style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: 999, background: "var(--danger)" }} />}
    </Link>
  );
}

function Legende({ couleur, rond = false, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: rond ? 999 : 3, background: couleur, display: "inline-block" }} />{children}
    </span>
  );
}

// Jeux à remplacer (usure, âge, pneu endommagé) : des pneus neufs à proposer
function ARemplacer({ jeux, etats, nomEntreprise }) {
  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Jeux notés à remplacer selon l&apos;usure, l&apos;âge (code DOT) ou un pneu endommagé — seuils dans Réglages. Le rappel de changement de saison le mentionne aussi au client.
      </p>
      {jeux.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>Aucun jeu à remplacer.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jeux.map((j) => {
            const etat = etats.get(j.id);
            return (
              <div key={j.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "4px solid var(--danger)", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link href={`/pneus/${j.id}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0 }}>{j.client.nom}</Link>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{j.numero} · {j.statut === "ENTREPOSE" ? `entrepôt ${j.emplacement}` : "sur le véhicule"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {j.vehicule ? `${libelleVehicule(j.vehicule)} · ` : ""}{libelleJeu(j)}{j.marque ? ` · ${j.marque}` : ""} · {JANTES[j.jantes]}
                </div>
                <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 700, marginTop: 2 }}>{etat.raisons.join(" · ")}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                  {j.client.telephone && <a href={`tel:${j.client.telephone}`} style={petitBouton}>📞 {j.client.telephone}</a>}
                  <BoutonTexto
                    telephone={j.client.telephone} libelle="💬 Texto" style={{ ...petitBouton, cursor: "pointer" }} type="RAPPEL" clientId={j.client.id}
                    message={() => MESSAGES_TEXTO.pneusARemplacer({ nom: j.client.nom, libelle: libelleJeuMinuscule(j), raison: etat.raisons.join(", ").toLowerCase(), nomEntreprise })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Changement de saison qui vient : les clients dont les pneus de cette
// saison sont à l'entrepôt, à rappeler par courriel ou par texto
function Rappels({ aVenir, jeux, etats, restants, nomEntreprise, courrielPret, onRappeles }) {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const sansCourriel = (j) => !String(j.client.courriel || "").trim() || !!j.client.promotionsRefuseesLe;
  const aCourrieller = restants.filter((j) => !sansCourriel(j));

  async function envoyer(ids) {
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/pneus/rappels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "courriel", jeuIds: ids }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Envoi impossible : vérifie la connexion et réessaie.", erreur: true });
    const rates = new Set((data.echecs || []).map((e) => e.a));
    onRappeles(jeux.filter((j) => ids.includes(j.id) && !sansCourriel(j) && !rates.has(j.client.courriel)).map((j) => j.id));
    setMessage({ texte: `${data.envoyes} courriel${data.envoyes > 1 ? "s" : ""} envoyé${data.envoyes > 1 ? "s" : ""}${data.echecs?.length ? `, ${data.echecs.length} refusé${data.echecs.length > 1 ? "s" : ""}` : ""}.` });
  }

  async function texto(jeu) {
    await fetch("/api/pneus/rappels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "texto", jeuId: jeu.id }) }).catch(() => null);
    onRappeles([jeu.id]);
    return MESSAGES_TEXTO.pneus({
      nom: jeu.client.nom, hiver: aVenir.saison === "HIVER", vehicule: jeu.vehicule ? libelleVehicule(jeu.vehicule) : "",
      remplacer: etats.get(jeu.id)?.code === "REMPLACER", nomEntreprise,
    });
  }

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{aVenir.titre} — {aVenir.echeance}</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 10px" }}>
          Les clients dont les pneus {SAISONS[aVenir.saison].deSaison} sont à l&apos;entrepôt. Le courriel porte le lien de prise de rendez-vous des rappels d&apos;entretien
          (Clients → Rappels d&apos;entretien) et un lien de désabonnement ; un jeu noté à remplacer y est signalé, avec l&apos;offre d&apos;une soumission. Le texto part de votre téléphone.
        </p>
        {courrielPret ? (
          <button
            type="button" disabled={enCours || !aCourrieller.length} onClick={() => envoyer(aCourrieller.map((j) => j.id))} className="bouton-3d"
            style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: aCourrieller.length ? "pointer" : "default", opacity: aCourrieller.length ? 1 : 0.55 }}
          >
            {enCours ? "Envoi…" : `📧 Envoyer le courriel aux ${aCourrieller.length} à rappeler`}
          </button>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--avertissement)" }}>L&apos;envoi de courriel n&apos;est pas configuré : rappelez par texto ou par téléphone.</div>
        )}
        {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 13, margin: "8px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
      </div>

      {jeux.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>Aucun jeu {SAISONS[aVenir.saison].deSaison} à l&apos;entrepôt.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jeux.map((j) => {
            const rappele = dejaRappele(j, aVenir);
            return (
              <div key={j.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link href={`/pneus/${j.id}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0 }}>{j.client.nom}</Link>
                  <PastilleEtat etat={etats.get(j.id)} bonAussi={false} />
                  {rappele
                    ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Rappelé le {DATE.format(new Date(j.rappelLe))}</Pastille>
                    : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">À rappeler</Pastille>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {j.vehicule ? `${libelleVehicule(j.vehicule)} · ` : ""}{libelleJeu(j)} · {j.numero} · emplacement {j.emplacement || "—"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                  {j.client.telephone && <a href={`tel:${j.client.telephone}`} style={petitBouton}>📞 {j.client.telephone}</a>}
                  <BoutonTexto telephone={j.client.telephone} message={() => texto(j)} libelle="💬 Texto" style={{ ...petitBouton, cursor: "pointer" }} type="RAPPEL" clientId={j.client.id} />
                  {courrielPret && !sansCourriel(j) && (
                    <button type="button" disabled={enCours} onClick={() => envoyer([j.id])} style={{ ...petitBouton, cursor: "pointer" }}>📧 Courriel</button>
                  )}
                  {sansCourriel(j) && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{j.client.promotionsRefuseesLe ? "Désabonné des courriels" : "Pas de courriel au dossier"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Réglages (accès « Paramètres ») : prix de l'entreposage, plan de
// l'entrepôt, seuils de l'état d'un jeu et conditions du reçu
function Reglages({ reglages, onEnregistre }) {
  const texte = (n) => (n == null ? "" : String(n).replace(".", ","));
  const [prix, setPrix] = useState(texte(reglages.prixSaison));
  const [rangees, setRangees] = useState(() => reglages.plan.rangees.map((r) => ({ code: r.code, nom: r.nom || "", places: String(r.places) })));
  const [seuils, setSeuils] = useState(() => Object.fromEntries(Object.entries(reglages.seuils).map(([k, v]) => [k, texte(v)])));
  const [conditions, setConditions] = useState(reglages.conditionsPersonnalisees ? reglages.conditions : "");
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const changerRangee = (i, cle, valeur) => setRangees((rs) => rs.map((r, k) => (k === i ? { ...r, [cle]: valeur } : r)));
  function ajouterRangee() {
    const pris = new Set(rangees.map((r) => r.code.toUpperCase()));
    const code = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !pris.has(l)) || "";
    setRangees((rs) => [...rs, { code, nom: "", places: rs.at(-1)?.places || "24" }]);
  }

  async function enregistrer(e) {
    e.preventDefault();
    setMessage(null);
    setEnCours(true);
    const res = await fetch("/api/pneus/reglages", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prixSaison: prix, plan: { rangees }, seuils, conditions }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Rien n'a été enregistré.", erreur: true });
    setMessage({ texte: "Réglages enregistrés." });
    setRangees(data.plan.rangees.map((r) => ({ code: r.code, nom: r.nom || "", places: String(r.places) })));
    onEnregistre(data);
  }

  return (
    <form onSubmit={enregistrer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={panneau}>
        <h2 style={titrePanneau}>Prix de l&apos;entreposage</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5 }}>
          Un jeu, par saison
          <ChampArgent negatif={false} value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="ex. 80,00 $" className="champ" style={{ width: 110, fontSize: 14, textAlign: "right" }} />
        </label>
        <p style={aide}>Ajouté au bon lors d&apos;un changement de saison (poste « Entreposage de pneus »), avant taxes, et inscrit sur le reçu. Vide : aucune ligne ajoutée.</p>
      </section>

      <section style={panneau}>
        <h2 style={titrePanneau}>Plan de l&apos;entrepôt</h2>
        <p style={{ ...aide, margin: "0 0 10px" }}>
          Une ligne par rangée (ou étagère) : son code et son nombre de places. Les places se nomment code-numéro (A-01, A-02…), comme les étiquettes à poser sur les étagères.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rangees.length > 0 && (
            <div style={{ ...ligneRangee, fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700 }}>
              <span style={{ width: 52 }}>Code</span><span style={{ flex: 1 }}>Nom (facultatif)</span><span style={{ width: 64, textAlign: "right" }}>Places</span><span style={{ width: 32 }} />
            </div>
          )}
          {rangees.map((r, i) => {
            const n = Math.round(Number(r.places));
            const apercu = r.code && n >= 1 && n <= 500 ? emplacementsRangee({ code: r.code.toUpperCase().replace(/[^A-Z0-9]/g, ""), places: n }) : null;
            return (
              <div key={i}>
                <div style={ligneRangee}>
                  <input value={r.code} onChange={(e) => changerRangee(i, "code", e.target.value.toUpperCase())} placeholder="A" aria-label="Code de la rangée" className="champ" style={{ width: 52, flexShrink: 0, fontSize: 14, fontWeight: 800, textAlign: "center", padding: "8px 4px" }} />
                  <input value={r.nom} onChange={(e) => changerRangee(i, "nom", e.target.value)} placeholder="Mezzanine, conteneur…" aria-label="Nom de la rangée" className="champ" style={{ flex: 1, minWidth: 0, fontSize: 14 }} />
                  <input value={r.places} onChange={(e) => changerRangee(i, "places", e.target.value)} inputMode="numeric" aria-label="Nombre de places" className="champ" style={{ width: 64, flexShrink: 0, fontSize: 14, textAlign: "right" }} />
                  <button type="button" onClick={() => setRangees((rs) => rs.filter((_, k) => k !== i))} aria-label={`Retirer la rangée ${r.code}`} style={{ ...petitBouton, width: 32, height: 32, padding: 0, flexShrink: 0, cursor: "pointer" }}>✕</button>
                </div>
                {apercu && <div style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "2px 0 0 2px" }}>{apercu[0]} à {apercu.at(-1)}</div>}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={ajouterRangee} style={{ ...petitBouton, cursor: "pointer", marginTop: 8 }}>+ Rangée</button>
        <p style={aide}>Un jeu peut rester à un emplacement hors plan (il paraît sous le plan). Une place déjà prise par un autre jeu est refusée.</p>
      </section>

      <section style={panneau}>
        <h2 style={titrePanneau}>État d&apos;un jeu</h2>
        <p style={{ ...aide, margin: "0 0 10px" }}>
          Calculé avec le pneu le plus usé et le plus vieux (code DOT). 2/32 po est la limite légale ; à 4/32 po, un pneu d&apos;hiver a perdu l&apos;essentiel de son adhérence sur la neige.
          Les fabricants conseillent de faire vérifier un pneu chaque année passé 5 ou 6 ans, et de le remplacer à 10 ans.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 8 }}>
          {[
            ["usureRemplacer", "À remplacer : usure de", "/32 po ou moins", ETATS_JEU.REMPLACER],
            ["usureSurveiller", "À surveiller : usure de", "/32 po ou moins", ETATS_JEU.SURVEILLER],
            ["ageRemplacer", "À remplacer : pneus de", "ans ou plus", ETATS_JEU.REMPLACER],
            ["ageSurveiller", "À surveiller : pneus de", "ans ou plus", ETATS_JEU.SURVEILLER],
          ].map(([cle, avant, apres, e]) => (
            <label key={cle} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: e.couleur, flexShrink: 0 }} />
              {avant}
              <input value={seuils[cle]} onChange={(ev) => setSeuils((s) => ({ ...s, [cle]: ev.target.value }))} inputMode="decimal" className="champ" style={{ width: 56, fontSize: 14, textAlign: "right" }} />
              {apres}
            </label>
          ))}
        </div>
      </section>

      <section style={panneau}>
        <h2 style={titrePanneau}>Conditions du reçu d&apos;entreposage</h2>
        <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={5} placeholder={CONDITIONS_RECU_DEFAUT} className="champ" style={{ fontSize: 13.5, width: "100%", resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }} />
        <p style={aide}>Imprimées au bas du reçu remis au client. Vide : le texte par défaut (en gris) — à relire et adapter à votre atelier.</p>
      </section>

      {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 13, margin: 0, color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
        {enCours ? "Enregistrement…" : "Enregistrer les réglages"}
      </button>
    </form>
  );
}

// Liste de l'entrepôt en CSV (Excel), pour un inventaire sur papier ou
// l'assureur
function exporterCsv(jeux, etats) {
  const cellule = (v) => {
    const t = String(v ?? "");
    return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lignes = [
    ["Emplacement", "Numéro", "Client", "Téléphone", "Véhicule", "Plaque", "Saison", "Dimension", "Marque", "Modèle", "Quantité", "Jantes", "Usure (/32 po)", "Fabrication", "État", "Entré le"],
    ...jeux.map((j) => [
      j.emplacement, j.numero, j.client.nom, j.client.telephone, j.vehicule ? libelleVehicule(j.vehicule) : "", j.vehicule?.plaque, SAISONS[j.saison]?.libelle,
      j.dimension, j.marque, j.modele, j.quantite, JANTES[j.jantes], j.usure, j.anneeFabrication, ETATS_JEU[etats.get(j.id)?.code]?.libelle,
      entreLe(j) ? new Date(entreLe(j)).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" }) : "",
    ]),
  ];
  const csv = lignes.map((l) => l.map(cellule).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `entrepot-pneus-${new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const puce = (actif) => ({
  fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 999, cursor: "pointer",
  border: `1px solid ${actif ? "var(--text)" : "var(--border)"}`, background: actif ? "var(--text)" : "var(--surface)", color: actif ? "var(--bg)" : "var(--text)",
});
const petitBouton = { fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", textDecoration: "none" };
const panneau = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" };
const ligneRangee = { display: "flex", gap: 6, alignItems: "center" };
const titrePanneau = { fontSize: 14.5, fontWeight: 800, margin: "0 0 6px" };
const aide = { fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" };
