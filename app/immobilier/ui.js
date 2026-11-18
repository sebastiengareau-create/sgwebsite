"use client";

// Éléments communs aux écrans de l'immobilier. Les briques génériques
// (formulaires décrits par une liste de champs, fichiers, cartes de liste…)
// sont celles de la copropriété ; seules les données diffèrent.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Section, Formulaire, ChampsFormulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, Recherche, CarteListe, ListeFichiers, EnvoiFichiers,
  Retour, valeursDe, champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, useApi, Onglets, Statistique, Tableau, cellule, celluleDroite, aujourdhui,
} from "../copropriete/ui";
import {
  TYPES_LOGEMENT, SERVICES_BAIL, CATEGORIES_DOCUMENTS, CATEGORIES_REPARATION, PRIORITES, STATUTS_REPARATION, CATEGORIES_DEPENSE, MODES_PAIEMENT, TYPES_CHARGE,
  servicesListe, trouver, dateLisible, argent, taille, etatExpiration, nomLogement,
} from "@/lib/immobilierCalculs";

export { nomLogement };

export {
  Section, Formulaire, ChampsFormulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, Recherche, CarteListe, ListeFichiers, EnvoiFichiers,
  Retour, valeursDe, champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, useApi, Onglets, Statistique, Tableau, cellule, celluleDroite, aujourdhui,
};

export function NavImmo({ actif }) {
  const liens = [
    { href: "/immobilier", label: "📊 Tableau de bord" },
    { href: "/immobilier/immeubles", label: "🏘️ Immeubles" },
    { href: "/immobilier/locataires", label: "👥 Locataires" },
    { href: "/immobilier/loyers", label: "💵 Loyers" },
    { href: "/immobilier/reparations", label: "🛠️ Réparations" },
    { href: "/immobilier/depenses", label: "📈 Dépenses et rendement" },
    { href: "/immobilier/releve-31", label: "🧾 Relevé 31" },
    { href: "/immobilier/documents", label: "📁 Documents" },
  ];
  return (
    <nav style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 4, marginBottom: 16,
      padding: 4, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      {liens.map((l) => {
        const estActif = l.href === actif;
        return (
          <Link
            key={l.href} href={l.href} aria-current={estActif ? "page" : undefined}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
              fontSize: 13.5, fontWeight: 700, padding: "10px 6px", borderRadius: 10, textDecoration: "none",
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
    <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: etat.couleur, background: `${etat.couleur}22`, whiteSpace: "nowrap" }}>
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


// Solde d'un compte : rouge s'il est dû, vert à jour ou en crédit
export function Solde({ solde, court }) {
  const s = Math.round((solde || 0) * 100) / 100;
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
  { nom: "loyerVise", label: "Loyer demandé ($ / mois)", type: "nombre", placeholder: "pour la prochaine location" },
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
  { nom: "montant", label: "Montant ($)", type: "nombre" },
  { nom: "mode", label: "Mode", type: "choix", vide: "—", options: MODES_PAIEMENT, defaut: "VIREMENT" },
  { nom: "reference", label: "Référence", placeholder: "n° de chèque, de virement…" },
  { nom: "note", label: "Note", pleineLargeur: true },
];

export const champsCharge = [
  { nom: "date", label: "Date", type: "date" },
  { nom: "montant", label: "Montant ($, négatif = crédit)", type: "nombre" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_CHARGE.filter((t) => t.code !== "LOYER"), defaut: "FRAIS" },
  { nom: "description", label: "Description", pleineLargeur: true },
];

export const champsDepense = (immeubles) => [
  ...(immeubles ? [{ nom: "immeubleId", label: "Immeuble", type: "choix", options: immeubles.map((i) => ({ code: i.id, label: i.nom })) }] : []),
  { nom: "date", label: "Date", type: "date" },
  { nom: "categorie", label: "Catégorie", type: "choix", options: CATEGORIES_DEPENSE, defaut: "ENTRETIEN" },
  { nom: "montant", label: "Montant ($)", type: "nombre" },
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
    { nom: "coutEstime", label: "Coût estimé ($)", type: "nombre" },
    { nom: "coutReel", label: "Coût réel ($)", type: "nombre" },
    { nom: "numeroFacture", label: "N° de facture" },
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

// Nouveau bail ou modification : dates, loyer, services inclus, locataires
// (déjà inscrits ou nouveau). initial : bail à modifier.
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
  } : { dateDebut: debutDefaut, dateFin: `${Number(debutDefaut.slice(0, 4)) + 1}-06-30`, loyer: loyerSuggere ? String(loyerSuggere).replace(".", ",") : "", jourPaiement: "1", notes: "" }));
  const [services, setServices] = useState(() => new Set(servicesListe(initial?.services)));
  const [choisis, setChoisis] = useState(() => new Set((initial?.locataires || []).map((l) => l.id)));
  const [nouveau, setNouveau] = useState({ nom: "", telephone: "", courriel: "" });
  const [indetermine, setIndetermine] = useState(modif && !initial.dateFin);
  const maj = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const basculer = (set, setter, code) => setter(() => { const n = new Set(set); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  const champs = [
    { nom: "dateDebut", label: "Début du bail", type: "date" },
    ...(indetermine ? [] : [{ nom: "dateFin", label: "Fin du bail", type: "date" }]),
    { nom: "loyer", label: "Loyer mensuel ($)", type: "nombre" },
    { nom: "jourPaiement", label: "Payable le (jour du mois)", type: "nombre" },
    { nom: "notes", label: "Notes (conditions particulières…)", type: "long", lignes: 2 },
  ];

  async function envoyer() {
    if (choisis.size === 0 && !nouveau.nom.trim()) return setErreur("Inscris au moins un locataire.");
    const corps = {
      ...v, dateFin: indetermine ? "" : v.dateFin, services: [...services].join(","), locataireIds: [...choisis],
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
        <Champ label="Téléphone"><input type="tel" value={nouveau.telephone} onChange={(e) => setNouveau((n) => ({ ...n, telephone: e.target.value }))} style={champStyle} /></Champ>
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
export function ListeDocuments({ documents, vide = "Aucun document." }) {
  if (documents.length === 0) return <Vide>{vide}</Vide>;
  return documents.map((d) => {
    const cat = trouver(CATEGORIES_DOCUMENTS, d.categorie);
    const exp = etatExpiration(d.expireLe);
    return (
      <div key={d.id} className="ligne-info ligne-pastilles" style={{ gap: 8 }}>
        <a href={`/api/immobilier/documents/${d.id}`} target="_blank" rel="noreferrer" style={{ ...lien, minWidth: 0 }}>
          {cat?.icone} {d.titre}
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{d.date && ` · ${dateLisible(d.date)}`} · {taille(d.taille)}</span>
        </a>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {exp && exp.code !== "OK" && <PastilleEtat etat={exp} />}
          <BasculeVisible d={d} />
          <BoutonSupprimer url={`/api/immobilier/documents/${d.id}`} confirmation={`Supprimer le document « ${d.titre} » ?`}>✕</BoutonSupprimer>
        </span>
      </div>
    );
  });
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
