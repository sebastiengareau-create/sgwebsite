"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LigneInfo } from "../../../components/ui";
import {
  TYPES_UNITE, TYPES_OCCUPANT, TYPES_ESPACE, MODES_ESPACE, TYPES_CHARGE, MODES_PAIEMENT, STATUTS_DEMANDE, STATUTS_TRAVAIL, CATEGORIES_DOCUMENTS, VISIBILITES,
  argent, pourcent, libelle, trouver, dateLisible, soldeUnite, releveUnite, taille,
} from "@/lib/coproprieteCalculs";
import { champsUnite } from "../UnitesClient";
import FormulaireDocument from "../../documents/FormulaireDocument";
import {
  Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, PastilleCode, Vide, Tableau, cellule, celluleDroite, valeursDe, aujourdhui, useApi,
} from "../../ui";

export default function UniteClient({ unite, batiments, coproprietaires }) {
  const type = trouver(TYPES_UNITE, unite.type);
  const solde = soldeUnite(unite);
  return (
    <div className="conteneur-page">
      <Retour href="/copropriete/unites">Unités</Retour>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 14px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>{type?.icone} Unité {unite.numero}</h1>
        <span style={{ fontSize: 13, fontWeight: 700, color: solde > 0.005 ? "var(--danger)" : "var(--success)" }}>
          {solde > 0.005 ? `Solde dû : ${argent(solde)}` : solde < -0.005 ? `Crédit : ${argent(-solde)}` : "Compte à jour"}
        </span>
      </div>
      <Fiche unite={unite} batiments={batiments} />
      <Proprietaires unite={unite} coproprietaires={coproprietaires} />
      <Occupants unite={unite} />
      <Espaces unite={unite} />
      <Compte unite={unite} />
      <Historique unite={unite} />
      <Documents unite={unite} />
    </div>
  );
}

function Fiche({ unite, batiments }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const champs = champsUnite(batiments);
  return (
    <Section titre="Fiche" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <Formulaire cadre={false} champs={champs} initial={valeursDe(unite, champs)} url={`/api/copropriete/unites/${unite.id}`} methode="PATCH" onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/copropriete/unites/${unite.id}`} confirmation={`Supprimer l'unité ${unite.numero} ?`} onFini={() => router.push("/copropriete/unites")}>Supprimer l'unité</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          <LigneInfo label="Type" valeur={libelle(TYPES_UNITE, unite.type)} />
          <LigneInfo label="Quote-part" valeur={pourcent(unite.quotePart)} />
          <LigneInfo label="Bâtiment" valeur={unite.batiment?.nom} />
          <LigneInfo label="Étage" valeur={unite.etage} />
          <LigneInfo label="Superficie" valeur={unite.superficie && `${String(unite.superficie).replace(".", ",")} pi²`} />
          <LigneInfo label="Lot (cadastre)" valeur={unite.numeroLot} />
          {unite.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{unite.notes}</p>}
        </>
      )}
    </Section>
  );
}

// ---------- Propriétaires et historique ----------

function Proprietaires({ unite, coproprietaires }) {
  const [ajout, setAjout] = useState(false);
  const actuels = unite.proprietes.filter((p) => !p.dateFin);
  const anciens = unite.proprietes.filter((p) => p.dateFin);
  return (
    <Section titre="Propriétaires" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Propriétaire / vente"}</BoutonTexte>}>
      {ajout && <AjoutProprietaire unite={unite} coproprietaires={coproprietaires} aDesActuels={actuels.length > 0} onFini={() => setAjout(false)} />}
      {actuels.length === 0 && <Vide>Aucun propriétaire inscrit.</Vide>}
      {actuels.map((p) => <LignePropriete key={p.id} p={p} />)}
      {anciens.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "12px 0 4px" }}>Historique des propriétaires</div>
          {anciens.map((p) => <LignePropriete key={p.id} p={p} ancien />)}
        </>
      )}
    </Section>
  );
}

function LignePropriete({ p, ancien }) {
  const { appeler, enCours } = useApi();
  async function terminer() {
    const date = window.prompt("Date de la vente (AAAA-MM-JJ) :", aujourdhui());
    if (date) await appeler(`/api/copropriete/proprietes/${p.id}`, "PATCH", { dateFin: date });
  }
  return (
    <div className="ligne-info" style={{ gap: 8, opacity: ancien ? 0.75 : 1 }}>
      <span style={{ minWidth: 0 }}>
        <Link href={`/copropriete/coproprietaires/${p.coproprietaire.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{p.coproprietaire.nom}</Link>
        {p.partDetenue < 100 && <span> ({pourcent(p.partDetenue, 2)})</span>}
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {" "}· {p.dateDebut ? `depuis le ${dateLisible(p.dateDebut)}` : "date d'acquisition inconnue"}{p.dateFin && ` → vendu le ${dateLisible(p.dateFin)}`}
          {!ancien && p.coproprietaire.telephone && ` · ${p.coproprietaire.telephone}`}
        </span>
      </span>
      <span style={{ whiteSpace: "nowrap" }}>
        {!ancien && <><BoutonTexte onClick={terminer} disabled={enCours}>Fin</BoutonTexte>{" · "}</>}
        <BoutonSupprimer url={`/api/copropriete/proprietes/${p.id}`} confirmation={`Retirer ${p.coproprietaire.nom} de l'historique de cette unité ? (Entré par erreur seulement — pour une vente, utilise « Fin ».)`}>✕</BoutonSupprimer>
      </span>
    </div>
  );
}

function AjoutProprietaire({ unite, coproprietaires, aDesActuels, onFini }) {
  const champs = [
    { nom: "coproprietaireId", label: "Copropriétaire", type: "choix", vide: "➕ Nouveau copropriétaire…", options: coproprietaires.map((c) => ({ code: c.id, label: c.nom })) },
    { nom: "dateDebut", label: "Date d'acquisition", type: "date" },
    { nom: "partDetenue", label: "Part détenue (%)", type: "nombre", defaut: "100" },
    ...(aDesActuels ? [{ nom: "transfert", label: "Vente : les propriétaires actuels sortent à cette date (sinon, copropriétaire en plus)", type: "case" }] : []),
  ];
  return (
    <Formulaire
      champs={champs} url="/api/copropriete/proprietes" extra={{ uniteId: unite.id }} bouton="Inscrire" onFini={onFini}
      avantEnvoi={async (corps) => {
        if (corps.coproprietaireId) return;
        if (!corps.nouveauNom?.trim()) return { erreur: "Choisis le copropriétaire ou écris le nom du nouveau." };
        const res = await fetch("/api/copropriete/coproprietaires", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom: corps.nouveauNom, courriel: corps.nouveauCourriel, telephone: corps.nouveauTelephone }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { erreur: data.erreur || "Création impossible." };
        return { corps: { ...corps, coproprietaireId: data.id } };
      }}
    >
      {({ valeurs, maj }) => !valeurs.coproprietaireId && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {[["nouveauNom", "Nom du nouveau copropriétaire"], ["nouveauCourriel", "Courriel"], ["nouveauTelephone", "Téléphone"]].map(([nom, label]) => (
            <div key={nom}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{label}</label>
              <input value={valeurs[nom] || ""} onChange={(e) => maj(nom, e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
      )}
    </Formulaire>
  );
}

// ---------- Occupants et locataires ----------

const champsOccupant = [
  { nom: "type", label: "Type", type: "choix", options: TYPES_OCCUPANT, defaut: "LOCATAIRE" },
  { nom: "nom", label: "Nom" },
  { nom: "telephone", label: "Téléphone" },
  { nom: "courriel", label: "Courriel" },
  { nom: "dateDebut", label: "Arrivée", type: "date" },
  { nom: "dateFin", label: "Départ", type: "date" },
  { nom: "notes", label: "Notes (bail, véhicule, animal…)", type: "long", lignes: 2 },
];

function Occupants({ unite }) {
  const [ajout, setAjout] = useState(false);
  const [edition, setEdition] = useState(null);
  const actuels = unite.occupants.filter((o) => !o.dateFin);
  const anciens = unite.occupants.filter((o) => o.dateFin);
  const ligne = (o) => (
    <div key={o.id} className="ligne-info" style={{ gap: 8, opacity: o.dateFin ? 0.75 : 1 }}>
      <span style={{ minWidth: 0 }}>
        <strong>{o.nom}</strong> <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {libelle(TYPES_OCCUPANT, o.type)}{o.telephone && ` · ${o.telephone}`}{o.courriel && ` · ${o.courriel}`}
          {o.dateDebut && ` · depuis le ${dateLisible(o.dateDebut)}`}{o.dateFin && ` → ${dateLisible(o.dateFin)}`}</span>
        {o.notes && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{o.notes}</div>}
      </span>
      <span style={{ whiteSpace: "nowrap" }}>
        <BoutonTexte onClick={() => setEdition(edition?.id === o.id ? null : o)}>Modifier</BoutonTexte>{" · "}
        <BoutonSupprimer url={`/api/copropriete/occupants/${o.id}`} confirmation={`Supprimer ${o.nom} ?`}>✕</BoutonSupprimer>
      </span>
    </div>
  );
  return (
    <Section titre="Occupants et locataires" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Occupant"}</BoutonTexte>}>
      {ajout && <Formulaire champs={champsOccupant} initial={{ dateDebut: aujourdhui() }} url="/api/copropriete/occupants" extra={{ uniteId: unite.id }} bouton="Ajouter" onFini={() => setAjout(false)} />}
      {edition && <Formulaire key={edition.id} champs={champsOccupant} initial={valeursDe(edition, champsOccupant)} url={`/api/copropriete/occupants/${edition.id}`} methode="PATCH" bouton={`Enregistrer ${edition.nom}`} onFini={() => setEdition(null)} />}
      {actuels.length === 0 ? <Vide>Aucun occupant inscrit.</Vide> : actuels.map(ligne)}
      {anciens.length > 0 && <><div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "12px 0 4px" }}>Anciens occupants</div>{anciens.map(ligne)}</>}
    </Section>
  );
}

function Espaces({ unite }) {
  return (
    <Section titre="Stationnements et rangements" droite={<Link href="/copropriete/unites" style={{ fontSize: 12, color: "var(--accent)" }}>Gérer</Link>}>
      {unite.espaces.length === 0 ? <Vide>Aucun espace attribué à cette unité.</Vide> : unite.espaces.map((e) => (
        <div key={e.id} className="ligne-info">
          <span>{trouver(TYPES_ESPACE, e.type)?.icone} {libelle(TYPES_ESPACE, e.type)} <strong>{e.numero}</strong>{e.emplacement && ` · ${e.emplacement}`} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {libelle(MODES_ESPACE, e.mode)}</span></span>
          <span>{e.fraisMensuel > 0 ? `${argent(e.fraisMensuel)} / mois` : ""}</span>
        </div>
      ))}
    </Section>
  );
}

// ---------- Compte : charges, paiements, solde ----------

const champsPaiement = [
  { nom: "date", label: "Date", type: "date" },
  { nom: "montant", label: "Montant ($)", type: "nombre" },
  { nom: "mode", label: "Mode", type: "choix", vide: "—", options: MODES_PAIEMENT },
  { nom: "reference", label: "Référence (no de chèque…)" },
];
const champsCharge = [
  { nom: "date", label: "Date", type: "date" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_CHARGE, defaut: "SPECIALE" },
  { nom: "montant", label: "Montant ($, négatif = crédit)", type: "nombre" },
  { nom: "description", label: "Description", pleineLargeur: true },
];

function Compte({ unite }) {
  const [ajout, setAjout] = useState(null);
  const [tout, setTout] = useState(false);
  const releve = releveUnite(unite);
  const affiche = tout ? releve : releve.slice(-12);
  return (
    <Section titre="Compte de l'unité" droite={
      <span style={{ display: "flex", gap: 12 }}>
        <BoutonTexte onClick={() => setAjout(ajout === "paiement" ? null : "paiement")}>+ Paiement</BoutonTexte>
        <BoutonTexte onClick={() => setAjout(ajout === "charge" ? null : "charge")}>+ Charge</BoutonTexte>
      </span>
    }>
      {ajout === "paiement" && <Formulaire key="p" champs={champsPaiement} initial={{ date: aujourdhui(), montant: soldeUnite(unite) > 0 ? String(soldeUnite(unite)).replace(".", ",") : "" }} url="/api/copropriete/paiements" extra={{ uniteId: unite.id }} bouton="Enregistrer le paiement" onFini={() => setAjout(null)} />}
      {ajout === "charge" && <Formulaire key="c" champs={champsCharge} initial={{ date: aujourdhui() }} url="/api/copropriete/charges" extra={{ uniteId: unite.id }} bouton="Ajouter la charge" onFini={() => setAjout(null)} />}
      {releve.length === 0 ? <Vide>Aucune charge ni paiement. Les cotisations mensuelles se génèrent dans Charges.</Vide> : (
        <>
          {releve.length > 12 && !tout && <BoutonTexte onClick={() => setTout(true)}>Voir les {releve.length} lignes</BoutonTexte>}
          <Tableau entetes={["Date", "Description", "Montant", "Solde", ""]} alignDroite={[2, 3]}>
            {affiche.map((l) => (
              <tr key={`${l.genre}-${l.id}`}>
                <td style={{ ...cellule, whiteSpace: "nowrap" }}>{dateLisible(l.date)}</td>
                <td style={cellule}>{l.genre === "paiement" ? "💵 " : ""}{l.libelle}</td>
                <td style={{ ...celluleDroite, color: l.montant < 0 ? "var(--success)" : undefined }}>{argent(l.montant)}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(l.solde)}</td>
                <td style={{ ...cellule, textAlign: "right" }}>
                  <BoutonSupprimer url={`/api/copropriete/${l.genre === "paiement" ? "paiements" : "charges"}/${l.id}`} confirmation={`Supprimer cette ligne (${l.libelle}, ${argent(Math.abs(l.montant))}) ?`}>✕</BoutonSupprimer>
                </td>
              </tr>
            ))}
          </Tableau>
        </>
      )}
    </Section>
  );
}

// ---------- Entretien et réparations de l'unité ----------

function Historique({ unite }) {
  const cout = unite.travaux.reduce((s, t) => s + (t.coutReel || 0), 0);
  return (
    <Section titre="Demandes et travaux" droite={<Link href={`/copropriete/entretien?unite=${unite.id}&nouvelle=1`} style={{ fontSize: 12, color: "var(--accent)" }}>+ Demande</Link>}>
      {unite.demandes.length === 0 && unite.travaux.length === 0 && <Vide>Aucune demande ni travaux pour cette unité.</Vide>}
      {unite.demandes.map((d) => (
        <Link key={d.id} href={`/copropriete/demandes/${d.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
          <span><strong>{d.numero}</strong> {d.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {dateLisible(d.creeLe)}</span></span>
          <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />
        </Link>
      ))}
      {unite.travaux.map((t) => (
        <Link key={t.id} href={`/copropriete/travaux/${t.id}`} className="ligne-info" style={{ textDecoration: "none", color: "inherit" }}>
          <span><strong>{t.numero}</strong> {t.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.fournisseur && `· ${t.fournisseur.nom}`} {t.coutReel != null && `· ${argent(t.coutReel)}`}</span></span>
          <PastilleCode liste={STATUTS_TRAVAIL} code={t.statut} />
        </Link>
      ))}
      {cout > 0 && <div className="ligne-info" style={{ fontWeight: 700 }}><span>Coût total des travaux</span><span>{argent(cout)}</span></div>}
    </Section>
  );
}

function Documents({ unite }) {
  const [ajout, setAjout] = useState(false);
  return (
    <Section titre="Documents de l'unité" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Document"}</BoutonTexte>}>
      {ajout && <FormulaireDocument fixe={{ uniteId: unite.id, visibilite: "UNITE" }} onFini={() => setAjout(false)} />}
      {unite.documents.length === 0 ? <Vide>Aucun document propre à cette unité (certificat de localisation, plans, rénovations autorisées…).</Vide> : unite.documents.map((d) => (
        <div key={d.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <a href={`/api/copropriete/documents/${d.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13.5 }}>
              {trouver(CATEGORIES_DOCUMENTS, d.categorie)?.icone} {d.titre}
            </a>
            <BoutonSupprimer url={`/api/copropriete/documents/${d.id}`} confirmation={`Supprimer le document « ${d.titre} » ?`}>✕</BoutonSupprimer>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{[d.date && dateLisible(d.date), taille(d.taille), libelle(VISIBILITES, d.visibilite).split(" (")[0]].filter(Boolean).join(" · ")}</div>
        </div>
      ))}
    </Section>
  );
}
