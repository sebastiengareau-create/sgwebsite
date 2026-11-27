"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import { TYPES_IMMEUBLE, argent, trouver, bailActuel, tauxOccupation } from "@/lib/immobilierCalculs";
import { NavImmo, Formulaire, Recherche, CarteListe, Vide } from "../ui";
import { VignetteBatiment } from "../../components/PhotoBatiment";
import { adresseComplete } from "@/lib/photoBatiment";

export const champsImmeuble = [
  { nom: "nom", label: "Nom", placeholder: "Triplex Champlain, 85 des Érables…" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_IMMEUBLE, defaut: "PLEX" },
  { nom: "adresse", label: "Adresse", pleineLargeur: true },
  { nom: "ville", label: "Ville" },
  { nom: "codePostal", label: "Code postal" },
  { nom: "anneeConstruction", label: "Année de construction", type: "nombre" },
  { nom: "entrepreneur", label: "Entrepreneur (construit par)", placeholder: "Construction ABC inc." },
  { nom: "dateAchat", label: "Date d'achat", type: "date" },
  { nom: "prixAchat", label: "Prix d'achat ($)", type: "argent" },
  { nom: "evaluationMunicipale", label: "Évaluation municipale ($)", type: "argent" },
  { nom: "valeurEstimee", label: "Valeur marchande estimée ($)", type: "argent" },
  { nom: "soldeHypotheque", label: "Solde de l'hypothèque ($)", type: "argent" },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

export default function ImmeublesClient({ immeubles, comptes, reparations, vueRue }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const affiches = immeubles.filter((i) => !q || correspondRecherche(q, i.nom, i.adresse, i.ville));
  return (
    <div className="conteneur-page">
      <BandeauSection icone="🏘️" titre="Immeubles" sousTitre="Ton parc immobilier : immeubles, logements et locaux." />
      <NavImmo actif="/immobilier/immeubles" />
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvel immeuble"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsImmeuble} url="/api/immobilier/immeubles" bouton="Ajouter l'immeuble" onFini={(d) => router.push(`/immobilier/immeubles/${d.id}`)} />}
      {immeubles.length > 3 && <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, adresse, ville…" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affiches.map((i) => {
          const baux = i.logements.map(bailActuel).filter(Boolean);
          const loyers = baux.reduce((s, b) => s + b.loyer, 0);
          const retard = baux.reduce((s, b) => s + (comptes[b.id]?.enRetard || 0), 0);
          const vacants = i.logements.length - baux.length;
          return (
            <CarteListe
              key={i.id} href={`/immobilier/immeubles/${i.id}`}
              image={<VignetteBatiment urlApi={`/api/immobilier/immeubles/${i.id}/photo`} photoLe={i.photo?.ajouteeLe} adresse={adresseComplete(i)} vueRue={vueRue} />}
              couleur={retard > 0.005 ? "var(--danger)" : vacants > 0 ? "var(--accent)" : "var(--success)"}
              titre={<>{trouver(TYPES_IMMEUBLE, i.type)?.icone} {i.nom}</>}
              sousTitre={[
                [i.adresse, i.ville].filter(Boolean).join(", "),
                `${i.logements.length} logement${i.logements.length > 1 ? "s" : ""}`,
                vacants > 0 && `${vacants} vacant${vacants > 1 ? "s" : ""}`,
                reparations[i.id] && `${reparations[i.id]} réparation${reparations[i.id] > 1 ? "s" : ""} ouverte${reparations[i.id] > 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
              droite={<>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{argent(loyers)}</div>
                <div style={{ color: "var(--text-muted)" }}>par mois · {String(tauxOccupation(i.logements)).replace(".", ",")} % occupé</div>
                {retard > 0.005 && <div style={{ fontWeight: 700, color: "var(--danger)" }}>Retards : {argent(retard)}</div>}
              </>}
            />
          );
        })}
        {affiches.length === 0 && <Vide>Aucun immeuble.</Vide>}
      </div>
    </div>
  );
}
