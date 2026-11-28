"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauImmo from "@/app/immobilier/BandeauImmo";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { TYPES_IMMEUBLE } from "@/lib/immobilierCalculs";
import { NavImmo, Formulaire, Recherche, Vide, champsAdresse } from "../ui";
import { CarteImmeuble, GrilleImmeubles, infosLogements } from "../CartesImmeubles";

// Par blocs ; l'adresse au format de l'appli (champsAdresse)
export const champsImmeuble = [
  { nom: "nom", label: "Nom", placeholder: "Triplex Champlain, 85 des Érables…", groupe: "Immeuble" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_IMMEUBLE, defaut: "PLEX" },
  { nom: "anneeConstruction", label: "Année de construction", type: "nombre" },
  { nom: "entrepreneur", label: "Entrepreneur (construit par)", placeholder: "Construction ABC inc." },
  ...champsAdresse({ groupe: "Adresse" }),
  { nom: "dateAchat", label: "Date d'achat", type: "date", groupe: "Achat et valeur" },
  { nom: "prixAchat", label: "Prix d'achat ($)", type: "argent" },
  { nom: "evaluationMunicipale", label: "Évaluation municipale ($)", type: "argent" },
  { nom: "valeurEstimee", label: "Valeur marchande estimée ($)", type: "argent" },
  { nom: "soldeHypotheque", label: "Solde de l'hypothèque ($)", type: "argent" },
  { nom: "notes", label: "Notes", type: "long", lignes: 2, groupe: "Notes" },
];

export default function ImmeublesClient({ immeubles, comptes, reparations, vueRue, visuel }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const affiches = immeubles.filter((i) => !q || correspondRecherche(q, i.nom, i.adresse, i.ville));
  const infos = infosLogements(immeubles, comptes);
  return (
    <div className="conteneur-page">
      <BandeauImmo icone="🏘️" titre="Immeubles" sousTitre="Ton parc immobilier : immeubles, logements et locaux." />
      <NavImmo actif="/immobilier/immeubles" />
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvel immeuble"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsImmeuble} url="/api/immobilier/immeubles" bouton="Ajouter l'immeuble" onFini={(d) => router.push(`/immobilier/immeubles/${d.id}`)} />}
      {immeubles.length > 3 && <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, adresse, ville…" />}
      {affiches.length === 0 ? <Vide>Aucun immeuble.</Vide> : (
        <GrilleImmeubles>
          {affiches.map((i) => (
            <CarteImmeuble key={i.id} immeuble={i} infos={infos} comptes={comptes} moment={visuel.moment} saison={visuel.saison} vueRue={vueRue} reparations={reparations[i.id]} hauteurImage={150} />
          ))}
        </GrilleImmeubles>
      )}
    </div>
  );
}
