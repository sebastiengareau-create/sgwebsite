"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HeroRue, { ConseilDuMois } from "../components/HeroRue";
import TuileVive from "../components/TuileVive";
import { FermeIllustree } from "../components/FermeIllustree";
import { CONSEILS_MOIS_FERME, ETATS_BETE, betesPourFerme, prochainVelage, echantillonFerme } from "@/lib/elevageVisuel";
import { correspondRecherche } from "@/lib/recherche";
import { nombre } from "@/lib/format";
import { Icone, BoutonPlein, Pastille, TEINTES } from "../components/StyleSection";
import {
  SEXES, GENETIQUES, STATUTS_BETE, libelle, age, dernierePesee, coutBete, revenusBete,
  carcasseDepuisVif, argent, kg, dateLisible, TYPES_SOIN, retraitEnCours, rappelsAFaire, joursAvant, velagePrevu, saillieEnCours, sousLaCible, nomBete,
  CATEGORIES_TROUPEAU, categorieBete, abattagePrevu, enCroissance, gmqRecent, estimerDecoupe, totauxDecoupe,
} from "@/lib/elevageCalculs";
import ScanElevage from "./ScanElevage";
import { formaterBoucle, emplacement } from "@/lib/registreElevage";
import { champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, Onglets, NavElevage, useApi, DeuxColonnes } from "./ui";
import ChampArgent from "@/app/components/ChampArgent";

const FILTRES = [
  { code: "ACTIVE", label: "Au troupeau" },
  { code: "ABATTUE", label: "Abattues" },
  { code: "SORTIES", label: "Vendues / mortes" },
  { code: "TOUTES", label: "Toutes" },
];

// Vert de la marque Ferme
const TEINTE_FERME = { couleur: "var(--ferme)", fond: "var(--ferme-fond)" };

export default function TroupeauClient({ betes, rendementCarcasse, gmqCible, poidsAbattage, coupes, viande, visuel }) {
  const router = useRouter();
  const [filtre, setFiltre] = useState("ACTIVE");
  const [recherche, setRecherche] = useState("");
  const [formulaire, setFormulaire] = useState(false);
  const [categorie, setCategorie] = useState(null); // filtre du portrait, parmi les bêtes au troupeau

  const q = recherche.trim().toLowerCase();
  const affichees = betes.filter((b) => {
    if (categorie && filtre === "ACTIVE" && categorieBete(b) !== categorie) return false;
    if (filtre === "SORTIES" ? !["VENDUE", "MORTE"].includes(b.statut) : filtre !== "TOUTES" && b.statut !== filtre) return false;
    return !q || correspondRecherche(q, b.numero, b.nom, b.identifiant, formaterBoucle(b.identifiant), b.mere?.numero, b.mere?.nom, emplacement(b.deplacements)?.lieu);
  });

  const actives = betes.filter((b) => b.statut === "ACTIVE");
  const poidsVif = actives.reduce((s, b) => s + (dernierePesee(b.pesees)?.poids || 0), 0);
  const investi = actives.reduce((s, b) => s + coutBete(b), 0);
  const femelles = betes.filter((b) => b.sexe === "FEMELLE" && b.statut === "ACTIVE");
  const taureaux = betes.filter((b) => b.sexe === "TAUREAU");
  const carcasse = carcasseDepuisVif(poidsVif, rendementCarcasse);
  // Valeur en viande : chaque bête découpée selon les rendements, au prix boutique
  const valeurViande = actives.reduce((s, b) => s + totauxDecoupe(estimerDecoupe(carcasseDepuisVif(dernierePesee(b.pesees)?.poids, rendementCarcasse), coupes)).valeurBoutique, 0);
  const sansPesee = actives.filter((b) => !dernierePesee(b.pesees)).length;

  return (
    <div className="conteneur-page" style={{ maxWidth: 1100 }}>
      {visuel && <HeroFerme visuel={visuel} betes={betes} actives={actives} poidsVif={poidsVif} poidsAbattage={poidsAbattage} viande={viande} />}
      <NavElevage actif="/elevage" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>
          {formulaire ? "Annuler" : "Nouvelle bête"}
        </BoutonPlein>
        <ScanElevage />
      </div>
      {formulaire && <NouvelleBete femelles={femelles} taureaux={taureaux} onCree={(id) => router.push(`/elevage/${id}`)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 16 }}>
        <TuileVive href="#troupeau" icone="drapeau" teinte={TEINTE_FERME} label="Bêtes au troupeau" valeur={String(actives.length)} note={sansPesee > 0 ? `${sansPesee} sans pesée` : "toutes pesées"} />
        <TuileVive href="#troupeau" icone="tendance" teinte={TEINTES.bleu} label="Poids vif" valeur={kg(poidsVif, 0)} note={`≈ ${kg(carcasse, 0)} de carcasse (${rendementCarcasse} %)`} />
        <TuileVive href="#troupeau" icone="banque" teinte={TEINTES.ambre} label="Coût investi" valeur={argent(investi)} note="achats et frais des bêtes" />
        <TuileVive href="/elevage/viande" icone="graphique" teinte={TEINTES.vert} label="Valeur en viande" valeur={valeurViande > 0 ? argent(valeurViande) : "—"} note={valeurViande > 0 ? "si tout était abattu, au prix boutique" : "prix des coupes à fixer"} />
      </div>

      {visuel && <ConseilDuMois conseil={CONSEILS_MOIS_FERME[visuel.mois - 1]} etiquette={`En ${new Intl.DateTimeFormat("fr-CA", { month: "long", timeZone: "America/Toronto" }).format(new Date())}, à la ferme`} couleur="var(--ferme)" fond="var(--ferme-fond)" />}

      <Portrait betes={actives} choix={filtre === "ACTIVE" ? categorie : null} onChoix={(c) => { setFiltre("ACTIVE"); setCategorie((v) => (v === c ? null : c)); }} />

      <DeuxColonnes>
        <ASuivre betes={actives} gmqCible={gmqCible} />
        <VersAbattage betes={actives} poidsAbattage={poidsAbattage} />
      </DeuxColonnes>

      <div id="troupeau" style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
        </span>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, nom, boucle, mère, enclos…" style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12, background: "var(--surface)" }} />
      </div>
      <Onglets options={FILTRES} valeur={filtre} onChange={(f) => { setFiltre(f); setCategorie(null); }} />
      {categorie && filtre === "ACTIVE" && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
          {libelle(CATEGORIES_TROUPEAU, categorie)} seulement — <button type="button" onClick={() => setCategorie(null)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>voir tout le troupeau</button>
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((b) => <CarteBete key={b.id} bete={b} gmqCible={gmqCible} poidsAbattage={poidsAbattage} />)}
        {affichees.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune bête dans cette liste.</p>}
      </div>
    </div>
  );
}

// Portrait du troupeau : le nombre de bêtes de chaque catégorie. Toucher une
// case ne montre que ces bêtes dans la liste ; la toucher de nouveau, toutes.
function Portrait({ betes, choix, onChoix }) {
  if (betes.length === 0) return null;
  const gestantes = betes.filter((b) => (b.saillies || []).some((s) => s.statut === "GESTANTE")).length;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {CATEGORIES_TROUPEAU.map((c) => {
        const n = betes.filter((b) => categorieBete(b) === c.code).length;
        const actif = choix === c.code;
        return (
          <button
            key={c.code} type="button" onClick={() => onChoix(c.code)} disabled={n === 0} aria-pressed={actif}
            style={{
              flex: "1 1 96px", textAlign: "left", fontFamily: "inherit", cursor: n === 0 ? "default" : "pointer", padding: "10px 12px", borderRadius: 14, color: "var(--text)",
              background: actif ? "var(--ferme-fond)" : "var(--surface)", border: `1px solid ${actif ? "var(--ferme)" : "var(--border)"}`, opacity: n === 0 ? 0.55 : 1,
            }}
          >
            <span style={{ display: "block", fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{n}</span>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>{n > 1 ? c.label : c.singulier}</span>
            {c.code === "VACHE" && gestantes > 0 && <span style={{ display: "block", fontSize: 11.5, color: "var(--bleu)", fontWeight: 700, marginTop: 2 }}>{gestantes} gestante{gestantes > 1 ? "s" : ""}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Carte d'une bête : qui elle est (catégorie, génétique, âge, boucle), ce qui
// la concerne en pastilles (enclos, retrait, vêlage, croissance, abattage
// prévu), et à droite ses chiffres — le gain par jour seulement si elle est
// en croissance, le coût seulement s'il y en a un.
function CarteBete({ bete: b, gmqCible, poidsAbattage }) {
  const statut = STATUTS_BETE.find((s) => s.code === b.statut);
  const active = b.statut === "ACTIVE";
  const pesee = dernierePesee(b.pesees);
  const gmq = enCroissance(b) ? gmqRecent(b.pesees)?.gmq ?? null : null; // le gain récent, celui comparé à la cible
  const cout = coutBete(b);
  const revenus = revenusBete(b);
  const retrait = active ? retraitEnCours(b.soins) : null;
  const lente = sousLaCible(b, gmqCible);
  const ou = active ? emplacement(b.deplacements) : null;
  const gestation = active ? (b.saillies || []).find(saillieEnCours) : null;
  const prevu = abattagePrevu(b, poidsAbattage);
  const categorie = CATEGORIES_TROUPEAU.find((c) => c.code === categorieBete(b, b.dateSortie || new Date()));
  const sexe = libelle(SEXES, b.sexe).split(" (")[0];
  return (
    <Link href={`/elevage/${b.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: statut?.couleur || "var(--border)" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{b.numero}{b.nom && <span style={{ fontWeight: 600 }}> — {b.nom}</span>}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {[
              categorie?.code === "VEAU" ? `Veau · ${sexe.toLowerCase()}` : categorie?.singulier || sexe,
              b.genetique && `${libelle(GENETIQUES, b.genetique).split(" (")[0]}${b.pourcentageWagyu != null ? ` ${b.pourcentageWagyu} %` : ""}`,
              b.dateNaissance && age(b.dateNaissance, b.dateSortie || new Date()),
              b.identifiant && `🏷️ ${formaterBoucle(b.identifiant)}`,
            ].filter(Boolean).join(" · ")}
          </div>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {!active && statut && <Pastille couleur={statut.couleur} fond={`${statut.couleur}22`}>{statut.label}{b.dateSortie && ` le ${dateLisible(b.dateSortie)}`}</Pastille>}
            {ou && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">{ou.horsFerme ? "Hors ferme — " : ""}{ou.lieu}</Pastille>}
            {retrait && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">En retrait jusqu'au {dateLisible(retrait.fin)}</Pastille>}
            {gestation && <Pastille couleur="var(--bleu)" fond="var(--bleu-fond)">Vêlage prévu le {dateLisible(velagePrevu(gestation.date))}</Pastille>}
            {lente && <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">Croissance sous la cible</Pastille>}
            {prevu?.atteint && <Pastille couleur="var(--success)" fond="var(--success-fond)">Poids d'abattage atteint</Pastille>}
            {prevu?.date && <Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.16)">Abattage vers {moisAnnee(prevu.date)}</Pastille>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12.5 }}>
          {b.abattage ? (
            <div style={{ fontSize: 15, fontWeight: 800 }}>{kg(b.abattage.poidsCarcasse, 0)}<span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>carcasse{b.abattage.bms && ` · BMS ${b.abattage.bms}`}</span></div>
          ) : (
            pesee && <div style={{ fontSize: 15, fontWeight: 800 }}>{kg(pesee.poids, 0)}<span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>le {dateLisible(pesee.date)}</span></div>
          )}
          {gmq != null && <div style={{ color: "var(--text-muted)" }}>{nombre(gmq)} kg/jour</div>}
          {cout > 0 && <div style={{ color: "var(--text-muted)" }}>Coût {argent(cout)}</div>}
          {revenus > 0 && <div style={{ fontWeight: 700, color: revenus - cout >= 0 ? "var(--success)" : "var(--danger)" }}>Ventes {argent(revenus)}</div>}
        </div>
      </div>
    </Link>
  );
}

// « janv. 2027 » — une date prévue ne se donne pas au jour près
const moisAnnee = (d) => new Date(d).toLocaleDateString("fr-CA", { month: "short", year: "numeric", timeZone: "UTC" });

// Vers l'abattage : chaque bouvillon, son poids par rapport au poids visé et
// la date où il l'atteindra au rythme de son gain. Les plus avancés d'abord.
function VersAbattage({ betes, poidsAbattage }) {
  const lignes = betes.map((b) => ({ bete: b, prevu: abattagePrevu(b, poidsAbattage), retrait: retraitEnCours(b.soins) })).filter((l) => l.prevu)
    .sort((x, y) => y.prevu.part - x.prevu.part);
  if (lignes.length === 0) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>🥩 Vers l'abattage</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>Bouvillons — poids visé de {kg(poidsAbattage, 0)} (<Link href="/elevage/coupes" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>modifier</Link>)</div>
      {lignes.map(({ bete: b, prevu, retrait }, i) => {
        const jours = prevu.date ? joursAvant(prevu.date) : null;
        return (
          <Link key={b.id} href={`/elevage/${b.id}`} style={{ display: "block", padding: "9px 2px", textDecoration: "none", color: "var(--text)", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, fontSize: 13.5 }}>
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{nomBete(b)}</strong> · {kg(prevu.poids, 0)}</span>
              <span style={{ flexShrink: 0, fontWeight: 700, textAlign: "right", color: prevu.atteint ? "var(--success)" : "var(--text)" }}>
                {prevu.atteint ? "poids atteint" : !prevu.date ? "gain insuffisant" : jours <= 0 ? "à repeser — sans doute prêt" : `vers ${moisAnnee(prevu.date)}`}
              </span>
            </div>
            <div role="progressbar" aria-label={`Poids de ${nomBete(b)} par rapport au poids visé`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prevu.part * 100)} style={{ height: 8, borderRadius: 4, background: "var(--surface-alt)", overflow: "hidden", margin: "6px 0 3px" }}>
              <div style={{ width: `${prevu.part * 100}%`, height: "100%", borderRadius: 4, background: prevu.atteint ? "var(--success)" : "var(--accent)" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {prevu.atteint ? "prêt pour l'abattage" : `${Math.round(prevu.part * 100)} % du poids visé${prevu.gmq ? ` · ${nombre(prevu.gmq)} kg/jour${jours > 0 ? ` · dans ${jours} j` : ""}` : ""}`}
              {retrait && <strong style={{ color: "var(--danger)" }}> · en retrait jusqu'au {dateLisible(retrait.fin)}</strong>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// À suivre au troupeau : rappels de soins en retard ou dus d'ici 30 jours,
// délais de retrait en cours, vêlages attendus, et bêtes en croissance dont
// le gain récent est sous la cible
const HORIZON_RAPPELS = 30;

function ASuivre({ betes, gmqCible }) {
  const lignes = [
    ...betes.flatMap((b) => rappelsAFaire(b.soins).map((s) => ({ ...s, jours: joursAvant(s.rappelLe) })).filter((r) => r.jours <= HORIZON_RAPPELS).map((r) => ({
      cle: `rappel-${r.id}`, bete: b, ordre: r.jours, urgent: r.jours < 0,
      texte: `${libelle(TYPES_SOIN, r.type).split(" (")[0]}${r.produit ? ` — ${r.produit}` : ""}`,
      echeance: r.jours < 0 ? `en retard de ${-r.jours} j` : r.jours === 0 ? "aujourd'hui" : `dans ${r.jours} j`,
    }))),
    ...betes.flatMap((b) => (b.saillies || []).filter(saillieEnCours).map((s) => {
      const jours = joursAvant(velagePrevu(s.date));
      return {
        cle: `velage-${s.id}`, bete: b, ordre: jours, urgent: jours < 0,
        texte: `vêlage ${s.statut === "GESTANTE" ? "prévu" : "possible (gestation à confirmer)"}`,
        echeance: jours < 0 ? `dépassé de ${-jours} j` : `le ${dateLisible(velagePrevu(s.date))}`,
      };
    })),
    ...betes.map((b) => ({ b, retrait: retraitEnCours(b.soins) })).filter((x) => x.retrait).map(({ b, retrait }) => ({
      cle: `retrait-${b.id}`, bete: b, ordre: joursAvant(retrait.fin), urgent: true,
      texte: `en retrait${retrait.soin.produit ? ` (${retrait.soin.produit})` : ""}`, echeance: `jusqu'au ${dateLisible(retrait.fin)}`,
    })),
    ...betes.map((b) => ({ b, lente: sousLaCible(b, gmqCible) })).filter((x) => x.lente).map(({ b, lente }) => ({
      cle: `gain-${b.id}`, bete: b, ordre: 9999, urgent: false,
      texte: "croissance sous la cible", echeance: `${nombre(lente.gmq)} kg/jour (cible ${nombre(gmqCible)})`,
    })),
  ].sort((x, y) => x.ordre - y.ordre);
  if (lignes.length === 0) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>📋 À suivre</div>
      {lignes.map((l, i) => (
        <Link key={l.cle} href={`/elevage/${l.bete.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 2px", fontSize: 13.5, textDecoration: "none", color: "var(--text)", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{nomBete(l.bete)}</strong> · {l.texte}</span>
          <span style={{ flexShrink: 0, fontWeight: 700, textAlign: "right", color: l.urgent ? "var(--danger)" : "var(--text-muted)" }}>{l.echeance}</span>
        </Link>
      ))}
    </div>
  );
}

export const FICHE_VIDE = {
  nom: "", identifiant: "", sexe: "", genetique: "FULLBLOOD", pourcentageWagyu: "100", dateNaissance: "",
  origine: "NEE_ICI", dateAcquisition: "", provenance: "", coutAcquisition: "", mereId: "", pereId: "", pere: "", notes: "",
};

function NouvelleBete({ femelles, taureaux, onCree }) {
  const [fiche, setFiche] = useState({ ...FICHE_VIDE, poidsInitial: "" });
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function creer() {
    const data = await appeler("/api/elevage/betes", "POST", fiche);
    if (data) onCree(data.id);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <ChampsBete fiche={fiche} maj={maj} femelles={femelles} taureaux={taureaux} />
      <Champ label={fiche.origine === "ACHETEE" ? "Poids à l'arrivée (kg, facultatif)" : "Poids à la naissance (kg, facultatif)"}>
        <input inputMode="decimal" value={fiche.poidsInitial} onChange={maj("poidsInitial")} style={champStyle} />
      </Champ>
      <Erreur texte={erreur} />
      <button onClick={creer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Ajouter au troupeau"}</button>
    </div>
  );
}

// Champs de la fiche d'une bête — partagés avec la fiche détaillée
export function ChampsBete({ fiche, maj, femelles, taureaux = [] }) {
  return (
    <>
      <div style={grille2}>
        <Champ label="Sexe">
          <select value={fiche.sexe} onChange={maj("sexe")} style={champStyle}>
            <option value="">—</option>
            {SEXES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </Champ>
        <Champ label="Nom (facultatif)">
          <input value={fiche.nom} onChange={maj("nom")} style={champStyle} />
        </Champ>
        <Champ label="Boucle d'oreille ATQ (15 chiffres)">
          <input inputMode="numeric" placeholder="124 000 …" value={fiche.identifiant} onChange={maj("identifiant")} style={champStyle} />
        </Champ>
        <Champ label="Date de naissance">
          <input type="date" max="9999-12-31" value={fiche.dateNaissance} onChange={maj("dateNaissance")} style={champStyle} />
        </Champ>
        <Champ label="Génétique">
          <select value={fiche.genetique} onChange={maj("genetique")} style={champStyle}>
            <option value="">—</option>
            {GENETIQUES.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </select>
        </Champ>
        <Champ label="% wagyu">
          <input inputMode="decimal" value={fiche.pourcentageWagyu} onChange={maj("pourcentageWagyu")} style={champStyle} />
        </Champ>
        <Champ label="Mère">
          <select value={fiche.mereId} onChange={maj("mereId")} style={champStyle}>
            <option value="">— (inconnue ou hors troupeau)</option>
            {femelles.map((f) => <option key={f.id} value={f.id}>{f.numero}{f.nom ? ` — ${f.nom}` : ""}</option>)}
          </select>
        </Champ>
        <Champ label="Père (taureau du troupeau)">
          <select value={fiche.pereId} onChange={maj("pereId")} style={champStyle}>
            <option value="">— (de l'extérieur ou semence)</option>
            {taureaux.map((t) => <option key={t.id} value={t.id}>{t.numero}{t.nom ? ` — ${t.nom}` : ""}</option>)}
          </select>
        </Champ>
        {!fiche.pereId && (
          <Champ label="Père de l'extérieur ou semence">
            <input value={fiche.pere} onChange={maj("pere")} style={champStyle} />
          </Champ>
        )}
      </div>
      <label style={labelStyle}>Origine</label>
      <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 8 }}>
        {[["NEE_ICI", "Née ici"], ["ACHETEE", "Achetée"]].map(([code, texte]) => (
          <label key={code} style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={fiche.origine === code} onChange={() => maj("origine")({ target: { value: code } })} />
            {texte}
          </label>
        ))}
      </div>
      {fiche.origine === "ACHETEE" && (
        <div style={grille2}>
          <Champ label="Date d'achat">
            <input type="date" max="9999-12-31" value={fiche.dateAcquisition} onChange={maj("dateAcquisition")} style={champStyle} />
          </Champ>
          <Champ label="Coût d'achat (avant taxes)">
            <ChampArgent negatif={false} value={fiche.coutAcquisition} onChange={maj("coutAcquisition")} placeholder="0,00 $" style={champStyle} />
          </Champ>
          <Champ label="Achetée de">
            <input value={fiche.provenance} onChange={maj("provenance")} placeholder="Éleveur, encan…" style={champStyle} />
          </Champ>
        </div>
      )}
      <Champ label="Notes">
        <textarea value={fiche.notes} onChange={maj("notes")} rows={2} style={{ ...champStyle, resize: "vertical" }} />
      </Champ>
    </>
  );
}

// En-tête : le ciel du moment, la salutation, le troupeau en chiffres et la
// ferme illustrée — chaque bête mène à sa fiche
function HeroFerme({ visuel, betes, actives, poidsVif, poidsAbattage, viande }) {
  const surFerme = betesPourFerme(betes, poidsAbattage);
  // Grand troupeau (quelques centaines) : une scène représentative — 36 bêtes
  // sur un écran large, 12 sur un téléphone, les bêtes à surveiller d'abord
  const scenes = [["ferme-large", echantillonFerme(surFerme, 36)], ["ferme-etroite", echantillonFerme(surFerme, 12)]];
  const represente = scenes[0][1].autres > 0;
  const velage = prochainVelage(betes);
  const compte = {};
  for (const b of surFerme) compte[b.categorie] = (compte[b.categorie] || 0) + 1;
  const etats = {};
  for (const b of surFerme) if (b.etat) etats[b.etat] = (etats[b.etat] || 0) + 1;
  const mois = new Intl.DateTimeFormat("fr-CA", { month: "long", timeZone: "America/Toronto" }).format(new Date());
  const ou = { printemps: "au pâturage", ete: "au pâturage", automne: "aux champs", hiver: "à la ferme" }[visuel.saison] || "au troupeau";
  const phrase = actives.length === 0
    ? "Bienvenue ! Ajoute ta première bête : elle apparaîtra ici, dans le pâturage."
    : `${actives.length} bête${actives.length > 1 ? "s" : ""} ${ou} · ${kg(poidsVif, 0)} de poids vif${velage ? ` · ${velage.jours > 0 ? `prochain vêlage dans ${velage.jours} jour${velage.jours > 1 ? "s" : ""}` : "un vêlage est attendu"} (${nomBete(velage.bete)}) 🍼` : ""}`;
  const puces = [
    ...CATEGORIES_TROUPEAU.filter((c) => compte[c.code]).map((c) => `${{ VACHE: "🐄", GENISSE: "🐮", TAUREAU: "🐂", BOUVILLON: "🐃", VEAU: "🍼" }[c.code]} ${compte[c.code]} ${(compte[c.code] > 1 ? c.label : c.singulier).toLowerCase()}`),
    ...(viande?.paquetsEnStock ? [`🥩 ${viande.paquetsEnStock} paquets en stock`] : []),
    ...(viande?.ventesMois ? [`💰 ${argent(viande.ventesMois)} vendus en ${mois}`] : []),
  ];
  return (
    <>
      <HeroRue
        visuel={visuel} badge="🐂 FERME" phrase={phrase} puces={puces}
        scene={scenes.map(([classe, { visibles, autres }]) => (
          <div key={classe} className={classe}>
            <FermeIllustree betes={visibles} cle={classe} moment={visuel.moment} saison={visuel.saison} hrefDe={(b) => `/elevage/${b.id}`} />
            {autres > 0 && (
              <a href="#troupeau" style={{ position: "absolute", right: 12, top: 4, fontSize: 12, fontWeight: 800, color: "#fff", background: "rgba(16,30,16,0.6)", padding: "4px 10px", borderRadius: 999, textDecoration: "none" }}>
                + {autres} autre{autres > 1 ? "s" : ""} bête{autres > 1 ? "s" : ""} →
              </a>
            )}
          </div>
        ))}
      />
      {surFerme.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "6px 14px", margin: "0 4px 14px", fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
            {Object.entries(ETATS_BETE).filter(([code]) => etats[code]).map(([code, e]) => (
              <span key={code} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: e.couleur, color: "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{e.signe}</span>
                {e.label} ({etats[code]})
              </span>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 10, borderRadius: 2, background: "#f5c400" }} />Boucle ATQ</span>
          </span>
          <span>{represente ? "Le troupeau y est représenté, les bêtes à surveiller d'abord" : "Une bête par bête du troupeau"} · touche-la pour ouvrir sa fiche</span>
        </div>
      )}
    </>
  );
}
