"use client";

// Personnes qui habitent une unité, autres que le copropriétaire : locataires,
// conjoint, enfants… Avec ce qu'il faut savoir en cas d'urgence (mobilité
// réduite) et leurs clés magnétiques. Même liste sur la fiche de l'unité et
// sur celle du copropriétaire (toutes ses unités).

import { useState } from "react";
import { Pastille } from "../components/StyleSection";
import { TYPES_OCCUPANT, libelle, dateLisible } from "@/lib/coproprieteCalculs";
import { Section, Formulaire, BoutonTexte, BoutonSupprimer, Vide, valeursDe, aujourdhui } from "./ui";

const champsOccupant = (unites) => [
  ...(unites.length > 1 ? [{ nom: "uniteId", label: "Unité", type: "choix", options: unites.map((u) => ({ code: u.id, label: `Unité ${u.numero}` })) }] : []),
  { nom: "type", label: "Type", type: "choix", options: TYPES_OCCUPANT, defaut: "LOCATAIRE" },
  { nom: "nom", label: "Nom" },
  { nom: "relation", label: "Lien (conjoint, enfant, parent…)" },
  { nom: "telephone", label: "Téléphone", typeHtml: "tel" },
  { nom: "courriel", label: "Courriel", typeHtml: "email" },
  { nom: "clesMagnetiques", label: "Clé(s) magnétique(s) — numéros", placeholder: "ex. 04512, 04513" },
  { nom: "dateDebut", label: "Arrivée", type: "date" },
  { nom: "dateFin", label: "Départ", type: "date" },
  { nom: "mobiliteReduite", label: "♿ Mobilité réduite : a besoin d'aide pour évacuer", type: "case" },
  { nom: "besoinsParticuliers", label: "Précisions pour l'évacuation (fauteuil roulant, malentendant, oxygène…)", pleineLargeur: true },
  { nom: "notes", label: "Notes (bail, véhicule, animal…)", type: "long", lignes: 2 },
];

export function PastilleMobilite({ besoins }) {
  return <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">♿ Mobilité réduite{besoins ? ` — ${besoins}` : ""}</Pastille>;
}

// unites : [{ id, numero, occupants }] ; typeDefaut : type proposé à l'ajout
export function Occupants({ unites, titre = "Occupants et locataires", typeDefaut = "LOCATAIRE", vide = "Aucun occupant inscrit." }) {
  const [ajout, setAjout] = useState(false);
  const [edition, setEdition] = useState(null);
  const champs = champsOccupant(unites);
  const plusieurs = unites.length > 1;
  const tous = unites.flatMap((u) => u.occupants.map((o) => ({ ...o, uniteId: u.id, numeroUnite: u.numero })));
  const actuels = tous.filter((o) => !o.dateFin);
  const anciens = tous.filter((o) => o.dateFin);
  const ligne = (o) => (
    <div key={o.id} className="ligne-info" style={{ gap: 8, opacity: o.dateFin ? 0.75 : 1 }}>
      <span style={{ minWidth: 0 }}>
        <strong>{o.nom}</strong>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {" "}· {[o.relation, libelle(TYPES_OCCUPANT, o.type), plusieurs && `unité ${o.numeroUnite}`].filter(Boolean).join(" · ")}
          {o.telephone && <> · <a href={`tel:${o.telephone}`} style={{ color: "var(--accent)" }}>{o.telephone}</a></>}
          {o.courriel && ` · ${o.courriel}`}
          {o.dateDebut && ` · depuis le ${dateLisible(o.dateDebut)}`}{o.dateFin && ` → ${dateLisible(o.dateFin)}`}
        </span>
        {(o.mobiliteReduite || o.clesMagnetiques) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 3, fontSize: 12 }}>
            {o.mobiliteReduite && !o.dateFin && <PastilleMobilite besoins={o.besoinsParticuliers} />}
            {o.clesMagnetiques && <span>🔑 {o.clesMagnetiques}</span>}
          </div>
        )}
        {o.notes && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{o.notes}</div>}
      </span>
      <span style={{ whiteSpace: "nowrap" }}>
        <BoutonTexte onClick={() => setEdition(edition?.id === o.id ? null : o)}>Modifier</BoutonTexte>{" · "}
        <BoutonSupprimer url={`/api/copropriete/occupants/${o.id}`} confirmation={`Supprimer ${o.nom} ?`}>✕</BoutonSupprimer>
      </span>
    </div>
  );
  return (
    <Section titre={titre} droite={<BoutonTexte onClick={() => { setAjout((v) => !v); setEdition(null); }}>{ajout ? "Annuler" : "+ Personne"}</BoutonTexte>}>
      {ajout && (
        <Formulaire
          champs={champs} initial={{ type: typeDefaut, uniteId: unites[0]?.id, dateDebut: aujourdhui() }}
          url="/api/copropriete/occupants" extra={plusieurs ? undefined : { uniteId: unites[0]?.id }} bouton="Ajouter" onFini={() => setAjout(false)}
        />
      )}
      {edition && (
        <Formulaire
          key={edition.id} champs={champs} initial={valeursDe(edition, champs)}
          url={`/api/copropriete/occupants/${edition.id}`} methode="PATCH" bouton={`Enregistrer ${edition.nom}`} onFini={() => setEdition(null)}
        />
      )}
      {actuels.length === 0 ? <Vide>{vide}</Vide> : actuels.map(ligne)}
      {anciens.length > 0 && <><div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "12px 0 4px" }}>Anciens occupants</div>{anciens.map(ligne)}</>}
    </Section>
  );
}
