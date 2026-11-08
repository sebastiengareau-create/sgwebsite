"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import {
  TYPES_UNITE, TYPES_ESPACE, MODES_ESPACE, argent, pourcent, libelle, trouver, nomsProprietaires,
} from "@/lib/coproprieteCalculs";
import {
  NavCopro, Section, Formulaire, Onglets, Recherche, CarteListe, Vide, BoutonTexte, BoutonSupprimer, Tableau, cellule, celluleDroite, valeursDe,
} from "../ui";

export const champsUnite = (batiments) => [
  { nom: "numero", label: "Numéro d'unité" },
  { nom: "type", label: "Type", type: "choix", options: TYPES_UNITE, defaut: "LOGEMENT" },
  ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: batiments.map((b) => ({ code: b.id, label: b.nom })) }] : []),
  { nom: "quotePart", label: "Quote-part (%)", type: "nombre", placeholder: "ex. 2,345" },
  { nom: "etage", label: "Étage" },
  { nom: "superficie", label: "Superficie (pi²)", type: "nombre" },
  { nom: "numeroLot", label: "Numéro de lot (cadastre)" },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

export const champsEspace = (batiments, unites) => [
  { nom: "type", label: "Type", type: "choix", options: TYPES_ESPACE, defaut: "STATIONNEMENT" },
  { nom: "numero", label: "Numéro" },
  { nom: "uniteId", label: "Attribué à l'unité", type: "choix", vide: "— libre —", options: unites.map((u) => ({ code: u.id, label: u.numero })) },
  { nom: "mode", label: "Statut", type: "choix", options: MODES_ESPACE, defaut: "USAGE_RESTREINT" },
  { nom: "fraisMensuel", label: "Frais mensuels ($)", type: "nombre", placeholder: "0,00" },
  { nom: "emplacement", label: "Emplacement", placeholder: "Garage P1, casier B…" },
  ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: batiments.map((b) => ({ code: b.id, label: b.nom })) }] : []),
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

const champsBatiment = [
  { nom: "nom", label: "Nom", placeholder: "Bâtiment A, Phase 1…" },
  { nom: "adresse", label: "Adresse", pleineLargeur: true },
  { nom: "anneeConstruction", label: "Année de construction", type: "nombre" },
  { nom: "nbEtages", label: "Nombre d'étages", type: "nombre" },
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

const ONGLETS = [
  { code: "UNITES", label: "Unités" },
  { code: "ESPACES", label: "Stationnements et rangements" },
  { code: "BATIMENTS", label: "Bâtiments" },
];

export default function UnitesClient({ unites, batiments, espaces, soldes }) {
  const [onglet, setOnglet] = useState("UNITES");
  return (
    <div className="conteneur-page">
      <BandeauSection icone="🏠" titre="Unités" sousTitre="Parties privatives, quotes-parts, stationnements, rangements et bâtiments." />
      <NavCopro actif="/copropriete/unites" />
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      {onglet === "UNITES" && <ListeUnites unites={unites} batiments={batiments} soldes={soldes} />}
      {onglet === "ESPACES" && <ListeEspaces espaces={espaces} batiments={batiments} unites={unites} />}
      {onglet === "BATIMENTS" && <ListeBatiments batiments={batiments} />}
    </div>
  );
}

function ListeUnites({ unites, batiments, soldes }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const affichees = unites.filter((u) => !q || correspondRecherche(q, u.numero, nomsProprietaires(u), u.batiment?.nom, ...u.occupants.map((o) => o.nom)));
  const totalQp = unites.reduce((s, u) => s + (u.quotePart || 0), 0);
  const ecart = unites.length > 0 && Math.abs(totalQp - 100) > 0.001;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvelle unité"}</BoutonPlein>
        <span style={{ fontSize: 12.5, color: ecart ? "var(--danger)" : "var(--text-muted)", fontWeight: ecart ? 700 : 400 }}>
          {unites.length} unité{unites.length > 1 ? "s" : ""} · quotes-parts : {pourcent(totalQp)}{ecart && " (devrait faire 100 %)"}
        </span>
      </div>
      {formulaire && <Formulaire champs={champsUnite(batiments)} url="/api/copropriete/unites" bouton="Ajouter l'unité" onFini={(d) => router.push(`/copropriete/unites/${d.id}`)} />}
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Numéro, propriétaire, locataire…" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((u) => {
          const type = trouver(TYPES_UNITE, u.type);
          const solde = Math.round((soldes[u.id] || 0) * 100) / 100;
          const locataires = u.occupants.filter((o) => o.type === "LOCATAIRE");
          return (
            <CarteListe
              key={u.id} href={`/copropriete/unites/${u.id}`}
              couleur={solde > 0.005 ? "var(--danger)" : u.proprietes.length === 0 ? "var(--accent)" : "var(--success)"}
              titre={<>{type?.icone} Unité {u.numero}</>}
              sousTitre={[
                nomsProprietaires(u) || "Aucun propriétaire inscrit",
                locataires.length > 0 && `louée à ${locataires.map((o) => o.nom).join(", ")}`,
                u.batiment?.nom,
                u.etage && `étage ${u.etage}`,
                u._count.espaces > 0 && `${u._count.espaces} espace${u._count.espaces > 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
              droite={<>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{pourcent(u.quotePart)}</div>
                <div style={{ color: "var(--text-muted)" }}>quote-part</div>
                {Math.abs(solde) > 0.005 && <div style={{ fontWeight: 700, color: solde > 0 ? "var(--danger)" : "var(--success)" }}>{solde > 0 ? `Doit ${argent(solde)}` : `Crédit ${argent(-solde)}`}</div>}
              </>}
            />
          );
        })}
        {affichees.length === 0 && <Vide>Aucune unité.</Vide>}
      </div>
    </>
  );
}

function ListeEspaces({ espaces, batiments, unites }) {
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(null);
  const champs = champsEspace(batiments, unites);
  return (
    <>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Stationnements et rangements qui ne sont pas des fractions (parties communes à usage restreint ou loués). Ceux qui sont des fractions s'ajoutent comme unités. Les frais mensuels s'ajoutent aux cotisations de l'unité.
      </p>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvel espace"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champs} url="/api/copropriete/espaces" bouton="Ajouter" onFini={() => setFormulaire(false)} />}
      {edition && (
        <Formulaire key={edition.id} champs={champs} initial={valeursDe(edition, champs)} url={`/api/copropriete/espaces/${edition.id}`} methode="PATCH" bouton={`Enregistrer ${edition.numero}`} onFini={() => setEdition(null)} />
      )}
      <div className="carte">
        {espaces.length === 0 ? <Vide>Aucun stationnement ni rangement inscrit.</Vide> : (
          <Tableau entetes={["Espace", "Unité", "Statut", "Frais / mois", ""]} alignDroite={[3]}>
            {espaces.map((e) => (
              <tr key={e.id}>
                <td style={cellule}>{trouver(TYPES_ESPACE, e.type)?.icone} <strong>{e.numero}</strong>{e.emplacement && <span style={{ color: "var(--text-muted)" }}> · {e.emplacement}</span>}</td>
                <td style={cellule}>{e.unite ? <a href={`/copropriete/unites/${e.unite.id}`} style={{ color: "var(--accent)" }}>{e.unite.numero}</a> : <span style={{ color: "var(--success)" }}>Libre</span>}</td>
                <td style={cellule}>{libelle(MODES_ESPACE, e.mode)}</td>
                <td style={celluleDroite}>{e.fraisMensuel > 0 ? argent(e.fraisMensuel) : "—"}</td>
                <td style={{ ...cellule, whiteSpace: "nowrap", textAlign: "right" }}>
                  <BoutonTexte onClick={() => setEdition(e)}>Modifier</BoutonTexte>{" · "}
                  <BoutonSupprimer url={`/api/copropriete/espaces/${e.id}`} confirmation={`Supprimer l'espace ${e.numero} ?`}>✕</BoutonSupprimer>
                </td>
              </tr>
            ))}
          </Tableau>
        )}
      </div>
    </>
  );
}

function ListeBatiments({ batiments }) {
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(null);
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouveau bâtiment"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsBatiment} url="/api/copropriete/batiments" bouton="Ajouter le bâtiment" onFini={() => setFormulaire(false)} />}
      {batiments.length === 0 && <Vide>Aucun bâtiment : facultatif pour un immeuble seul, utile pour plusieurs bâtiments ou phases.</Vide>}
      {batiments.map((b) => (
        <Section key={b.id} titre={`🏢 ${b.nom}`} droite={<span><BoutonTexte onClick={() => setEdition(edition?.id === b.id ? null : b)}>{edition?.id === b.id ? "Annuler" : "Modifier"}</BoutonTexte></span>}>
          {edition?.id === b.id ? (
            <Formulaire cadre={false} champs={champsBatiment} initial={valeursDe(b, champsBatiment)} url={`/api/copropriete/batiments/${b.id}`} methode="PATCH" onFini={() => setEdition(null)} />
          ) : (
            <>
              <div className="ligne-info"><span>Adresse</span><span>{b.adresse || "—"}</span></div>
              <div className="ligne-info"><span>Unités</span><span>{b._count.unites}</span></div>
              {b.anneeConstruction && <div className="ligne-info"><span>Construit en</span><span>{b.anneeConstruction}</span></div>}
              {b.nbEtages != null && <div className="ligne-info"><span>Étages</span><span>{b.nbEtages}</span></div>}
              {b.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{b.notes}</p>}
              <div style={{ marginTop: 8 }}><BoutonSupprimer url={`/api/copropriete/batiments/${b.id}`} confirmation={`Supprimer ${b.nom} ? Ses unités resteront, sans bâtiment.`} /></div>
            </>
          )}
        </Section>
      ))}
    </>
  );
}
