"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../components/BandeauSection";
import { Icone, TEINTES } from "../components/StyleSection";
import {
  argent, dateLisible, trouver, periodeLisible, bailActuel, nomsLocataires, etatExpiration, rendement, tauxOccupation, loyerDuMois, echeanceReleve31,
  aSurveillerBail, aSurveillerEntretien, etatRetard, libelle, CATEGORIES_DOCUMENTS, TYPES_IMMEUBLE, STATUTS_REPARATION,
} from "@/lib/immobilierCalculs";
import { NavImmo, Panneau, Vide, PastilleEtat, nomLogement, lien, TableauRendement } from "./ui";
import LoyersParMois from "./LoyersParMois";

// Niveaux de la liste « À faire » (aSurveillerBail, lib/immobilierCalculs.js)
const NIVEAUX = [
  { couleur: "var(--danger)", label: "Urgent" },
  { couleur: "var(--avertissement)", label: "À faire" },
  { couleur: "var(--bleu)", label: "À prévoir" },
];
const A_FAIRE_VISIBLES = 8;

export default function TableauBordClient({ releve31, courriel, immeubles, comptes, reparations, documents, bauxFactures, nbLocataires, donnees, periode, serie, reglagesAuto, dernierAuto, entretiens = [] }) {
  const logements = immeubles.flatMap((i) => i.logements.map((l) => ({ ...l, immeuble: i })));
  const vacants = logements.filter((l) => !bailActuel(l));
  const baux = logements.filter((l) => bailActuel(l)).map((l) => ({ ...bailActuel(l), logement: l, compte: comptes[bailActuel(l).id] }));
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

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🏘️" titre="Immobilier" sousTitre={`${immeubles.length} immeuble${immeubles.length > 1 ? "s" : ""} · ${logements.length} logement${logements.length > 1 ? "s" : ""} · ${nbLocataires} locataire${nbLocataires > 1 ? "s" : ""} · ${argent(revenuMensuel)} de loyers par mois`} />
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
          href="/immobilier/reparations" icone="outils" teinte={urgentes.length > 0 ? TEINTES.rouge : TEINTES.neutre} label="Réparations ouvertes" valeur={String(reparations.length)}
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

      <AFaire items={aFaire} />

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
    <Link href={href} className="tuile-immo" style={{ position: "relative", overflow: "hidden", display: "block", textDecoration: "none", color: "inherit", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "13px 14px 13px 18px" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte.couleur }} />
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: teinte.fond, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icone nom={icone} taille={15} couleur={teinte.couleur} />
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
