"use client";

import { useState } from "react";
import Link from "next/link";
import { Icone, TEINTES } from "../components/StyleSection";
import {
  argent, dateLisible, trouver, periodeLisible, bailActuel, nomsLocataires, etatExpiration, rendement, tauxOccupation, loyerDuMois, echeanceReleve31,
  aSurveillerBail, aSurveillerEntretien, etatRetard, libelle, CATEGORIES_DOCUMENTS, TYPES_IMMEUBLE, STATUTS_REPARATION,
} from "@/lib/immobilierCalculs";
import { NavImmo, Panneau, Vide, PastilleEtat, nomLogement, lien, TableauRendement } from "./ui";
import LoyersParMois from "./LoyersParMois";
import { RueImmo, CielImmo, VOILES } from "./RueImmo";
import { CarteImmeuble, GrilleImmeubles, LegendeEtats, infosLogements } from "./CartesImmeubles";
import { CONSEILS_MOIS } from "@/lib/immobilierVisuel";

// Violet de la marque Immobilier
const TEINTE_IMMO = { couleur: "var(--immo)", fond: "var(--immo-fond)" };

// Niveaux de la liste « À faire » (aSurveillerBail, lib/immobilierCalculs.js)
const NIVEAUX = [
  { couleur: "var(--danger)", label: "Urgent" },
  { couleur: "var(--avertissement)", label: "À faire" },
  { couleur: "var(--bleu)", label: "À prévoir" },
];
const A_FAIRE_VISIBLES = 8;

export default function TableauBordClient({ releve31, courriel, visuel, vueRue, immeubles, comptes, reparations, documents, bauxFactures, nbLocataires, donnees, periode, serie, reglagesAuto, dernierAuto, entretiens = [], bauxOfficiels = {} }) {
  const logements = immeubles.flatMap((i) => i.logements.map((l) => ({ ...l, immeuble: i })));
  const vacants = logements.filter((l) => !bailActuel(l));
  const baux = logements.filter((l) => bailActuel(l)).map((l) => ({ ...bailActuel(l), logement: l, compte: comptes[bailActuel(l).id], bailOfficiel: bauxOfficiels[bailActuel(l).id] }));
  const revenuMensuel = baux.reduce((s, b) => s + b.loyer, 0);
  const manqueAGagner = vacants.reduce((s, l) => s + (l.loyerVise || 0), 0);

  // Retards : seulement les montants dont l'échéance est passée (baux terminés compris)
  const enRetard = Object.entries(comptes).filter(([, c]) => c.enRetard > 0.005).map(([id, c]) => ({ id, compte: c, bail: baux.find((b) => b.id === id) }));
  const totalRetard = enRetard.reduce((s, r) => s + r.compte.enRetard, 0);
  const plusDeTroisSemaines = enRetard.filter((r) => r.compte.tal).length;
  const bauxEnRetard = baux.filter((b) => b.compte?.enRetard > 0.005).sort((a, b) => b.compte.joursRetard - a.compte.joursRetard);
  const anciensEnRetard = enRetard.length - bauxEnRetard.length;

  // Ce mois-ci : loyers attendus et paiements reçus
  const ceMois = serie[serie.length - 1] || { facture: 0, percu: 0 };
  const attendu = ceMois.facture || baux.reduce((s, b) => s + loyerDuMois(b, periode), 0);
  const encaisse = Math.min(1, attendu > 0 ? ceMois.percu / attendu : 0);
  const aFacturer = baux.filter((b) => loyerDuMois(b, periode) > 0 && !bauxFactures.includes(b.id));
  const urgentes = reparations.filter((r) => r.priorite === "URGENTE");

  const aFaire = listeAFaire({ baux, aFacturer, periode, releve31, urgentes, documents, entretiens, loyersAuto: reglagesAuto.loyersAuto });

  const { lignes, total } = rendement({ immeubles, ...donnees });
  const annee = periode.slice(0, 4);
  const valeur = immeubles.reduce((s, i) => s + (i.valeurEstimee || 0), 0);
  const dette = immeubles.reduce((s, i) => s + (i.soldeHypotheque || 0), 0);
  const moisLisible = periodeLisible(periode).split(" ")[0];
  const infos = infosLogements(immeubles, comptes);
  const netDe = Object.fromEntries(lignes.map((l) => [l.id, l.net]));
  const reparationsDe = {};
  for (const r of reparations) reparationsDe[r.immeubleId] = (reparationsDe[r.immeubleId] || 0) + 1;

  return (
    <div className="conteneur-page">
      <HeroImmo
        visuel={visuel} immeubles={immeubles} infos={infos} nbLogements={logements.length} nbLocataires={nbLocataires}
        percu={ceMois.percu} attendu={attendu} encaisse={encaisse} moisLisible={moisLisible} totalRetard={totalRetard} occupation={tauxOccupation(logements)}
      />
      {immeubles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "6px 14px", margin: "0 4px 14px" }}>
          <LegendeEtats infos={infos} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Une fenêtre par logement · touche un immeuble pour l'ouvrir</span>
        </div>
      )}
      <NavImmo actif="/immobilier" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 16 }}>
        <Tuile
          href="/immobilier/loyers?onglet=PAIEMENTS" icone="banque" teinte={TEINTES.vert} label={`Encaissé en ${moisLisible}`} valeur={argent(ceMois.percu)}
          note={attendu > 0 ? `sur ${argent(attendu)} de loyers du mois` : "aucun loyer inscrit ce mois-ci"}
          jauge={attendu > 0 ? encaisse : null}
        />
        <Tuile
          href="/immobilier/loyers?onglet=RETARDS" icone="alerte" teinte={totalRetard > 0 ? TEINTES.rouge : TEINTES.vert} label="En retard" valeur={argent(totalRetard)}
          couleur={totalRetard > 0 ? "var(--danger)" : undefined}
          note={enRetard.length === 0 ? "tout est payé à temps" : `${enRetard.length} ${enRetard.length > 1 ? "baux" : "bail"}${plusDeTroisSemaines ? ` · ${plusDeTroisSemaines} depuis plus de 3 sem.` : ""}`}
        />
        <Tuile
          href="#vacants" icone="maison" teinte={vacants.length > 0 ? TEINTES.ambre : TEINTES.bleu} label="Occupation" valeur={`${String(tauxOccupation(logements)).replace(".", ",")} %`}
          note={vacants.length === 0 ? "aucun logement vacant" : `${vacants.length} vacant${vacants.length > 1 ? "s" : ""}${manqueAGagner > 0 ? ` · ${argent(manqueAGagner)} / mois` : ""}`}
        />
        <Tuile
          href="/immobilier/reparations" icone="outils" teinte={urgentes.length > 0 ? TEINTES.rouge : TEINTE_IMMO} label="Réparations ouvertes" valeur={String(reparations.length)}
          note={urgentes.length > 0 ? `${urgentes.length} urgente${urgentes.length > 1 ? "s" : ""}` : "aucune urgente"}
        />
      </div>

      {immeubles.length === 0 && (
        <Panneau icone="drapeau" titre="Pour commencer">
          <ol style={{ fontSize: 13.5, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Ajoute tes <Link href="/immobilier/immeubles" style={lien}>immeubles</Link>, puis leurs logements et locaux.</li>
            <li>Sur la fiche de chaque logement loué, crée le bail : locataires, loyer, durée, services inclus.</li>
            <li>Chaque mois, les loyers s'inscrivent dans <Link href="/immobilier/loyers" style={lien}>Loyers</Link> (à la main ou tout seuls : <Link href="/immobilier/automatisations" style={lien}>Automatisations</Link>) ; inscris les paiements reçus.</li>
            <li>Note les <Link href="/immobilier/depenses" style={lien}>dépenses</Link> (taxes, assurance, intérêts…) pour suivre le rendement de chaque immeuble.</li>
            <li>Dépose les baux signés, avis et polices d'assurance dans <Link href="/immobilier/documents" style={lien}>Documents</Link>.</li>
          </ol>
        </Panneau>
      )}

      <ConseilDuMois conseil={CONSEILS_MOIS[visuel.mois - 1]} mois={moisLisible} />

      <AFaire items={aFaire} />

      {immeubles.length > 0 && (
        <Panneau
          icone="immeuble" teinte={TEINTE_IMMO} titre="Mes immeubles"
          sousTitre={`${argent(revenuMensuel)} de loyers par mois · ${nbLocataires} locataire${nbLocataires > 1 ? "s" : ""}`}
          droite={<Link href="/immobilier/immeubles" style={{ fontSize: 12.5, fontWeight: 700, ...lien }}>Tous</Link>}
        >
          <GrilleImmeubles>
            {immeubles.map((i) => (
              <CarteImmeuble
                key={i.id} immeuble={i} infos={infos} comptes={comptes} moment={visuel.moment} saison={visuel.saison} vueRue={vueRue}
                net={netDe[i.id]} annee={annee} reparations={reparationsDe[i.id]}
              />
            ))}
          </GrilleImmeubles>
        </Panneau>
      )}

      {immeubles.length > 0 && (
        <Panneau icone="graphique" teinte={TEINTES.bleu} titre="Loyers des 12 derniers mois" sousTitre="Loyers inscrits pour chaque mois et paiements reçus pendant le mois">
          <LoyersParMois mois={serie} />
        </Panneau>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", columnGap: 16, alignItems: "start" }}>
        <Panneau
          icone="alerte" teinte={bauxEnRetard.length > 0 ? TEINTES.rouge : TEINTES.vert} titre="Loyers en retard"
          sousTitre={enRetard.length ? `${argent(totalRetard)} au total` : "Échéance passée et impayée"}
          droite={<Link href="/immobilier/loyers?onglet=RETARDS" style={{ fontSize: 12.5, fontWeight: 700, ...lien }}>Détail</Link>}
        >
          {enRetard.length === 0 ? <Vide>Tous les loyers échus sont payés.</Vide> : (
            <>
              {bauxEnRetard.slice(0, 6).map((b) => (
                <Link key={b.id} href={`/immobilier/baux/${b.id}`} style={{ ...ligneLien, alignItems: "flex-start" }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 700 }}>{nomsLocataires(b)}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", margin: "1px 0 5px" }}>{b.logement.immeuble.nom} · {nomLogement(b.logement)} · depuis le {dateLisible(b.compte.depuis)}</span>
                    <PastilleEtat etat={etatRetard(b.compte)} />
                  </span>
                  <span style={{ fontWeight: 800, color: "var(--danger)", flexShrink: 0 }}>{argent(b.compte.enRetard)}</span>
                </Link>
              ))}
              {anciensEnRetard > 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>et {anciensEnRetard > 1 ? `${anciensEnRetard} anciens baux (terminés)` : "un ancien bail (terminé)"} avec un montant en retard.</p>}
            </>
          )}
        </Panneau>
        <Panneau
          id="vacants" icone="maison" teinte={vacants.length > 0 ? TEINTES.ambre : TEINTES.vert} titre="Logements vacants"
          sousTitre={vacants.length ? `Manque à gagner : ${argent(manqueAGagner)} par mois` : "Tout est loué"}
        >
          {vacants.length === 0 ? <Vide>Aucun logement vacant.</Vide> : vacants.map((l) => (
            <Link key={l.id} href={`/immobilier/logements/${l.id}`} style={ligneLien}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 700 }}>{nomLogement(l)}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{l.immeuble.nom}</span>
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 13, flexShrink: 0 }}>{l.loyerVise ? `${argent(l.loyerVise)} / mois` : "loyer à fixer"}</span>
            </Link>
          ))}
        </Panneau>
      </div>

      <Panneau icone="tendance" teinte={TEINTES.vert} titre={`Rendement ${annee}`} sousTitre="Loyers perçus moins dépenses et réparations" droite={<Link href="/immobilier/depenses" style={{ fontSize: 12.5, fontWeight: 700, ...lien }}>Dépenses</Link>}>
        {lignes.length === 0 ? <Vide>Aucun immeuble.</Vide> : (
          <TableauRendement lignes={lignes} total={total} icones={Object.fromEntries(immeubles.map((i) => [i.id, trouver(TYPES_IMMEUBLE, i.type)?.icone]))} />
        )}
        {valeur > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
            <span>Valeur estimée du parc : <strong style={{ color: "var(--text)" }}>{argent(valeur)}</strong></span>
            <span>Hypothèques : <strong style={{ color: "var(--text)" }}>{argent(dette)}</strong></span>
            <span>Avoir net : <strong style={{ color: "var(--text)" }}>{argent(valeur - dette)}</strong></span>
            <span>Chiffres tirés des loyers, dépenses et réparations inscrits ici (sans lien avec la comptabilité).</span>
          </div>
        )}
      </Panneau>

      <Automatisations reglages={reglagesAuto} dernier={dernierAuto} courriel={courriel} />
    </div>
  );
}

const ligneLien = { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: "1px solid var(--border)", textDecoration: "none", color: "inherit", fontSize: 13.5 };

// Tuile chiffrée cliquable : bande de couleur, icône, chiffre, note, jauge facultative (0 à 1)
function Tuile({ href, icone, teinte, label, valeur, note, couleur, jauge }) {
  return (
    <Link href={href} className="tuile-immo" style={{ position: "relative", overflow: "hidden", display: "block", textDecoration: "none", color: "inherit", background: `linear-gradient(150deg, ${teinte.fond} 0%, var(--surface) 78%)`, border: "1px solid var(--border)", borderRadius: 16, padding: "13px 14px" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: teinte.couleur, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 8px rgba(0,0,0,0.12)" }}>
          <Icone nom={icone} taille={16} couleur="#fff" />
        </span>
        <span style={{ minWidth: 0 }}>{label}</span>
      </span>
      <span style={{ display: "block", fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: "8px 0 2px", color: couleur || "var(--text)" }}>{valeur}</span>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>{note}</span>
      {jauge != null && (
        <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(jauge * 100)} aria-label="Part des loyers du mois encaissée" style={{ display: "block", height: 6, borderRadius: 3, background: "var(--success-fond)", marginTop: 8 }}>
          <span style={{ display: "block", height: 6, borderRadius: 3, width: `${Math.round(jauge * 100)}%`, background: "var(--success)" }} />
        </span>
      )}
    </Link>
  );
}

// Tout ce qui demande une action, du plus urgent au moins pressé
function listeAFaire({ baux, aFacturer, periode, releve31, urgentes, documents, entretiens, loyersAuto }) {
  const items = [];
  if (aFacturer.length > 0) {
    items.push({
      cle: "loyers", niveau: 1, href: "/immobilier/loyers", quoi: `Loyers de ${periodeLisible(periode)} à inscrire`,
      detail: `${aFacturer.length} ${aFacturer.length > 1 ? "baux" : "bail"}${loyersAuto ? "" : " — ou laisse-les s'inscrire tout seuls le 1er (Automatisations)"}`,
    });
  }
  if (releve31 && releve31.aProduire > 0) {
    items.push({
      cle: "releve31", niveau: Number(periode.slice(5, 7)) === 2 ? 0 : 1, href: `/immobilier/releve-31?annee=${releve31.annee}`, quoi: `Relevés 31 de ${releve31.annee} à produire`,
      detail: `${releve31.aProduire} sur ${releve31.total}, à remettre aux locataires d'ici le ${dateLisible(echeanceReleve31(releve31.annee))}`,
    });
  }
  for (const b of baux) {
    for (const s of aSurveillerBail(b, b.compte)) items.push({ ...s, lieu: `${b.logement.immeuble.nom} · ${nomLogement(b.logement)} — ${nomsLocataires(b)}` });
  }
  for (const r of urgentes) {
    items.push({
      cle: `rep:${r.id}`, niveau: 0, href: `/immobilier/reparations/${r.id}`, quoi: `Réparation urgente : ${r.titre}`,
      lieu: `${r.immeuble?.nom || ""}${r.logement ? ` · ${nomLogement(r.logement)}` : " · parties communes"}`, detail: `${r.numero} · ${libelle(STATUTS_REPARATION, r.statut).toLowerCase()}${r.entrepreneur ? ` · ${r.entrepreneur}` : ""}`,
    });
  }
  for (const en of entretiens) {
    const s = aSurveillerEntretien(en);
    if (s) items.push({ ...s, lieu: en.immeuble?.nom });
  }
  for (const d of documents) {
    const e = etatExpiration(d.expireLe);
    if (!e || e.code === "OK") continue;
    items.push({
      cle: `doc:${d.id}`, niveau: e.code === "EXPIRE" ? 0 : 1, href: "/immobilier/documents", quoi: `${trouver(CATEGORIES_DOCUMENTS, d.categorie)?.icone || "📄"} ${d.titre}`,
      lieu: d.immeuble?.nom, detail: e.label,
    });
  }
  return items.sort((a, b) => a.niveau - b.niveau);
}

function AFaire({ items }) {
  const [tout, setTout] = useState(false);
  const urgents = items.filter((i) => i.niveau === 0).length;
  const affiches = tout ? items : items.slice(0, A_FAIRE_VISIBLES);
  return (
    <Panneau
      icone={items.length ? "liste" : "crochet"} teinte={urgents ? TEINTES.rouge : items.length ? TEINTES.ambre : TEINTES.vert} titre="À faire"
      sousTitre={items.length === 0 ? "Rien ne demande d'action pour le moment" : `${items.length} élément${items.length > 1 ? "s" : ""}${urgents ? ` · ${urgents} urgent${urgents > 1 ? "s" : ""}` : ""} — baux, loyers, réparations, entretien, assurances`}
    >
      {affiches.map((i) => {
        const n = NIVEAUX[i.niveau];
        return (
          <Link key={i.cle} href={i.href} style={ligneLien}>
            <span title={n.label} aria-label={n.label} style={{ width: 9, height: 9, borderRadius: 999, background: n.couleur, flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700 }}>{i.quoi}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{[i.lieu, i.detail].filter(Boolean).join(" · ")}</span>
            </span>
            <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
          </Link>
        );
      })}
      {items.length > A_FAIRE_VISIBLES && (
        <button type="button" onClick={() => setTout((x) => !x)} style={{ background: "none", border: "none", padding: "10px 0 0", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>
          {tout ? "Moins" : `Tout voir (${items.length})`}
        </button>
      )}
    </Panneau>
  );
}

const dateHeure = (d) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(d));

// État des automatisations (lib/immobilierAuto.js)
function Automatisations({ reglages, dernier, courriel }) {
  const lignes = [
    [reglages.loyersAuto, "Loyers inscrits tout seuls le 1er du mois"],
    [reglages.rappelRetard && courriel, `Rappel par courriel aux locataires en retard (${reglages.joursRappel} j après l'échéance)`],
    [reglages.avisProprio, "Avis au propriétaire (cloche et téléphone)"],
  ];
  return (
    <Panneau
      icone="reglages" teinte={TEINTES.neutre} titre="Automatisations"
      sousTitre={dernier?.le ? `Dernière vérification : ${dateHeure(dernier.le)}` : "Une vérification par jour, entre 8 h et 18 h"}
      droite={<Link href="/immobilier/automatisations" style={{ fontSize: 12.5, fontWeight: 700, ...lien }}>Régler</Link>}
    >
      {lignes.map(([actif, texte]) => (
        <div key={texte} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", color: actif ? "var(--text)" : "var(--text-muted)" }}>
          <Icone nom={actif ? "crochet" : "bloque"} taille={16} couleur={actif ? "var(--success)" : "var(--text-muted)"} />
          <span>{texte}{actif ? "" : " — inactif"}</span>
        </div>
      ))}
    </Panneau>
  );
}

const majuscule = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

// En-tête du tableau de bord : le ciel du moment, la salutation, les loyers
// du mois, et la rue du parc (RueImmo.js) — chaque immeuble mène à sa fiche
function HeroImmo({ visuel, immeubles, infos, nbLogements, nbLocataires, percu, attendu, encaisse, moisLisible, totalRetard, occupation }) {
  const tout = attendu > 0 && encaisse >= 0.999;
  const phrase = immeubles.length === 0
    ? "Bienvenue ! Ajoute ton premier immeuble : il apparaîtra ici, dans ta rue."
    : tout
      ? `Tous les loyers de ${moisLisible} sont encaissés. Beau travail ! 🎉`
      : attendu > 0
        ? `${majuscule(moisLisible)} : ${argent(percu)} encaissés sur ${argent(attendu)}${totalRetard > 0.005 ? ` · ${argent(totalRetard)} en retard` : ""}`
        : `Aucun loyer inscrit pour ${moisLisible} pour le moment.`;
  const puce = { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", whiteSpace: "nowrap" };
  return (
    <section style={{ position: "relative", overflow: "hidden", borderRadius: 20, marginBottom: 8, border: "1px solid var(--border)", boxShadow: "0 12px 30px rgba(40, 20, 90, 0.18)" }}>
      <CielImmo moment={visuel.moment} saison={visuel.saison} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: VOILES[visuel.moment] || VOILES.jour }} />
      <div style={{ position: "relative", padding: "18px 20px 6px", color: "#fff", textShadow: "0 1px 10px rgba(10,5,30,0.35)" }}>
        <span style={{ ...puce, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textShadow: "none" }}>🏘️ IMMOBILIER</span>
        <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: "10px 0 4px", color: "#fff" }}>{visuel.salutation}{visuel.prenom ? ` ${visuel.prenom}` : ""}</h1>
        <p style={{ margin: 0, fontSize: 14.5, maxWidth: 520, color: "rgba(255,255,255,0.95)" }}>{phrase}</p>
        {attendu > 0 && (
          <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(encaisse * 100)} aria-label={`Loyers de ${moisLisible} encaissés`} style={{ width: "min(100%, 380px)", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.22)", marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(encaisse * 100)}%`, borderRadius: 999, background: tout ? "linear-gradient(90deg, #7ee2a0, #3fc47a)" : "linear-gradient(90deg, #ffd36b, #ff9a5a)" }} />
          </div>
        )}
        {immeubles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 600, textShadow: "none" }}>
            <span style={puce}>🏘️ {immeubles.length} immeuble{immeubles.length > 1 ? "s" : ""}</span>
            <span style={puce}>🚪 {nbLogements} logement{nbLogements > 1 ? "s" : ""}</span>
            <span style={puce}>👥 {nbLocataires} locataire{nbLocataires > 1 ? "s" : ""}</span>
            <span style={puce}>✨ {String(occupation).replace(".", ",")} % occupé</span>
          </div>
        )}
      </div>
      <div style={{ position: "relative", marginTop: 4 }}>
        <RueImmo immeubles={immeubles} infos={infos} moment={visuel.moment} saison={visuel.saison} hrefDe={(i) => `/immobilier/immeubles/${i.id}`} />
      </div>
      {immeubles.length > 6 && (
        <Link href="/immobilier/immeubles" style={{ position: "absolute", right: 12, bottom: 10, fontSize: 12, fontWeight: 800, color: "#fff", background: "rgba(16,10,44,0.55)", padding: "4px 10px", borderRadius: 999, textDecoration: "none" }}>
          + {immeubles.length - 6} autre{immeubles.length - 6 > 1 ? "s" : ""}
        </Link>
      )}
    </section>
  );
}

// Rappel du calendrier du propriétaire au Québec (lib/immobilierVisuel.js)
function ConseilDuMois({ conseil, mois }) {
  if (!conseil) return null;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 16, marginBottom: 16, background: "linear-gradient(120deg, var(--immo-fond), rgba(240,150,90,0.12))", border: "1px solid var(--border)" }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, background: "linear-gradient(135deg, #6c45c0, #ec8a5c)", boxShadow: "0 3px 8px rgba(80,40,140,0.25)" }}>💡</span>
      <div style={{ minWidth: 0, fontSize: 13.5 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--immo)" }}>En {mois}, chez les proprios</div>
        <div style={{ marginTop: 2 }}>
          {conseil.texte}
          {conseil.href && <> <Link href={conseil.href} style={{ fontWeight: 700, ...lien }}>{conseil.lien} →</Link></>}
        </div>
      </div>
    </div>
  );
}
