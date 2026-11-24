"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import {
  TYPES_IMMEUBLE, CATEGORIES_DEPENSE, argent, libelle, trouver, dateLisible, bailActuel, nomsLocataires, etatFinBail, rendement, tauxOccupation, STATUTS_REPARATION_OUVERTS,
  etatEcheance, frequenceLisible, TYPES_ENTRETIEN, TYPES_LOGEMENT,
} from "@/lib/immobilierCalculs";
import { champsImmeuble } from "../ImmeublesClient";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, Vide, valeursDe, aujourdhui, Statistique,
  champsLogement, champsDepense, FormulaireReparation, FormulaireDocument, ListeDocuments, ListeReparations, PastilleEtat, Solde, lien, LigneMouvement,
} from "../../ui";

export default function ImmeubleClient({ immeuble, soldes, comptes, donnees, annee, locataires }) {
  const type = trouver(TYPES_IMMEUBLE, immeuble.type);
  const { lignes } = rendement({ immeubles: [immeuble], ...donnees });
  const r = lignes[0];
  const baux = immeuble.logements.map(bailActuel).filter(Boolean);
  const loyers = baux.reduce((s, b) => s + b.loyer, 0);
  return (
    <div className="conteneur-page">
      <Retour href="/immobilier/immeubles">Immeubles</Retour>
      <h1 style={{ fontSize: 21, margin: "10px 0 14px" }}>{type?.icone} {immeuble.nom}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={argent(loyers)} label="Loyers par mois" note={`${argent(loyers * 12)} par année`} teinte="var(--success)" />
        <Statistique valeur={`${String(tauxOccupation(immeuble.logements)).replace(".", ",")} %`} label={`Occupation · ${immeuble.logements.length} logement${immeuble.logements.length > 1 ? "s" : ""}`} teinte="var(--bleu)" />
        <Statistique valeur={argent(r.net)} label={`Net ${annee} (perçu − dépenses)`} teinte={r.net < 0 ? "var(--danger)" : "var(--success)"} />
        {immeuble.valeurEstimee > 0 && <Statistique valeur={argent(immeuble.valeurEstimee - (immeuble.soldeHypotheque || 0))} label="Avoir net (valeur − hypothèque)" teinte="var(--accent)" />}
      </div>
      <Fiche immeuble={immeuble} />
      <Logements immeuble={immeuble} soldes={soldes} comptes={comptes} />
      <Rendement r={r} annee={annee} />
      <Depenses immeuble={immeuble} />
      <Reparations immeuble={immeuble} locataires={locataires} />
      <Entretien immeuble={immeuble} />
      <Documents immeuble={immeuble} />
    </div>
  );
}

function Fiche({ immeuble }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  return (
    <Section titre="Fiche" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <Formulaire cadre={false} champs={champsImmeuble} initial={valeursDe(immeuble, champsImmeuble)} url={`/api/immobilier/immeubles/${immeuble.id}`} methode="PATCH" onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/immobilier/immeubles/${immeuble.id}`} confirmation={`Supprimer ${immeuble.nom} ? Ses dépenses, réparations et documents disparaissent aussi.`} onFini={() => router.push("/immobilier/immeubles")}>Supprimer l'immeuble</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          <LigneInfo label="Adresse" valeur={[immeuble.adresse, immeuble.ville, immeuble.codePostal].filter(Boolean).join(", ")} />
          <LigneInfo label="Type" valeur={libelle(TYPES_IMMEUBLE, immeuble.type)} />
          <LigneInfo label="Construit en" valeur={immeuble.anneeConstruction} />
          {immeuble.entrepreneur && <LigneInfo label="Construit par" valeur={immeuble.entrepreneur} />}
          <LigneInfo label="Acheté le" valeur={immeuble.dateAchat && dateLisible(immeuble.dateAchat)} />
          <LigneInfo label="Prix d'achat" valeur={immeuble.prixAchat != null && argent(immeuble.prixAchat)} />
          <LigneInfo label="Évaluation municipale" valeur={immeuble.evaluationMunicipale != null && argent(immeuble.evaluationMunicipale)} />
          <LigneInfo label="Valeur estimée" valeur={immeuble.valeurEstimee != null && argent(immeuble.valeurEstimee)} />
          <LigneInfo label="Solde de l'hypothèque" valeur={immeuble.soldeHypotheque != null && argent(immeuble.soldeHypotheque)} />
          {immeuble.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{immeuble.notes}</p>}
        </>
      )}
    </Section>
  );
}

// Étage lisible et rang pour le plan : le haut de l'immeuble d'abord, le
// rez-de-chaussée puis le sous-sol en bas. Texte libre dans la fiche du
// logement (« RC », « 2 », « Sous-sol »…).
function etageDe(etage) {
  const t = (etage || "").trim();
  if (!t) return null;
  const bas = t.toLowerCase();
  if (/^(sous|ss\b|s-s|-)/.test(bas)) return { rang: -1, label: "Sous-sol" };
  if (/^(rc|rdc|rez|0$)/.test(bas)) return { rang: 0, label: "Rez-de-chaussée" };
  const n = parseInt(bas, 10);
  if (Number.isFinite(n)) return { rang: n, label: `Étage ${n}` };
  return { rang: 0.5, label: t };
}

const comparerNumeros = (a, b) => a.numero.localeCompare(b.numero, "fr", { numeric: true });

// Logements regroupés par étage, du haut vers le bas ; sans étage noté
// nulle part, un seul groupe sans titre
function etagesDe(logements) {
  if (!logements.some((l) => etageDe(l.etage))) return [{ cle: "tous", label: null, logements: [...logements].sort(comparerNumeros) }];
  const groupes = new Map();
  for (const l of logements) {
    const e = etageDe(l.etage) || (l.type === "LOGEMENT" || l.type === "COMMERCIAL" ? { rang: -2, label: "Étage non indiqué" } : { rang: -3, label: "Autres espaces" });
    if (!groupes.has(e.label)) groupes.set(e.label, { cle: e.label, label: e.label, rang: e.rang, logements: [] });
    groupes.get(e.label).logements.push(l);
  }
  return [...groupes.values()].sort((a, b) => b.rang - a.rang).map((g) => ({ ...g, logements: g.logements.sort(comparerNumeros) }));
}

// État d'un logement sur le plan, du plus pressant au plus calme
const ETATS_PLAN = {
  RETARD: { label: "Loyer en retard", couleur: "var(--danger)" },
  VACANT: { label: "Vacant", couleur: "var(--avertissement)" },
  SURVEILLER: { label: "Bail à surveiller", couleur: "var(--bleu)" },
  OK: { label: "En règle", couleur: "var(--success)" },
};
const BAUX_A_SURVEILLER = ["ECHU", "AVIS_A_ENVOYER"];

function etatPlan(bail, compte) {
  if (!bail) return "VACANT";
  if ((compte?.enRetard || 0) > 0.005) return "RETARD";
  const fin = etatFinBail(bail);
  if (BAUX_A_SURVEILLER.includes(fin.code) || (fin.code === "AVIS_ENVOYE" && ["REFUSE", "QUITTE"].includes(bail.reponseAvis))) return "SURVEILLER";
  return "OK";
}

function CaseLogement({ logement: l, bail: b, compte, solde, etat }) {
  const e = ETATS_PLAN[etat];
  const fin = b && etatFinBail(b);
  const type = trouver(TYPES_LOGEMENT, l.type);
  const muet = { fontSize: 12, color: "var(--text-muted)" };
  return (
    <div className="case-logement" style={{ position: "relative", border: "1px solid var(--border)", borderLeft: `4px solid ${e.couleur}`, borderRadius: 10, padding: "9px 10px 10px", background: "var(--surface-alt)", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
        <Link href={`/immobilier/logements/${l.id}`} className="lien-etire" style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)", textDecoration: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {l.type !== "LOGEMENT" && `${type?.icone || ""} `}{l.numero}
        </Link>
        {l.pieces && <span style={{ ...muet, flexShrink: 0 }}>{l.pieces}</span>}
      </div>
      {b ? (
        <Link href={`/immobilier/baux/${b.id}`} style={{ position: "relative", zIndex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="Ouvrir le bail">
          {nomsLocataires(b) || "Locataire à inscrire"}
        </Link>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 700, color: e.couleur }}>Vacant</span>
      )}
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        {b ? `${argent(b.loyer)} / mois` : l.loyerVise ? <span style={{ fontWeight: 400, ...muet }}>Demandé {argent(l.loyerVise)}</span> : <span style={{ fontWeight: 400, ...muet }}>Loyer à fixer</span>}
      </span>
      {b && <span style={muet}>{b.dateFin ? `Fin ${dateLisible(b.dateFin)}` : "Durée indéterminée"}</span>}
      {(etat === "RETARD" || (b && Math.abs(solde || 0) > 0.005)) && <span style={{ fontSize: 12.5 }}><Solde solde={solde} compte={compte} /></span>}
      {fin && etat === "SURVEILLER" && <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: fin.couleur }}>{fin.label}</span>}
    </div>
  );
}

function Logements({ immeuble, soldes, comptes }) {
  const [ajout, setAjout] = useState(false);
  const etats = Object.fromEntries(immeuble.logements.map((l) => {
    const b = bailActuel(l);
    return [l.id, etatPlan(b, b && comptes[b.id])];
  }));
  const presents = Object.keys(ETATS_PLAN).filter((k) => Object.values(etats).includes(k));
  const groupes = etagesDe(immeuble.logements);
  return (
    <Section
      titre="Plan de l'immeuble"
      icone="immeuble"
      droite={<span style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>{immeuble.logements.some((l) => l.type === "LOGEMENT" && bailActuel(l)) && <Link href={`/immobilier/immeubles/${immeuble.id}/hausses`} style={{ fontSize: 12, fontWeight: 700, ...lien }}>🧮 Hausses</Link>}<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Logement"}</BoutonTexte></span>}
    >
      {ajout && <Formulaire champs={champsLogement()} extra={{ immeubleId: immeuble.id }} url="/api/immobilier/logements" bouton="Ajouter le logement" onFini={() => setAjout(false)} />}
      {immeuble.logements.length === 0 ? <Vide>Aucun logement : ajoute les logements et locaux de l'immeuble.</Vide> : (
        <>
          {presents.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              {presents.map((k) => (
                <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: ETATS_PLAN[k].couleur, display: "inline-block" }} />
                  {ETATS_PLAN[k].label} ({Object.values(etats).filter((x) => x === k).length})
                </span>
              ))}
            </div>
          )}
          {groupes.map((g) => (
            <div key={g.cle} style={{ marginBottom: 12 }}>
              {g.label && <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-muted)", margin: "4px 0 6px" }}>{g.label}</div>}
              <div className="plan-immeuble">
                {g.logements.map((l) => {
                  const b = bailActuel(l);
                  return <CaseLogement key={l.id} logement={l} bail={b} compte={b && comptes[b.id]} solde={b && soldes[b.id]} etat={etats[l.id]} />;
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </Section>
  );
}

function Rendement({ r, annee }) {
  return (
    <Section titre={`Rendement ${annee}`}>
      <LigneInfo label="Loyers facturés" valeur={argent(r.facture)} />
      <LigneInfo label="Loyers perçus" valeur={argent(r.percu)} />
      <LigneInfo label="Dépenses" valeur={`− ${argent(r.depenses)}`} />
      <LigneInfo label="Réparations terminées" valeur={`− ${argent(r.reparations)}`} />
      <div className="ligne-info" style={{ fontWeight: 800 }}><span>Revenu net</span><span style={{ color: r.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(r.net)}</span></div>
    </Section>
  );
}

function Depenses({ immeuble }) {
  const [ajout, setAjout] = useState(false);
  const champs = champsDepense();
  return (
    <Section titre="Dernières dépenses" droite={<span style={{ display: "flex", gap: 12 }}><Link href={`/immobilier/depenses?immeuble=${immeuble.id}`} style={{ fontSize: 12, ...lien }}>Tout voir</Link><BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Dépense"}</BoutonTexte></span>}>
      {ajout && <Formulaire champs={champs} initial={{ date: aujourdhui() }} extra={{ immeubleId: immeuble.id }} url="/api/immobilier/depenses" bouton="Ajouter la dépense" onFini={() => setAjout(false)} />}
      {immeuble.depenses.length === 0 ? <Vide>Aucune dépense inscrite.</Vide> : immeuble.depenses.slice(0, 10).map((d) => (
        <LigneMouvement
          key={d.id}
          titre={<>{trouver(CATEGORIES_DEPENSE, d.categorie)?.icone} {d.description || libelle(CATEGORIES_DEPENSE, d.categorie)}</>}
          detail={[dateLisible(d.date), d.payeA].filter(Boolean).join(" · ")}
          montant={argent(d.montant)}
        />
      ))}
    </Section>
  );
}

// Prochains entretiens préventifs de l'immeuble (page Entretien préventif)
function Entretien({ immeuble }) {
  const liste = immeuble.entretiens || [];
  return (
    <Section titre="Entretien préventif" droite={<Link href={`/immobilier/entretien?immeuble=${immeuble.id}`} style={{ fontSize: 12, ...lien }}>{liste.length ? "Tout voir" : "Planifier"}</Link>}>
      {liste.length === 0 ? <Vide>Aucun entretien planifié : avertisseurs de fumée, ramonage, gouttières, chauffe-eau… se planifient dans Entretien préventif.</Vide> : liste.slice(0, 5).map((e) => {
        const etat = etatEcheance(e.prochaineDate);
        return (
          <Link key={e.id} href={`/immobilier/entretien?immeuble=${immeuble.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
            <span style={{ minWidth: 0 }}>{trouver(TYPES_ENTRETIEN, e.type)?.icone} {e.titre}{e.obligatoire && " ⚖️"} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {dateLisible(e.prochaineDate)} · {frequenceLisible(e.frequenceMois).toLowerCase()}</span></span>
            <PastilleEtat etat={etat} />
          </Link>
        );
      })}
    </Section>
  );
}

function Reparations({ immeuble, locataires }) {
  const [ajout, setAjout] = useState(false);
  const ouvertes = immeuble.reparations.filter((r) => STATUTS_REPARATION_OUVERTS.includes(r.statut));
  const fermees = immeuble.reparations.filter((r) => !STATUTS_REPARATION_OUVERTS.includes(r.statut));
  return (
    <Section titre="Réparations" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Réparation"}</BoutonTexte>}>
      {ajout && <FormulaireReparation immeubles={[immeuble]} locataires={locataires} fixe={{ immeubleId: immeuble.id }} />}
      <ListeReparations reparations={ouvertes} vide="Aucune réparation ouverte." lieu="logement" />
      {fermees.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--text-muted)" }}>Historique ({fermees.length})</summary>
          <ListeReparations reparations={fermees} lieu="logement" />
        </details>
      )}
    </Section>
  );
}

function Documents({ immeuble }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Documents" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Document"}</BoutonTexte>}>
      {ajout && <FormulaireDocument fixe={{ immeubleId: immeuble.id }} categorie="ASSURANCE" onFini={() => setAjout(false)} />}
      <ListeDocuments documents={immeuble.documents} />
    </Section>
  );
}
