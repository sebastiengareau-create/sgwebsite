"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BandeauCopro from "@/app/copropriete/BandeauCopro";
import { BoutonPlein } from "../../components/StyleSection";
import { correspondRecherche } from "@/lib/recherche";
import PhotoBatiment from "../../components/PhotoBatiment";
import { adresseComplete } from "@/lib/photoBatiment";
import { adresseComplete as adresseLisible } from "@/lib/adresse";
import { FacadeIllustree } from "../../components/RueIllustree";
import { etatUnite, ETATS_UNITE, batimentsPourRue } from "@/lib/coproprieteVisuel";
import {
  TYPES_UNITE, TYPES_ESPACE, MODES_ESPACE, argent, pourcent, libelle, trouver, nomsProprietaires, nomUnite,
} from "@/lib/coproprieteCalculs";
import {
  NavCopro, Section, Formulaire, Onglets, Recherche, CarteListe, Vide, BoutonTexte, BoutonSupprimer, Tableau, cellule, celluleDroite, valeursDe, champsAdresse,
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
  { nom: "uniteId", label: "Attribué à l'unité", type: "choix", vide: "— libre —", options: unites.map((u) => ({ code: u.id, label: nomUnite(u) })) },
  { nom: "mode", label: "Statut", type: "choix", options: MODES_ESPACE, defaut: "USAGE_RESTREINT" },
  { nom: "fraisMensuel", label: "Frais mensuels ($)", type: "argent" },
  { nom: "emplacement", label: "Emplacement", placeholder: "Garage P1, casier B…" },
  ...(batiments.length > 0 ? [{ nom: "batimentId", label: "Bâtiment", type: "choix", vide: "—", options: batiments.map((b) => ({ code: b.id, label: b.nom })) }] : []),
  { nom: "notes", label: "Notes", type: "long", lignes: 2 },
];

// Par blocs ; l'adresse au format de l'appli (champsAdresse)
export const champsBatiment = [
  { nom: "nom", label: "Nom", placeholder: "Bâtiment A, Phase 1…", groupe: "Bâtiment" },
  { nom: "nbEtages", label: "Nombre d'étages", type: "nombre" },
  { nom: "anneeConstruction", label: "Année de construction", type: "nombre" },
  { nom: "entrepreneur", label: "Entrepreneur (construit par)", placeholder: "Construction ABC inc." },
  ...champsAdresse({ groupe: "Adresse" }),
  { nom: "notes", label: "Notes", type: "long", lignes: 2, groupe: "Notes" },
];

const ONGLETS = [
  { code: "UNITES", label: "Unités" },
  { code: "ESPACES", label: "Stationnements et rangements" },
  { code: "BATIMENTS", label: "Bâtiments" },
];

export default function UnitesClient({ unites, batiments, espaces, soldes, vueRue, duCeMois = {}, demandesDe = {}, visuel, ongletInitial }) {
  const [onglet, setOnglet] = useState(ONGLETS.some((o) => o.code === ongletInitial) ? ongletInitial : "UNITES");
  return (
    <div className="conteneur-page">
      <BandeauCopro icone="🏠" titre="Unités" sousTitre="Parties privatives, quotes-parts, stationnements, rangements et bâtiments." />
      <NavCopro actif="/copropriete/unites" />
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      {onglet === "UNITES" && <ListeUnites unites={unites} batiments={batiments} soldes={soldes} />}
      {onglet === "ESPACES" && <ListeEspaces espaces={espaces} batiments={batiments} unites={unites} />}
      {onglet === "BATIMENTS" && <ListeBatiments batiments={batiments} vueRue={vueRue} unites={unites} soldes={soldes} duCeMois={duCeMois} demandesDe={demandesDe} visuel={visuel} />}
    </div>
  );
}

function ListeUnites({ unites, batiments, soldes }) {
  const router = useRouter();
  const [formulaire, setFormulaire] = useState(false);
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim().toLowerCase();
  const affichees = unites.filter((u) => !q || correspondRecherche(q, u.numero, nomsProprietaires(u), u.batiment?.nom, ...u.occupants.flatMap((o) => [o.nom, o.clesMagnetiques]), ...u.proprietes.map((p) => p.coproprietaire.clesMagnetiques)));
  // Quotes-parts : 100 % dans chaque bâtiment
  const qpDe = Object.fromEntries(groupesParBatiment(unites, batiments).map((g) => [g.cle, g.unites.reduce((s, u) => s + (u.quotePart || 0), 0)]));
  const ecartDe = (cle) => Math.abs((qpDe[cle] ?? 100) - 100) > 0.001;
  const groupesQp = Object.keys(qpDe);
  const ecarts = groupesQp.filter(ecartDe);
  const ecart = ecarts.length > 0;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouvelle unité"}</BoutonPlein>
        <span style={{ fontSize: 12.5, color: ecart ? "var(--danger)" : "var(--text-muted)", fontWeight: ecart ? 700 : 400 }}>
          {unites.length} unité{unites.length > 1 ? "s" : ""} · quotes-parts : {groupesQp.length > 1
            ? (ecart ? `à vérifier dans ${ecarts.length} bâtiment${ecarts.length > 1 ? "s" : ""} (100 % par bâtiment)` : "100 % dans chaque bâtiment")
            : <>{pourcent(qpDe[groupesQp[0]] || 0)}{ecart && " (devrait faire 100 %)"}</>}
        </span>
      </div>
      {formulaire && <Formulaire champs={champsUnite(batiments)} url="/api/copropriete/unites" bouton="Ajouter l'unité" onFini={(d) => router.push(`/copropriete/unites/${d.id}`)} />}
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Numéro, propriétaire, locataire, clé magnétique…" />
      {groupesParBatiment(affichees, batiments).map((g) => (
        <div key={g.cle} style={{ marginBottom: 14 }}>
          {g.titre && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, margin: "4px 2px 8px" }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-muted)" }}>
                🏢 {g.titre} · {g.unites.length}
                <span style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0, fontWeight: ecartDe(g.cle) ? 800 : 600, color: ecartDe(g.cle) ? "var(--danger)" : "var(--text-muted)" }}>
                  quotes-parts {pourcent(qpDe[g.cle] || 0)}{ecartDe(g.cle) && " (devrait faire 100 %)"}
                </span>
              </span>
              {g.id && <Link href={`/copropriete/batiments/${g.id}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Plan par étages</Link>}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {g.unites.map((u) => {
              const type = trouver(TYPES_UNITE, u.type);
              const solde = Math.round((soldes[u.id] || 0) * 100) / 100;
              const locataires = u.occupants.filter((o) => o.type === "LOCATAIRE");
              return (
                <CarteListe
                  key={u.id} href={`/copropriete/unites/${u.id}`}
                  couleur={solde > 0.005 ? "var(--danger)" : u.proprietes.length === 0 ? "var(--accent)" : "var(--success)"}
                  titre={<>{type?.icone} Unité {u.numero}{[...u.proprietes.map((p) => p.coproprietaire), ...u.occupants].some((x) => x.mobiliteReduite) && <span title="Mobilité réduite : aide pour évacuer"> ♿</span>}</>}
                  sousTitre={[
                    nomsProprietaires(u) || "Aucun propriétaire inscrit",
                    locataires.length > 0 && `louée à ${locataires.map((o) => o.nom).join(", ")}`,
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
          </div>
        </div>
      ))}
      {affichees.length === 0 && <Vide>Aucune unité.</Vide>}
    </>
  );
}

// Unités regroupées par bâtiment (un même numéro peut revenir dans chaque
// bâtiment) ; sans bâtiment du tout, une seule liste sans titre
function groupesParBatiment(unites, batiments) {
  if (batiments.length === 0) return [{ cle: "toutes", titre: null, unites }];
  const groupes = batiments.map((b) => ({ cle: b.id, id: b.id, titre: b.nom, unites: unites.filter((u) => u.batimentId === b.id) }));
  const seules = unites.filter((u) => !batiments.some((b) => b.id === u.batimentId));
  if (seules.length) groupes.push({ cle: "sans", titre: "Sans bâtiment", unites: seules });
  return groupes.filter((g) => g.unites.length > 0);
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

function ListeBatiments({ batiments, vueRue, unites, soldes, duCeMois, demandesDe, visuel }) {
  const [formulaire, setFormulaire] = useState(false);
  const [edition, setEdition] = useState(null);
  // Façade illustrée (une fenêtre par unité) quand il n'y a ni photo ni vue de la rue
  const facades = Object.fromEntries(batimentsPourRue(batiments, unites).map((b) => [b.id, b]));
  const infos = Object.fromEntries(unites.map((u) => {
    const etat = etatUnite({ solde: soldes[u.id] || 0, duCeMois: duCeMois[u.id] || 0, demandes: demandesDe[u.id] || 0, proprietaires: u.proprietes.length });
    return [u.id, { etat, texte: [`Unité ${u.numero}`, nomsProprietaires(u), ETATS_UNITE[etat].toLowerCase()].filter(Boolean).join(" · ") }];
  }));
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>{formulaire ? "Annuler" : "Nouveau bâtiment"}</BoutonPlein>
      </div>
      {formulaire && <Formulaire champs={champsBatiment} url="/api/copropriete/batiments" bouton="Ajouter le bâtiment" onFini={() => setFormulaire(false)} />}
      {batiments.length === 0 && <Vide>Aucun bâtiment : facultatif pour un immeuble seul, utile pour plusieurs bâtiments ou phases.</Vide>}
      {batiments.map((b) => (
        <Section key={b.id} titre={`🏢 ${b.nom}`} droite={<span style={{ display: "flex", gap: 12 }}><Link href={`/copropriete/batiments/${b.id}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Plan par étages</Link><BoutonTexte onClick={() => setEdition(edition?.id === b.id ? null : b)}>{edition?.id === b.id ? "Annuler" : "Modifier"}</BoutonTexte></span>}>
          {edition?.id === b.id ? (
            <Formulaire cadre={false} champs={champsBatiment} initial={valeursDe(b, champsBatiment)} url={`/api/copropriete/batiments/${b.id}`} methode="PATCH" onFini={() => setEdition(null)} />
          ) : (
            <>
              <PhotoBatiment
                urlApi={`/api/copropriete/batiments/${b.id}/photo`} photoLe={b.photo?.ajouteeLe} adresse={adresseComplete(b)} vueRue={vueRue} hauteur={200}
                illustration={visuel && facades[b.id] && <FacadeIllustree immeuble={facades[b.id]} infos={infos} moment={visuel.moment} saison={visuel.saison} hauteur={200} />}
              />
              <div className="ligne-info"><span>Adresse</span><span>{adresseLisible(b) || "—"}</span></div>
              <div className="ligne-info"><span>Unités</span><span>{b._count.unites}</span></div>
              {b.anneeConstruction && <div className="ligne-info"><span>Construit en</span><span>{b.anneeConstruction}</span></div>}
              {b.entrepreneur && <div className="ligne-info"><span>Construit par</span><span>{b.entrepreneur}</span></div>}
              {b.nbEtages != null && <div className="ligne-info"><span>Étages</span><span>{b.nbEtages}</span></div>}
              {b.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{b.notes}</p>}
              <div style={{ marginTop: 8 }}><BoutonSupprimer url={`/api/copropriete/batiments/${b.id}`} confirmation={`Supprimer ${b.nom} ? Ses unités resteront, sans bâtiment ; ses budgets sont supprimés (les cotisations déjà générées restent).`} /></div>
            </>
          )}
        </Section>
      ))}
    </>
  );
}
