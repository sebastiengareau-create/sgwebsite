"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauCopro from "@/app/copropriete/BandeauCopro";
import PhotoBatiment from "../../../components/PhotoBatiment";
import { FacadeIllustree } from "../../../components/RueIllustree";
import { adresseComplete } from "@/lib/photoBatiment";
import { adresseComplete as adresseLisible } from "@/lib/adresse";
import { etagesDe } from "@/lib/immobilierVisuel";
import { etatUnite, ETATS_UNITE, batimentsPourRue } from "@/lib/coproprieteVisuel";
import { TYPES_UNITE, TYPES_ESPACE, MODES_ESPACE, STATUTS_DEMANDE, STATUTS_TRAVAIL, argent, pourcent, libelle, trouver, nomsProprietaires } from "@/lib/coproprieteCalculs";
import { champsUnite, champsBatiment } from "../../unites/UnitesClient";
import { NavCopro, Retour, Section, Formulaire, BoutonTexte, BoutonSupprimer, Vide, PastilleCode, Statistique, valeursDe } from "../../ui";

// Couleur de chaque état d'unité sur le plan, du plus pressant au plus calme
const COULEURS_PLAN = { RETARD: "var(--danger)", SURVEILLER: "var(--bleu)", SANS: "var(--avertissement)", OK: "var(--success)" };
const ORDRE_ETATS = ["RETARD", "SURVEILLER", "SANS", "OK"];

export default function BatimentClient({ batiment: b, batiments, soldes, duCeMois, demandesDe, vueRue, visuel }) {
  const etats = Object.fromEntries(b.unites.map((u) => [u.id, etatUnite({ solde: soldes[u.id] || 0, duCeMois: duCeMois[u.id] || 0, demandes: demandesDe[u.id] || 0, proprietaires: u.proprietes.length })]));
  const infos = Object.fromEntries(b.unites.map((u) => [u.id, { etat: etats[u.id], texte: [`Unité ${u.numero}`, nomsProprietaires(u), ETATS_UNITE[etats[u.id]].toLowerCase()].filter(Boolean).join(" · ") }]));
  const facade = batimentsPourRue([b], b.unites)[0];
  const quoteParts = b.unites.reduce((s, u) => s + (u.quotePart || 0), 0);
  const cotisations = b.unites.reduce((s, u) => s + (duCeMois[u.id] || 0), 0);
  const enRetard = b.unites.filter((u) => etats[u.id] === "RETARD").length;
  const habitables = b.unites.filter((u) => u.type === "LOGEMENT" || u.type === "COMMERCIAL").length;
  return (
    <div className="conteneur-page">
      <div style={{ marginBottom: 10 }}><Retour href="/copropriete/unites?onglet=BATIMENTS">Bâtiments</Retour></div>
      <BandeauCopro icone="🏢" titre={b.nom} sousTitre={adresseLisible(b) || "Plan par étages, unités, stationnements et rangements du bâtiment."} />
      <NavCopro actif="/copropriete/unites" />
      <PhotoBatiment
        urlApi={`/api/copropriete/batiments/${b.id}/photo`} photoLe={b.photo?.ajouteeLe} adresse={adresseComplete(b)} vueRue={vueRue} hauteur={220}
        illustration={visuel && <FacadeIllustree immeuble={facade} infos={infos} moment={visuel.moment} saison={visuel.saison} hauteur={220} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={b.unites.length} label={`Unité${b.unites.length > 1 ? "s" : ""}${habitables !== b.unites.length ? ` · ${habitables} habitable${habitables > 1 ? "s" : ""}` : ""}`} teinte="var(--bleu)" />
        <Statistique
          valeur={pourcent(quoteParts)} label="Quotes-parts du bâtiment"
          teinte={Math.abs(quoteParts - 100) > 0.001 && b.unites.length ? "var(--danger)" : "var(--accent)"}
          note={Math.abs(quoteParts - 100) > 0.001 && b.unites.length ? "devraient faire 100 %" : undefined}
        />
        <Statistique valeur={argent(cotisations)} label="Cotisations du mois" teinte="var(--success)" />
        <Statistique valeur={enRetard} label="Unités en retard" teinte={enRetard ? "var(--danger)" : "var(--success)"} />
      </div>
      <Plan batiment={b} etats={etats} soldes={soldes} />
      <Fiche batiment={b} />
      <Espaces batiment={b} />
      <Ouverts batiment={b} />
      {batiments.length > 1 && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 14px" }}>
          Autres bâtiments : {batiments.filter((x) => x.id !== b.id).map((x, i) => <span key={x.id}>{i > 0 && " · "}<Link href={`/copropriete/batiments/${x.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>{x.nom}</Link></span>)}
        </p>
      )}
    </div>
  );
}

// Case d'une unité sur le plan : numéro, propriétaires, locataire, quote-part, solde
function CaseUnite({ unite: u, etat, solde }) {
  const type = trouver(TYPES_UNITE, u.type);
  const locataires = u.occupants.filter((o) => o.type === "LOCATAIRE");
  const mobilite = [...u.proprietes.map((p) => p.coproprietaire), ...u.occupants].some((x) => x.mobiliteReduite);
  const muet = { fontSize: 12, color: "var(--text-muted)" };
  const s = Math.round((solde || 0) * 100) / 100;
  return (
    <div className="case-logement" style={{ position: "relative", border: "1px solid var(--border)", borderLeft: `4px solid ${COULEURS_PLAN[etat]}`, borderRadius: 10, padding: "9px 10px 10px", background: "var(--surface-alt)", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
        <Link href={`/copropriete/unites/${u.id}`} className="lien-etire" style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text)", textDecoration: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {u.type !== "LOGEMENT" && `${type?.icone || ""} `}{u.numero}{mobilite && <span title="Mobilité réduite : aide pour évacuer"> ♿</span>}
        </Link>
        <span style={{ ...muet, flexShrink: 0 }}>{pourcent(u.quotePart)}</span>
      </div>
      <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...(u.proprietes.length === 0 && { fontWeight: 700, color: COULEURS_PLAN.SANS }) }}>
        {nomsProprietaires(u) || "Aucun propriétaire"}
      </span>
      {locataires.length > 0 && <span style={{ ...muet, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Louée à {locataires.map((o) => o.nom).join(", ")}</span>}
      {u.superficie > 0 && <span style={muet}>{Math.round(u.superficie).toLocaleString("fr-CA")} pi²</span>}
      {Math.abs(s) > 0.005 && <span style={{ fontSize: 12.5, fontWeight: 700, color: s > 0 ? (etat === "RETARD" ? "var(--danger)" : "var(--text)") : "var(--success)" }}>{s > 0 ? `Doit ${argent(s)}` : `Crédit ${argent(-s)}`}</span>}
      {etat === "SURVEILLER" && <span style={{ fontSize: 12, fontWeight: 700, color: COULEURS_PLAN.SURVEILLER }}>Demande en cours</span>}
    </div>
  );
}

function Plan({ batiment: b, etats, soldes }) {
  const [ajout, setAjout] = useState(false);
  const presents = ORDRE_ETATS.filter((k) => Object.values(etats).includes(k));
  const groupes = etagesDe(b.unites);
  return (
    <Section titre="Plan du bâtiment" droite={<BoutonTexte onClick={() => setAjout((v) => !v)}>{ajout ? "Annuler" : "+ Unité"}</BoutonTexte>}>
      {ajout && <Formulaire champs={champsUnite([])} extra={{ batimentId: b.id }} url="/api/copropriete/unites" bouton={`Ajouter l'unité à ${b.nom}`} onFini={() => setAjout(false)} />}
      {b.unites.length === 0 ? <Vide>Aucune unité dans ce bâtiment : ajoute ses unités avec leur étage (« RC », « 2 », « Sous-sol »…) pour dessiner le plan.</Vide> : (
        <>
          {presents.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              {presents.map((k) => (
                <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: COULEURS_PLAN[k], display: "inline-block" }} />
                  {ETATS_UNITE[k]} ({Object.values(etats).filter((x) => x === k).length})
                </span>
              ))}
            </div>
          )}
          {groupes.map((g) => (
            <div key={g.cle} style={{ marginBottom: 12 }}>
              {g.label && <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-muted)", margin: "4px 0 6px" }}>{g.label} · {g.logements.length}</div>}
              <div className="plan-immeuble">
                {g.logements.map((u) => <CaseUnite key={u.id} unite={u} etat={etats[u.id]} solde={soldes[u.id]} />)}
              </div>
            </div>
          ))}
          {!b.unites.some((u) => u.etage) && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Inscris l'étage de chaque unité (sa fiche → Modifier) pour les ranger par étage.</p>}
        </>
      )}
    </Section>
  );
}

function Fiche({ batiment: b }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const ligne = (label, valeur) => valeur != null && valeur !== "" && <div className="ligne-info"><span>{label}</span><span>{valeur}</span></div>;
  return (
    <Section titre="Fiche" droite={<BoutonTexte onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</BoutonTexte>}>
      {edition ? (
        <>
          <Formulaire cadre={false} champs={champsBatiment} initial={valeursDe(b, champsBatiment)} url={`/api/copropriete/batiments/${b.id}`} methode="PATCH" onFini={() => setEdition(false)} />
          <div style={{ marginTop: 10 }}>
            <BoutonSupprimer url={`/api/copropriete/batiments/${b.id}`} confirmation={`Supprimer ${b.nom} ? Ses unités resteront, sans bâtiment ; ses budgets sont supprimés (les cotisations déjà générées restent).`} onFini={() => router.push("/copropriete/unites?onglet=BATIMENTS")}>Supprimer le bâtiment</BoutonSupprimer>
          </div>
        </>
      ) : (
        <>
          {ligne("Adresse", adresseLisible(b) || "—")}
          {ligne("Étages", b.nbEtages)}
          {ligne("Construit en", b.anneeConstruction)}
          {ligne("Construit par", b.entrepreneur)}
          {b.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{b.notes}</p>}
        </>
      )}
    </Section>
  );
}

function Espaces({ batiment: b }) {
  if (b.espaces.length === 0) return null;
  return (
    <Section titre="Stationnements et rangements" droite={<Link href="/copropriete/unites?onglet=ESPACES" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Gérer</Link>}>
      {b.espaces.map((e) => (
        <div key={e.id} className="ligne-info">
          <span>{trouver(TYPES_ESPACE, e.type)?.icone} <strong>{e.numero}</strong>{e.emplacement && <span style={{ color: "var(--text-muted)" }}> · {e.emplacement}</span>} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {libelle(MODES_ESPACE, e.mode).toLowerCase()}</span></span>
          <span>{e.unite ? <Link href={`/copropriete/unites/${e.unite.id}`} style={{ color: "var(--accent)" }}>Unité {e.unite.numero}</Link> : <span style={{ color: "var(--success)" }}>Libre</span>}</span>
        </div>
      ))}
    </Section>
  );
}

// Demandes de réparation et bons de travail ouverts dans le bâtiment
function Ouverts({ batiment: b }) {
  return (
    <Section titre="Demandes et travaux en cours" droite={<Link href="/copropriete/entretien" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Entretien</Link>}>
      {b.demandes.length + b.travaux.length === 0 ? <Vide>Aucune demande ni aucun bon de travail ouvert.</Vide> : (
        <>
          {b.demandes.map((d) => (
            <Link key={d.id} href={`/copropriete/demandes/${d.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
              <span style={{ minWidth: 0 }}>🛠️ {d.numero} {d.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {d.unite ? `unité ${d.unite.numero}` : "parties communes"}</span></span>
              <PastilleCode liste={STATUTS_DEMANDE} code={d.statut} />
            </Link>
          ))}
          {b.travaux.map((t) => (
            <Link key={t.id} href={`/copropriete/travaux/${t.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
              <span style={{ minWidth: 0 }}>🧾 {t.numero} {t.titre} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {t.unite ? `unité ${t.unite.numero}` : "parties communes"}</span></span>
              <PastilleCode liste={STATUTS_TRAVAIL} code={t.statut} />
            </Link>
          ))}
        </>
      )}
    </Section>
  );
}
