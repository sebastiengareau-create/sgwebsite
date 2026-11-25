"use client";

// Éléments communs aux écrans de l'immobilier. Les briques génériques
// (formulaires décrits par une liste de champs, fichiers, cartes de liste…)
// sont celles de la copropriété ; seules les données diffèrent.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEINTES, TitrePanneau, stylePanneau } from "../components/StyleSection";
import {
  Formulaire, ChampsFormulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, Recherche, CarteListe, ListeFichiers, EnvoiFichiers,
  Retour, valeursDe, champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, useApi, Onglets, Statistique, Tableau, cellule, celluleDroite, aujourdhui,
} from "../copropriete/ui";
import {
  TYPES_LOGEMENT, SERVICES_BAIL, CATEGORIES_DOCUMENTS, CATEGORIES_REPARATION, PRIORITES, STATUTS_REPARATION, CATEGORIES_DEPENSE, MODES_PAIEMENT, TYPES_CHARGE,
  CHAUFFAGES, ANIMAUX, FUMEUR,
  servicesListe, trouver, dateLisible, argent, taille, etatExpiration, nomLogement, etatSignatures, STATUTS_SIGNATURE, REPONSES_AVIS, libelle,
} from "@/lib/immobilierCalculs";
import { formaterTelephone } from "@/lib/telephone";

export { nomLogement };

export {
  Formulaire, ChampsFormulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, Recherche, CarteListe, ListeFichiers, EnvoiFichiers,
  Retour, valeursDe, champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, useApi, Onglets, Statistique, Tableau, cellule, celluleDroite, aujourdhui,
};

// Icône et teinte d'une section d'après son titre, pour que tous les écrans
// de l'immobilier aient les panneaux à tuile d'icône du tableau de bord
const ICONES_SECTIONS = [
  [/suggestion|comment faire/i, "livre", TEINTES.neutre],
  [/retard/i, "alerte", TEINTES.rouge],
  [/rendement|revenu/i, "tendance", TEINTES.vert],
  [/loyer|compte|paiement|dépense/i, "banque", TEINTES.vert],
  [/renouvel|fin du bail/i, "echange", TEINTES.bleu],
  [/document|générer/i, "document", TEINTES.bleu],
  [/bail|baux/i, "presse", TEINTES.ambre],
  [/états? des lieux/i, "camera", TEINTES.ambre],
  [/réparation|entretien/i, "outils", TEINTES.ambre],
  [/photo/i, "camera", TEINTES.neutre],
  [/courriel/i, "courriel", TEINTES.bleu],
  [/portail/i, "globe", TEINTES.bleu],
  [/coordonnées|locataire/i, "personne", TEINTES.ambre],
  [/logement|immeuble|fiche/i, "immeuble", TEINTES.ambre],
  [/catégorie/i, "graphique", TEINTES.vert],
  [/modifier/i, "crayon", TEINTES.neutre],
];
function iconeDeTitre(titre) {
  const t = typeof titre === "string" ? titre : "";
  const trouve = ICONES_SECTIONS.find(([re]) => re.test(t));
  return trouve ? { icone: trouve[1], teinte: trouve[2] } : { icone: "liste", teinte: TEINTES.ambre };
}

// Section d'un écran de l'immobilier : panneau blanc, tuile d'icône (choisie
// d'après le titre, ou donnée), titre, sous-titre et actions à droite
export function Section({ titre, children, droite, id, icone, teinte, sousTitre }) {
  const defaut = iconeDeTitre(titre);
  return (
    <div id={id} style={stylePanneau}>
      <TitrePanneau icone={icone || defaut.icone} teinte={teinte || defaut.teinte} titre={titre} sousTitre={sousTitre} droite={droite} />
      {children}
    </div>
  );
}

// Rendement par immeuble (rendement(), lib/immobilierCalculs.js) : sur un
// téléphone, le nom et le net, puis les chiffres en dessous ; dès la
// tablette, des colonnes sous un en-tête (.ligne-rendement, app/globals.css).
// icones : { [immeubleId]: émoji } ; liens : nom vers la fiche de l'immeuble
export function TableauRendement({ lignes, total, icones = {}, liens = true }) {
  const rangee = (l, { gras = false, cle } = {}) => (
    <div key={cle || l.id} className="ligne-rendement" style={gras ? { fontWeight: 800 } : undefined}>
      <span className="nom">{liens && l.id ? <Link href={`/immobilier/immeubles/${l.id}`} style={lien}>{icones[l.id] ? `${icones[l.id]} ` : ""}{l.nom}</Link> : l.nom}</span>
      <span className="chiffres">
        <span className="percu"><em>Perçu </em>{argent(l.percu)}</span>
        <span className="depenses"><em>Dépenses </em>{argent(l.depenses)}</span>
        <span className="reparations"><em>Réparations </em>{argent(l.reparations)}</span>
      </span>
      <span className="net" style={{ color: l.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(l.net)}</span>
    </div>
  );
  return (
    <div>
      <div className="ligne-rendement ligne-rendement-entete" aria-hidden="true">
        <span className="nom">Immeuble</span>
        <span className="chiffres"><span className="percu">Loyers perçus</span><span className="depenses">Dépenses</span><span className="reparations">Réparations</span></span>
        <span className="net">Net</span>
      </div>
      {lignes.map((l) => rangee(l))}
      {total && lignes.length > 1 && rangee({ ...total, nom: "Total" }, { gras: true, cle: "total" })}
    </div>
  );
}

// Une ligne de liste qui tient sur un téléphone (.ligne-mouvement,
// app/globals.css) : à gauche le libellé et une ligne pâle, à droite le
// montant (et une 2e valeur pâle) ; les actions passent dessous sur un
// téléphone, en bout de ligne dès la tablette.
export function LigneMouvement({ titre, detail, montant, sousMontant, actions, couleurMontant }) {
  return (
    <div className="ligne-mouvement">
      <div className="quoi">
        <div className="titre">{titre}</div>
        {detail && <div className="detail">{detail}</div>}
      </div>
      <div className="montant">
        <div style={couleurMontant ? { color: couleurMontant } : undefined}>{montant}</div>
        {sousMontant && <div className="detail">{sousMontant}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

// Menu de l'immobilier : une rangée qui défile au doigt sur un téléphone (le
// contenu reste en haut de l'écran), 4 × 2 dès la tablette (.nav-section,
// app/globals.css). Sur téléphone, l'écran ouvert est ramené en vue.
export function NavImmo({ actif }) {
  const nav = useRef(null);
  useEffect(() => {
    const el = nav.current?.querySelector("[aria-current=page]");
    if (el && nav.current.scrollWidth > nav.current.clientWidth) nav.current.scrollLeft = el.offsetLeft - (nav.current.clientWidth - el.offsetWidth) / 2;
  }, [actif]);
  const liens = [
    { href: "/immobilier", label: "📊 Tableau de bord" },
    { href: "/immobilier/immeubles", label: "🏘️ Immeubles" },
    { href: "/immobilier/locataires", label: "👥 Locataires" },
    { href: "/immobilier/loyers", label: "💵 Loyers" },
    { href: "/immobilier/reparations", label: "🛠️ Réparations" },
    { href: "/immobilier/depenses", label: "📈 Dépenses" },
    { href: "/immobilier/releve-31", label: "🧾 Relevé 31" },
    { href: "/immobilier/documents", label: "📁 Documents" },
  ];
  return (
    <nav ref={nav} className="nav-section" aria-label="Immobilier">
      {liens.map((l) => {
        const estActif = l.href === actif;
        return (
          <Link
            key={l.href} href={l.href} aria-current={estActif ? "page" : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
              fontSize: 13.5, fontWeight: 700, padding: "10px 12px", borderRadius: 10, textDecoration: "none",
              background: estActif ? "var(--accent)" : "transparent", color: estActif ? "#221f18" : "var(--text-muted)",
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const lien = { color: "var(--accent)" };

// Interrupteur marche/arrêt (comme Administrateur → Modules)
export function Interrupteur({ actif, libelle, onClick, disabled, couleur = "var(--success)" }) {
  return (
    <button
      type="button" role="switch" aria-checked={actif} aria-label={libelle} onClick={onClick} disabled={disabled}
      style={{ width: 50, height: 30, borderRadius: 999, border: "none", position: "relative", flexShrink: 0, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, background: actif ? couleur : "var(--border)", transition: "background 0.15s" }}
    >
      <span style={{ position: "absolute", top: 3, left: actif ? 23 : 3, width: 24, height: 24, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.15s" }} />
    </button>
  );
}

// Panneau avec sa tuile d'icône (style des autres sections : Élevage, Paramètres…)
export function Panneau({ titre, icone = "liste", teinte = TEINTES.ambre, sousTitre, droite, children, id, style }) {
  return (
    <div id={id} style={{ ...stylePanneau, ...style }}>
      <TitrePanneau icone={icone} teinte={teinte} titre={titre} sousTitre={sousTitre} droite={droite} />
      {children}
    </div>
  );
}

export function Alerte({ children, couleur = "var(--danger)", fond = "var(--danger-fond)" }) {
  return (
    <div style={{ background: fond, border: `1px solid ${couleur}`, color: "var(--text)", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
      ⚠️ {children}
    </div>
  );
}

// Pastille d'un état calculé { label, couleur }
export function PastilleEtat({ etat }) {
  if (!etat) return null;
  return (
    <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: etat.couleur, background: `${etat.couleur}22`, whiteSpace: "nowrap", alignSelf: "center", flexShrink: 0 }}>
      {etat.label}
    </span>
  );
}

// « Immeuble · logement 4 » cliquables
export function LieuLogement({ logement, immeuble }) {
  const i = immeuble || logement?.immeuble;
  return (
    <>
      {i && <Link href={`/immobilier/immeubles/${i.id}`} style={lien}>{i.nom}</Link>}
      {logement && <>{i && " · "}<Link href={`/immobilier/logements/${logement.id}`} style={lien}>{nomLogement(logement)}</Link></>}
    </>
  );
}


// Solde d'un compte : rouge s'il est en retard, ambre s'il est seulement à
// recevoir (loyer pas encore échu), vert à jour ou en crédit.
// compte : etatCompte() — sans lui, tout solde dû est en rouge
export function Solde({ solde, court, compte }) {
  const s = Math.round((solde ?? compte?.solde ?? 0) * 100) / 100;
  if (compte && s > 0.005) {
    if (compte.enRetard > 0.005) {
      const titre = `${argent(compte.enRetard)} en retard depuis ${compte.joursRetard} j${compte.aRecevoir > 0.005 ? ` · ${argent(compte.aRecevoir)} à recevoir` : ""}`;
      return (
        <span title={titre} style={{ color: "var(--danger)", fontWeight: 700 }}>
          {court ? argent(compte.enRetard) : `En retard ${argent(compte.enRetard)}`}
          {!court && compte.aRecevoir > 0.005 && <span style={{ display: "block", fontSize: "0.85em", fontWeight: 600, color: "var(--text-muted)" }}>+ {argent(compte.aRecevoir)} à recevoir</span>}
        </span>
      );
    }
    return <span title="Loyer inscrit, pas encore échu" style={{ color: "var(--avertissement)", fontWeight: 700 }}>{court ? argent(s) : `À recevoir ${argent(s)}`}</span>;
  }
  if (s > 0.005) return <span style={{ color: "var(--danger)", fontWeight: 700 }}>{court ? argent(s) : `Doit ${argent(s)}`}</span>;
  if (s < -0.005) return <span style={{ color: "var(--success)", fontWeight: 700 }}>Crédit {argent(-s)}</span>;
  return <span style={{ color: "var(--success)", fontWeight: 700 }}>{court ? "0 $" : "À jour"}</span>;
}

// ---------- Champs des formulaires ----------

export const champsLogement = (immeubles) => [
  ...(immeubles ? [{ nom: "immeubleId", label: "Immeuble", type: "choix", options: immeubles.map((i) => ({ code: i.id, label: i.nom })) }] : []),
  { nom: "numero", label: "Numéro", placeholder: "1, 201, Local A…" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_LOGEMENT, defaut: "LOGEMENT" },
  { nom: "pieces", label: "Pièces", placeholder: "4 ½" },
  { nom: "etage", label: "Étage" },
  { nom: "superficie", label: "Superficie (pi²)", type: "nombre" },
  { nom: "loyerVise", label: "Loyer demandé ($ / mois)", type: "argent", placeholder: "pour la prochaine location" },
  { nom: "adresseCivique", label: "Adresse du logement, si différente", placeholder: "plex : 314 rue Champlain" },
  { nom: "numeroLogementRq", label: "N° de logement Revenu Québec (relevé 31, case A)" },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

export const champsLocataire = [
  { nom: "nom", label: "Nom (personne ou entreprise)" },
  { nom: "telephone", label: "Téléphone", typeHtml: "tel" },
  { nom: "courriel", label: "Courriel", typeHtml: "email" },
  { nom: "telephone2", label: "Autre téléphone", typeHtml: "tel" },
  { nom: "contactUrgence", label: "Personne à joindre en cas d'urgence", pleineLargeur: true },
  { nom: "avisCourriel", label: "Lui envoyer par courriel le suivi de ses demandes de réparation", type: "case", defaut: true },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

export const champsPaiement = [
  { nom: "date", label: "Date", type: "date" },
  { nom: "montant", label: "Montant ($)", type: "argent" },
  { nom: "mode", label: "Mode", type: "choix", vide: "—", options: MODES_PAIEMENT, defaut: "VIREMENT" },
  { nom: "reference", label: "Référence", placeholder: "n° de chèque, de virement…" },
  { nom: "note", label: "Note", pleineLargeur: true },
];

export const champsCharge = [
  { nom: "date", label: "Date", type: "date" },
  { nom: "montant", label: "Montant ($, négatif = crédit)", type: "argent" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_CHARGE.filter((t) => t.code !== "LOYER"), defaut: "FRAIS" },
  { nom: "description", label: "Description", pleineLargeur: true },
];

export const champsDepense = (immeubles) => [
  ...(immeubles ? [{ nom: "immeubleId", label: "Immeuble", type: "choix", options: immeubles.map((i) => ({ code: i.id, label: i.nom })) }] : []),
  { nom: "date", label: "Date", type: "date" },
  { nom: "categorie", label: "Catégorie", type: "choix", options: CATEGORIES_DEPENSE, defaut: "ENTRETIEN" },
  { nom: "montant", label: "Montant ($)", type: "argent" },
  { nom: "payeA", label: "Payé à" },
  { nom: "reference", label: "Référence (facture, chèque…)" },
  { nom: "description", label: "Description", pleineLargeur: true },
];

// Réparation : immeubles [{ id, nom, logements: [{ id, numero, type }] }],
// locataires [{ id, nom }] ; immeubleId choisi → ses logements seulement
export function champsReparation({ immeubles, locataires, immeubleId, fixe = {} }) {
  const imm = immeubles.find((i) => i.id === immeubleId);
  return [
    { nom: "titre", label: "Réparation", pleineLargeur: true, placeholder: "Robinet qui coule, fenêtre brisée…" },
    ...(!fixe.immeubleId ? [{ nom: "immeubleId", label: "Immeuble", type: "choix", vide: "— choisir —", options: immeubles.map((i) => ({ code: i.id, label: i.nom })) }] : []),
    ...(!fixe.logementId && imm ? [{ nom: "logementId", label: "Logement", type: "choix", vide: "— parties communes —", options: imm.logements.map((l) => ({ code: l.id, label: nomLogement(l) })) }] : []),
    { nom: "priorite", label: "Priorité", type: "choix", options: PRIORITES, defaut: "NORMALE" },
    { nom: "statut", label: "État", type: "choix", options: STATUTS_REPARATION, defaut: "NOUVELLE" },
    { nom: "categorie", label: "Catégorie", type: "choix", vide: "—", options: CATEGORIES_REPARATION },
    ...(locataires ? [{ nom: "locataireId", label: "Signalée par le locataire", type: "choix", vide: "—", options: locataires.map((l) => ({ code: l.id, label: l.nom })) }] : []),
    { nom: "entrepreneur", label: "Entrepreneur" },
    { nom: "telephoneEntrepreneur", label: "Téléphone de l'entrepreneur", typeHtml: "tel" },
    { nom: "datePrevue", label: "Date prévue", type: "date" },
    { nom: "dateFin", label: "Terminée le", type: "date" },
    { nom: "coutEstime", label: "Coût estimé ($)", type: "argent" },
    { nom: "coutReel", label: "Coût réel ($)", type: "argent" },
    { nom: "numeroFacture", label: "N° de facture" },
    { nom: "immobilisation", label: "Dépense d'immobilisation : travaux majeurs ou remplacement durable (toiture, fenêtres, chauffe-eau…) — amortie à l'impôt, compte pour les hausses de loyer", type: "case" },
    { nom: "signalePar", label: "Signalée par (autre)" },
    { nom: "description", label: "Description", type: "long", lignes: 3 },
    { nom: "reponse", label: "Réponse au locataire (visible dans son portail ; il en est avisé par courriel)", type: "long", lignes: 2 },
    { nom: "notes", label: "Notes internes", type: "long", lignes: 2 },
  ];
}

// Formulaire de réparation : la liste des logements suit l'immeuble choisi.
// fixe : { immeubleId, logementId, locataireId } imposés par la fiche d'où on part
export function FormulaireReparation({ immeubles, locataires, fixe = {}, onFini }) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState(() => ({ ...valeursDe(null, champsReparation({ immeubles, locataires, immeubleId: fixe.immeubleId, fixe })), ...fixe }));
  const champs = champsReparation({ immeubles, locataires, immeubleId: valeurs.immeubleId, fixe });
  const { appeler, enCours, erreur } = useApi();
  const maj = (nom, x) => setValeurs((o) => ({ ...o, [nom]: x, ...(nom === "immeubleId" ? { logementId: "" } : {}) }));
  async function envoyer() {
    const data = await appeler("/api/immobilier/reparations", "POST", { ...valeurs, ...fixe });
    if (data) (onFini ? onFini(data) : router.push(`/immobilier/reparations/${data.id}`));
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Ajouter la réparation"}</button>
    </div>
  );
}

// ---------- Bail ----------

// Mentions du bail complet (sections B à G du formulaire du TAL) : facultatives,
// elles remplissent le bail de logement généré
export const champsMentionsBail = (v) => [
  { nom: "accessoires", label: "Accessoires et dépendances (stationnement n°, casier, remise, usage de la cour…)", pleineLargeur: true },
  { nom: "usageMixte", label: "Usage aussi professionnel ou commercial (section B)", type: "case" },
  { nom: "modePaiement", label: "Mode de paiement du loyer", type: "choix", vide: "—", options: MODES_PAIEMENT },
  { nom: "lieuPaiement", label: "Lieu du paiement (si autre que virement)" },
  { nom: "premierPaiementLe", label: "Date du premier paiement", type: "date" },
  { nom: "chauffage", label: "Chauffage du logement", type: "choix", vide: "—", options: CHAUFFAGES },
  { nom: "animaux", label: "Animaux", type: "choix", vide: "—", options: ANIMAUX },
  { nom: "fumeur", label: "Tabac et cannabis", type: "choix", vide: "—", options: FUMEUR },
  { nom: "reglementRemisLe", label: "Règlement de l'immeuble remis le (vide : aucun)", type: "date" },
  { nom: "loyerAncien", label: "Loyer le plus bas des 12 mois avant le bail ($, section G)", type: "argent" },
  { nom: "loyerAncienNote", label: "Précision sur ce loyer (logement non loué, services différents…)", pleineLargeur: true },
  { nom: "caution", label: "Caution (garant) : nom et coordonnées", pleineLargeur: true },
  { nom: "chequesPostdates", label: "Le locataire accepte de remettre des chèques postdatés", type: "case" },
  { nom: "assuranceResponsabilite", label: "Assurance responsabilité civile exigée du locataire", type: "case" },
  { nom: "travauxPromis", label: "Travaux et réparations que le locateur s'engage à faire (et quand)", type: "long", lignes: 2 },
  { nom: "conditions", label: "Autres services, conditions et restrictions (imprimés au bail, section E)", type: "long", lignes: 3 },
  { nom: "immeubleNeuf", label: "Immeuble prêt pour l'habitation depuis 5 ans ou moins (section F : pas de fixation du loyer par le TAL)", type: "case" },
  ...(v.immeubleNeuf ? [{ nom: "hausseMaximaleF", label: "Hausse de loyer maximale pendant ces 5 ans (ex. 3 % par année)", pleineLargeur: true }] : []),
];
const CHAMPS_MENTIONS = champsMentionsBail({ immeubleNeuf: true });

// Nouveau bail ou modification : dates, loyer, services inclus, locataires
// (déjà inscrits ou nouveau), mentions du bail complet. initial : bail à modifier.
export function FormulaireBail({ logementId, locataires, initial, loyerSuggere, onFini, cadre = true }) {
  const { appeler, enCours, erreur, setErreur } = useApi();
  const modif = Boolean(initial);
  const debutDefaut = (() => {
    const d = new Date(aujourdhui());
    return d.getUTCMonth() >= 6 ? `${d.getUTCFullYear() + 1}-07-01` : `${d.getUTCFullYear()}-07-01`;
  })();
  const [v, setV] = useState(() => (modif ? {
    dateDebut: String(initial.dateDebut).slice(0, 10), dateFin: initial.dateFin ? String(initial.dateFin).slice(0, 10) : "",
    loyer: String(initial.loyer).replace(".", ","), jourPaiement: String(initial.jourPaiement || 1), notes: initial.notes || "",
    ...valeursDe(initial, CHAMPS_MENTIONS),
  } : { dateDebut: debutDefaut, dateFin: `${Number(debutDefaut.slice(0, 4)) + 1}-06-30`, loyer: loyerSuggere ? String(loyerSuggere).replace(".", ",") : "", jourPaiement: "1", notes: "", ...valeursDe({}, CHAMPS_MENTIONS) }));
  const [mentions, setMentions] = useState(false);
  const [services, setServices] = useState(() => new Set(servicesListe(initial?.services)));
  const [choisis, setChoisis] = useState(() => new Set((initial?.locataires || []).map((l) => l.id)));
  const [nouveau, setNouveau] = useState({ nom: "", telephone: "", courriel: "" });
  const [indetermine, setIndetermine] = useState(modif && !initial.dateFin);
  const maj = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const basculer = (set, setter, code) => setter(() => { const n = new Set(set); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  const champs = [
    { nom: "dateDebut", label: "Début du bail", type: "date" },
    ...(indetermine ? [] : [{ nom: "dateFin", label: "Fin du bail", type: "date" }]),
    { nom: "loyer", label: "Loyer mensuel ($)", type: "argent" },
    { nom: "jourPaiement", label: "Payable le (jour du mois)", type: "nombre" },
    { nom: "notes", label: "Notes internes (jamais imprimées au bail)", type: "long", lignes: 2 },
  ];

  async function envoyer() {
    if (choisis.size === 0 && !nouveau.nom.trim()) return setErreur("Inscris au moins un locataire.");
    const corps = {
      ...v, dateFin: indetermine ? "" : v.dateFin, services: [...services].join(","), locataireIds: [...choisis],
      ...(v.immeubleNeuf ? {} : { hausseMaximaleF: "" }),
      ...(nouveau.nom.trim() ? { nouveauLocataire: nouveau } : {}),
      ...(modif ? {} : { logementId }),
    };
    const data = await appeler(modif ? `/api/immobilier/baux/${initial.id}` : "/api/immobilier/baux", modif ? "PATCH" : "POST", corps);
    if (data) onFini?.(data);
  }

  const contenu = (
    <>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={indetermine} onChange={(e) => setIndetermine(e.target.checked)} /> Bail à durée indéterminée
      </label>
      <ChampsFormulaire champs={champs} valeurs={v} maj={maj} />
      <label style={labelStyle}>Le loyer comprend</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginBottom: 12 }}>
        {SERVICES_BAIL.map((s) => (
          <label key={s.code} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={services.has(s.code)} onChange={() => basculer(services, setServices, s.code)} /> {s.label}
          </label>
        ))}
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
        <button type="button" onClick={() => setMentions((x) => !x)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "var(--text)", width: "100%", textAlign: "left" }}>
          {mentions ? "▾" : "▸"} Mentions du bail complet (sections B à G du formulaire du TAL)
        </button>
        {mentions && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>Facultatives : elles remplissent le bail de logement généré (Générer un document → Bail de logement). Aucun dépôt de garantie ne peut être exigé au Québec.</p>
            <ChampsFormulaire champs={champsMentionsBail(v)} valeurs={v} maj={maj} />
          </div>
        )}
      </div>
      <label style={labelStyle}>Locataires (colocataires : en cocher plusieurs)</label>
      {locataires.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px", marginBottom: 10 }}>
          {locataires.map((l) => (
            <label key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "3px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={choisis.has(l.id)} onChange={() => basculer(choisis, setChoisis, l.id)} /> {l.nom}
            </label>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 4px" }}>{locataires.length > 0 ? "…ou un nouveau locataire :" : "Nouveau locataire :"}</div>
      <div style={grille2}>
        <Champ label="Nom"><input value={nouveau.nom} onChange={(e) => setNouveau((n) => ({ ...n, nom: e.target.value }))} style={champStyle} /></Champ>
        <Champ label="Téléphone"><input type="tel" value={nouveau.telephone} onChange={(e) => setNouveau((n) => ({ ...n, telephone: e.target.value }))} onBlur={(e) => setNouveau((n) => ({ ...n, telephone: formaterTelephone(e.target.value) }))} style={champStyle} /></Champ>
        <Champ label="Courriel"><input type="email" value={nouveau.courriel} onChange={(e) => setNouveau((n) => ({ ...n, courriel: e.target.value }))} style={champStyle} /></Champ>
      </div>
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : modif ? "Enregistrer le bail" : "Créer le bail"}</button>
    </>
  );
  if (!cadre) return contenu;
  return <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>{contenu}</div>;
}

// ---------- Documents ----------

// Dépôt d'un document : fichier, titre, catégorie, date, expiration.
// fixe : liens imposés (ex. { logementId, bailId } depuis la fiche d'un bail)
export function FormulaireDocument({ immeubles = [], fixe = {}, categorie = "BAIL", onFini }) {
  const router = useRouter();
  // Partagé au locataire par défaut quand le document est rattaché à son bail ou à lui
  const [valeurs, setValeurs] = useState({ titre: "", categorie, date: aujourdhui(), expireLe: "", description: "", immeubleId: "", visibleLocataire: Boolean(fixe.bailId || fixe.locataireId) && categorie !== "LOCATAIRE" });
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (nom, x) => setValeurs((o) => ({ ...o, [nom]: x }));
  const champs = [
    { nom: "titre", label: "Titre (sinon, le nom du fichier)", pleineLargeur: true },
    { nom: "categorie", label: "Catégorie", type: "choix", options: CATEGORIES_DOCUMENTS },
    { nom: "date", label: "Date du document", type: "date" },
    { nom: "expireLe", label: "Expire le (assurance, contrat…)", type: "date" },
    ...(!fixe.immeubleId && !fixe.logementId && !fixe.bailId && immeubles.length > 0 ? [{ nom: "immeubleId", label: "Immeuble", type: "choix", vide: "—", options: immeubles.map((i) => ({ code: i.id, label: i.nom })) }] : []),
    { nom: "description", label: "Description", type: "long", lignes: 2 },
    { nom: "visibleLocataire", label: fixe.bailId || fixe.locataireId || fixe.logementId ? "Visible par le locataire dans son portail" : "Visible par les locataires de l'immeuble dans leur portail (règlement, avis à tous…)", type: "case" },
  ];
  async function envoyer() {
    if (!fichier) return setErreur("Choisis le fichier.");
    setErreur("");
    setEnCours(true);
    const fd = new FormData();
    for (const [k, x] of Object.entries({ ...valeurs, ...fixe })) fd.append(k, typeof x === "boolean" ? (x ? "oui" : "") : x ?? "");
    fd.append("fichier", fichier);
    const res = await fetch("/api/immobilier/documents", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Envoi impossible.");
    router.refresh();
    onFini?.();
  }
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <label style={labelStyle}>Fichier (PDF, Word, Excel, photo… 20 Mo max.)</label>
      <input type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)} style={{ fontSize: 13, marginBottom: 10 }} />
      <ChampsFormulaire champs={champs} valeurs={valeurs} maj={maj} />
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "Envoi…" : "Déposer le document"}</button>
    </div>
  );
}

// Liste de documents, avec ouverture et suppression
// envoi : bouton « ✉️ Envoyer » sur les documents rattachés à un bail ou un locataire
// signataires : locataires qui peuvent signer (fiche d'un bail) — active la
// signature électronique des PDF (d.signatures : demandes déjà faites)
export function ListeDocuments({ documents, vide = "Aucun document.", envoi = false, signataires = null }) {
  const [ouvert, setOuvert] = useState(null);
  if (documents.length === 0) return <Vide>{vide}</Vide>;
  return documents.map((d) => {
    const cat = trouver(CATEGORIES_DOCUMENTS, d.categorie);
    const exp = etatExpiration(d.expireLe);
    const sig = etatSignatures(d.signatures);
    const signable = signataires && d.typeMime === "application/pdf" && (d.bailId || d.locataireId);
    return (
      <div key={d.id}>
        <div className="ligne-info ligne-pastilles" style={{ gap: 8 }}>
          <span style={{ minWidth: 0 }}>
            <a href={`/api/immobilier/documents/${d.id}`} target="_blank" rel="noreferrer" style={lien}>
              {cat?.icone} {d.titre}
            </a>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{d.date && ` · ${dateLisible(d.date)}`} · {taille(d.taille)}</span>
            {d.signeLe && <> · <a href={`/api/immobilier/documents/${d.id}?version=signee`} target="_blank" rel="noreferrer" style={{ ...lien, fontSize: 12, fontWeight: 700 }}>{d.genre ? "✅ version signée" : "✅ certificat de signature"}</a></>}
          </span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {exp && exp.code !== "OK" && <PastilleEtat etat={exp} />}
            {sig && <button type="button" onClick={() => setOuvert((x) => (x === d.id ? null : d.id))} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><PastilleEtat etat={sig} /></button>}
            {signable && !sig && <button type="button" onClick={() => setOuvert((x) => (x === d.id ? null : d.id))} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" }}>✍️ Faire signer</button>}
            {envoi && (d.bailId || d.locataireId) && <BoutonEnvoyer url={`/api/immobilier/documents/${d.id}/envoyer`} confirmation={`Envoyer « ${d.titre} » par courriel au locataire ? Le PDF est joint ; l'envoi est consigné sur la fiche du bail.`} />}
            <BasculeVisible d={d} />
            <BoutonSupprimer url={`/api/immobilier/documents/${d.id}`} confirmation={`Supprimer le document « ${d.titre} » ?${sig ? " Ses signatures disparaissent aussi." : ""}`}>✕</BoutonSupprimer>
          </span>
        </div>
        {ouvert === d.id && (signable || sig) && <SignaturesDocument d={d} signataires={signataires || []} envoi={envoi} />}
      </div>
    );
  });
}

// ---------- Signature électronique (lib/signatureImmo.js) ----------

const dateHeure = (d) => new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(d));

// Demandes de signature d'un document (état, relance, lien, annulation) et
// formulaire pour en faire une nouvelle
function SignaturesDocument({ d, signataires, envoi }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const actives = (d.signatures || []).filter((s) => s.statut !== "ANNULE");
  const enAttente = actives.some((s) => s.statut === "EN_ATTENTE");
  const avis = d.genre === "AVIS_MODIFICATION";
  const peutDemander = !d.signeLe && !enAttente;
  const [choisis, setChoisis] = useState(() => new Set(signataires.map((l) => l.id)));
  const [locateur, setLocateur] = useState(d.genre === "BAIL_LOGEMENT" || d.genre === "BAIL_FORMULAIRE" || d.genre === "ETAT_LIEUX_NUMERIQUE");
  const [parCourriel, setParCourriel] = useState(envoi);
  const [message, setMessage] = useState("");
  const [resultat, setResultat] = useState("");
  const [copie, setCopie] = useState(null);

  async function demander() {
    setResultat("");
    const data = await appeler(`/api/immobilier/documents/${d.id}/signatures`, "POST", { locataireIds: [...choisis], locateur, envoyer: parCourriel, message });
    if (!data) return;
    const e = data.envoi;
    setResultat(e ? `Demande créée${e.envoyes ? ` — lien envoyé à ${e.envoyes} locataire${e.envoyes > 1 ? "s" : ""}` : ""}${e.sansCourriel?.length ? ` (sans courriel : ${e.sansCourriel.join(", ")} — copie-leur le lien)` : ""}${e.erreur ? ` — ${e.erreur}` : ""}.` : "Demande créée : copie les liens ci-dessous pour les transmettre.");
  }
  async function copier(s) {
    const url = `${window.location.origin}/signature/${s.jeton}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopie(s.id);
    } catch {
      window.prompt("Lien de signature à transmettre :", url);
    }
  }
  async function annuler(s) {
    if (!window.confirm(`Annuler la demande de signature de ${s.nom} ? Son lien ne fonctionnera plus.`)) return;
    await appeler(`/api/immobilier/signatures/${s.id}`, "DELETE");
  }

  return (
    <div style={{ margin: "4px 0 12px", padding: 12, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)" }}>
      {actives.length > 0 && (
        <div style={{ marginBottom: peutDemander ? 12 : 0 }}>
          {actives.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ minWidth: 0 }}>
                <strong>{s.role === "LOCATEUR" ? `Locateur — ${s.nom}` : s.nom}</strong>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {s.statut === "EN_ATTENTE" && ` · demandé le ${dateHeure(s.demandeLe)}${s.envoyeLe ? ` · courriel envoyé${s.relances ? ` (${s.relances} relance${s.relances > 1 ? "s" : ""})` : ""}` : s.role === "LOCATAIRE" ? " · lien à transmettre" : ""}${s.vuLe ? ` · ouvert le ${dateHeure(s.vuLe)}` : " · pas encore ouvert"}`}
                  {s.statut !== "EN_ATTENTE" && s.reponduLe && ` · le ${dateHeure(s.reponduLe)}${s.signataireNom && s.signataireNom !== s.nom ? ` (signé « ${s.signataireNom} »)` : ""}`}
                  {s.reponseAvis && ` · ${libelle(REPONSES_AVIS, s.reponseAvis)}`}
                </span>
                {s.note && <span style={{ display: "block", fontSize: 12, fontStyle: "italic" }}>« {s.note} »</span>}
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                <PastilleCode liste={STATUTS_SIGNATURE} code={s.statut} />
                {s.statut === "EN_ATTENTE" && (
                  <>
                    {s.role === "LOCATEUR"
                      ? <a href={`/signature/${s.jeton}`} target="_blank" rel="noreferrer" style={{ ...lien, fontSize: 12, fontWeight: 700 }}>✍️ Signer maintenant</a>
                      : <>
                        <button type="button" onClick={() => copier(s)} style={boutonLien}>{copie === s.id ? "✓ copié" : "🔗 Copier le lien"}</button>
                        {envoi && s.courriel && <BoutonEnvoyer url={`/api/immobilier/signatures/${s.id}`} confirmation={`Relancer ${s.nom} par courriel ?`}>✉️ Relancer</BoutonEnvoyer>}
                      </>}
                    <button type="button" onClick={() => annuler(s)} disabled={enCours} style={{ ...boutonLien, color: "var(--text-muted)" }}>Annuler</button>
                  </>
                )}
              </span>
            </div>
          ))}
          {d.signeLe && <p style={{ fontSize: 12.5, margin: "8px 0 0" }}>✅ Toutes les signatures reçues le {dateHeure(d.signeLe)} : {d.genre ? "la version signée, avec le certificat de signature, a été produite" : "le certificat de signature accompagne le fichier d'origine"} et envoyée aux locataires qui ont un courriel.</p>}
        </div>
      )}
      {peutDemander && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{actives.length ? "Nouvelle demande de signature (remplace la précédente : tous signent de nouveau)" : avis ? "Demander une réponse signée en ligne" : "Demander la signature en ligne"}</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
            {avis
              ? "Chaque locataire reçoit un lien personnel : il lit l'avis, choisit sa réponse (accepte, refuse ou quitte) et la signe. Sa réponse s'inscrit au bail."
              : "Chaque signataire reçoit un lien personnel : il lit le document, signe du doigt et consent à la signature électronique. Une fois toutes les signatures reçues, la version signée et son certificat sont produits et envoyés aux locataires."}
          </p>
          {signataires.map((l) => (
            <label key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={choisis.has(l.id)} onChange={() => setChoisis((x) => { const n = new Set(x); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
              {l.nom} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{l.courriel || "— sans courriel : lien à transmettre"}</span>
            </label>
          ))}
          {!avis && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={locateur} onChange={(e) => setLocateur(e.target.checked)} /> Le locateur signe aussi (lien « Signer maintenant » ici)
            </label>
          )}
          {envoi && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={parCourriel} onChange={(e) => setParCourriel(e.target.checked)} /> Envoyer le lien par courriel aux locataires (PDF joint)
            </label>
          )}
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1000} placeholder="Message joint à la demande (facultatif)" style={{ ...champStyle, resize: "vertical", margin: "6px 0 8px" }} />
          <Erreur texte={erreur} />
          <button type="button" onClick={demander} disabled={enCours || choisis.size === 0} className="bouton-3d" style={{ ...boutonPrincipal, width: "auto", padding: "9px 14px" }}>{enCours ? "…" : "✍️ Demander la signature"}</button>
        </>
      )}
      {resultat && <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--success)", margin: "8px 0 0" }}>{resultat}</p>}
      {!peutDemander && enAttente && <button type="button" onClick={() => router.refresh()} style={{ ...boutonLien, marginTop: 6 }}>↻ Actualiser</button>}
    </div>
  );
}

const boutonLien = { background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" };

// Envoi par courriel (document, relevé, reçu) : confirmation, puis résultat
// « Envoyé à 2 locataires » ou la raison du refus
export function BoutonEnvoyer({ url, confirmation, children = "✉️ Envoyer", style }) {
  const router = useRouter();
  const [etat, setEtat] = useState(null); // null | "envoi" | { ok, texte }
  async function envoyer() {
    if (confirmation && !window.confirm(confirmation)) return;
    setEtat("envoi");
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    const sans = data.sansCourriel?.length ? ` (sans courriel : ${data.sansCourriel.join(", ")})` : "";
    if (!res.ok && !data.envoyes) setEtat({ ok: false, texte: data.erreur || data.echecs?.[0]?.erreur || "Envoi impossible." });
    else setEtat({ ok: !data.echecs?.length, texte: `Envoyé à ${data.envoyes} locataire${data.envoyes > 1 ? "s" : ""}${data.echecs?.length ? `, ${data.echecs.length} échec${data.echecs.length > 1 ? "s" : ""}` : ""}${sans}.` });
    router.refresh();
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" onClick={envoyer} disabled={etat === "envoi"} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap", ...style }}>
        {etat === "envoi" ? "Envoi…" : children}
      </button>
      {etat && etat !== "envoi" && <span style={{ fontSize: 11.5, fontWeight: 700, color: etat.ok ? "var(--success)" : "var(--danger)" }}>{etat.texte}</span>}
    </span>
  );
}

// Montrer ou cacher un document dans le portail des locataires
function BasculeVisible({ d }) {
  const { appeler, enCours } = useApi();
  return (
    <button
      type="button" disabled={enCours} onClick={() => appeler(`/api/immobilier/documents/${d.id}`, "PATCH", { visibleLocataire: !d.visibleLocataire })}
      title={d.visibleLocataire ? "Visible dans le portail du locataire — cliquer pour cacher" : "Caché au locataire — cliquer pour le montrer dans son portail"}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 700, padding: 0, color: d.visibleLocataire ? "var(--success)" : "var(--text-muted)", whiteSpace: "nowrap" }}
    >
      {enCours ? "…" : d.visibleLocataire ? "👁 locataire" : "🔒 interne"}
    </button>
  );
}

// Liste compacte de réparations
// lieu : « tout » (immeuble et logement), « logement » (fiche d'un immeuble), « aucun » (fiche d'un logement)
export function ListeReparations({ reparations, vide = "Aucune réparation.", lieu = "tout" }) {
  if (reparations.length === 0) return <Vide>{vide}</Vide>;
  return reparations.map((r) => (
    <Link key={r.id} href={`/immobilier/reparations/${r.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
      <span style={{ minWidth: 0 }}>
        <strong>{r.numero}</strong> {r.source === "PORTAIL" && <span title="Demandée par le locataire dans son portail">🌐 </span>}{r.titre}
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {lieu === "tout" && r.immeuble && ` · ${r.immeuble.nom}`}
          {lieu !== "aucun" && (r.logement ? ` · ${nomLogement(r.logement)}` : " · parties communes")}
          {r.entrepreneur && ` · ${r.entrepreneur}`}
          {r.coutReel != null ? ` · ${argent(r.coutReel)}` : r.coutEstime != null ? ` · ≈ ${argent(r.coutEstime)}` : ""}
        </span>
      </span>
      <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {trouver(STATUTS_REPARATION, r.statut)?.ouverte && <PastilleCode liste={PRIORITES} code={r.priorite} />}
        <PastilleCode liste={STATUTS_REPARATION} code={r.statut} />
      </span>
    </Link>
  ));
}
