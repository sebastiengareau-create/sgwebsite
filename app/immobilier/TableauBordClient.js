"use client";

import Link from "next/link";
import BandeauSection from "../components/BandeauSection";
import {
  argent, dateLisible, trouver, periodeLisible, bailActuel, nomsLocataires, etatFinBail, etatExpiration, rendement, tauxOccupation,
  loyerDuMois, hausseLisible, PRIORITES, CATEGORIES_DOCUMENTS, TYPES_IMMEUBLE,
} from "@/lib/immobilierCalculs";
import { NavImmo, Section, Statistique, Vide, Alerte, PastilleEtat, ListeReparations, Tableau, cellule, celluleDroite, nomLogement, lien } from "./ui";

const rangPriorite = (p) => trouver(PRIORITES, p)?.rang ?? 9;
// Ce qui demande une action d'abord
const RANG_FIN = { ECHU: 0, AVIS_A_ENVOYER: 1, AVIS_ENVOYE: 2, RECONDUIT: 3 };

export default function TableauBordClient({ immeubles, soldes, reparations, documents, bauxFactures, nbLocataires, donnees, periode }) {
  const logements = immeubles.flatMap((i) => i.logements.map((l) => ({ ...l, immeuble: i })));
  const occupes = logements.filter((l) => bailActuel(l));
  const vacants = logements.filter((l) => !bailActuel(l));
  const baux = occupes.map((l) => ({ ...bailActuel(l), logement: l }));
  const revenuMensuel = baux.reduce((s, b) => s + b.loyer, 0);
  const potentielVacants = vacants.reduce((s, l) => s + (l.loyerVise || 0), 0);

  const enRetard = baux.map((b) => ({ ...b, solde: soldes[b.id] || 0 })).filter((b) => b.solde > 0.005).sort((a, b) => b.solde - a.solde);
  const totalRetard = Object.values(soldes).filter((s) => s > 0.005).reduce((s, x) => s + x, 0);
  const aFacturer = baux.filter((b) => loyerDuMois(b, periode) > 0 && !bauxFactures.includes(b.id));

  const echeances = baux
    .map((b) => ({ ...b, etat: etatFinBail(b) }))
    .filter((b) => b.etat.code in RANG_FIN && (b.etat.code !== "AVIS_ENVOYE" || !b.reponseAvis || b.reponseAvis === "QUITTE" || b.etat.joursAvantFin <= 60))
    .sort((a, b) => RANG_FIN[a.etat.code] - RANG_FIN[b.etat.code] || new Date(a.dateFin) - new Date(b.dateFin));
  const avisAEnvoyer = echeances.filter((b) => b.etat.code === "AVIS_A_ENVOYER").length;

  const docsAExpirer = documents.map((d) => ({ ...d, etat: etatExpiration(d.expireLe) })).filter((d) => d.etat && d.etat.code !== "OK");
  const reparationsTriees = [...reparations].sort((a, b) => rangPriorite(a.priorite) - rangPriorite(b.priorite) || new Date(b.creeLe) - new Date(a.creeLe));
  const urgentes = reparations.filter((r) => r.priorite === "URGENTE").length;

  const { lignes, total } = rendement({ immeubles, ...donnees });
  const annee = periode.slice(0, 4);
  const valeur = immeubles.reduce((s, i) => s + (i.valeurEstimee || 0), 0);
  const dette = immeubles.reduce((s, i) => s + (i.soldeHypotheque || 0), 0);

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🏘️" titre="Immobilier" sousTitre="Immeubles, logements, locataires, baux, loyers, réparations et documents." />
      <NavImmo actif="/immobilier" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Statistique valeur={logements.length} label={`Logements · ${immeubles.length} immeuble${immeubles.length > 1 ? "s" : ""}`} note={`${nbLocataires} locataire${nbLocataires > 1 ? "s" : ""}`} teinte="var(--bleu)" />
        <Statistique valeur={`${String(tauxOccupation(logements)).replace(".", ",")} %`} label="Occupation" note={vacants.length > 0 ? `${vacants.length} vacant${vacants.length > 1 ? "s" : ""}` : "Aucun vacant"} teinte={vacants.length > 0 ? "var(--accent)" : "var(--success)"} />
        <Statistique valeur={argent(revenuMensuel)} label="Loyers par mois" note={`${argent(revenuMensuel * 12)} par année`} teinte="var(--success)" />
        <Statistique valeur={argent(totalRetard)} label={`En retard (${enRetard.length} ${enRetard.length > 1 ? "baux" : "bail"})`} teinte={totalRetard > 0 ? "var(--danger)" : "var(--success)"} />
        <Statistique valeur={reparations.length} label="Réparations ouvertes" note={urgentes > 0 ? `${urgentes} urgente${urgentes > 1 ? "s" : ""}` : null} teinte={urgentes > 0 ? "var(--danger)" : "#8C6BC4"} />
        <Statistique valeur={avisAEnvoyer} label="Avis de modification à envoyer" teinte={avisAEnvoyer > 0 ? "var(--accent)" : "var(--success)"} />
      </div>

      {aFacturer.length > 0 && (
        <Alerte couleur="var(--accent)" fond="var(--surface)">
          Les loyers de {periodeLisible(periode)} ne sont pas encore inscrits pour {aFacturer.length} {aFacturer.length > 1 ? "baux" : "bail"} : <Link href="/immobilier/loyers" style={lien}>les générer dans Loyers</Link>.
        </Alerte>
      )}

      {immeubles.length === 0 && (
        <Section titre="Pour commencer">
          <ol style={{ fontSize: 13.5, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Ajoute tes <Link href="/immobilier/immeubles" style={lien}>immeubles</Link>, puis leurs logements et locaux.</li>
            <li>Sur la fiche de chaque logement loué, crée le bail : locataires, loyer, durée, services inclus.</li>
            <li>Chaque mois, génère les loyers dans <Link href="/immobilier/loyers" style={lien}>Loyers</Link> et inscris les paiements reçus.</li>
            <li>Note les <Link href="/immobilier/depenses" style={lien}>dépenses</Link> (taxes, assurance, intérêts…) pour suivre le rendement de chaque immeuble.</li>
            <li>Dépose les baux signés, avis et polices d'assurance dans <Link href="/immobilier/documents" style={lien}>Documents</Link>.</li>
          </ol>
        </Section>
      )}

      <Section titre="Baux à surveiller" droite={<span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Délais d'avis du TAL</span>}>
        {echeances.length === 0 ? <Vide>Aucun bail ne demande d'action pour le moment.</Vide> : echeances.slice(0, 10).map((b) => (
          <Link key={b.id} href={`/immobilier/baux/${b.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
            <span style={{ minWidth: 0 }}>
              <strong>{b.logement.immeuble.nom} · {nomLogement(b.logement)}</strong> — {nomsLocataires(b)}
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {" "}· fin le {dateLisible(b.dateFin)}
                {b.etat.code === "AVIS_A_ENVOYER" && ` · avis au plus tard le ${dateLisible(b.etat.fenetre.fin)}`}
                {b.nouveauLoyer != null && ` · ${hausseLisible(b.loyer, b.nouveauLoyer)}`}
              </span>
            </span>
            <PastilleEtat etat={b.etat} />
          </Link>
        ))}
      </Section>

      <Section titre="Réparations à traiter" droite={<Link href="/immobilier/reparations" style={{ fontSize: 12, ...lien }}>Tout voir</Link>}>
        <ListeReparations reparations={reparationsTriees.slice(0, 8)} vide="Aucune réparation ouverte." />
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <Section titre="Loyers en retard" droite={<Link href="/immobilier/loyers?onglet=RETARDS" style={{ fontSize: 12, ...lien }}>Détail</Link>}>
          {enRetard.length === 0 ? <Vide>Tous les loyers sont payés.</Vide> : enRetard.slice(0, 8).map((b) => (
            <Link key={b.id} href={`/immobilier/baux/${b.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
              <span style={{ minWidth: 0 }}>{nomsLocataires(b)} <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {nomLogement(b.logement)}, {b.logement.immeuble.nom}</span></span>
              <span style={{ color: "var(--danger)", fontWeight: 700, flexShrink: 0 }}>{argent(b.solde)}</span>
            </Link>
          ))}
        </Section>
        <Section titre="Logements vacants">
          {vacants.length === 0 ? <Vide>Tout est loué.</Vide> : (
            <>
              {vacants.map((l) => (
                <Link key={l.id} href={`/immobilier/logements/${l.id}`} className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit" }}>
                  <span>{l.immeuble.nom} · {nomLogement(l)}</span>
                  <span style={{ color: "var(--text-muted)" }}>{l.loyerVise ? `${argent(l.loyerVise)} / mois` : "—"}</span>
                </Link>
              ))}
              {potentielVacants > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>Manque à gagner : {argent(potentielVacants)} par mois.</div>}
            </>
          )}
        </Section>
        <Section titre="Assurances et contrats" droite={<Link href="/immobilier/documents" style={{ fontSize: 12, ...lien }}>Documents</Link>}>
          {docsAExpirer.length === 0 ? <Vide>Rien n'expire d'ici 60 jours.</Vide> : docsAExpirer.map((d) => (
            <a key={d.id} href={`/api/immobilier/documents/${d.id}`} target="_blank" rel="noreferrer" className="ligne-info ligne-pastilles" style={{ textDecoration: "none", color: "inherit", gap: 8 }}>
              <span style={{ minWidth: 0 }}>{trouver(CATEGORIES_DOCUMENTS, d.categorie)?.icone} {d.titre}</span>
              <PastilleEtat etat={d.etat} />
            </a>
          ))}
        </Section>
      </div>

      <Section titre={`Rendement ${annee}`} droite={<Link href="/immobilier/depenses" style={{ fontSize: 12, ...lien }}>Dépenses</Link>}>
        {lignes.length === 0 ? <Vide>Aucun immeuble.</Vide> : (
          <Tableau entetes={["Immeuble", "Loyers perçus", "Dépenses", "Réparations", "Net"]} alignDroite={[1, 2, 3, 4]}>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td style={cellule}><Link href={`/immobilier/immeubles/${l.id}`} style={lien}>{trouver(TYPES_IMMEUBLE, immeubles.find((i) => i.id === l.id)?.type)?.icone} {l.nom}</Link></td>
                <td style={celluleDroite}>{argent(l.percu)}</td>
                <td style={celluleDroite}>{argent(l.depenses)}</td>
                <td style={celluleDroite}>{argent(l.reparations)}</td>
                <td style={{ ...celluleDroite, fontWeight: 700, color: l.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(l.net)}</td>
              </tr>
            ))}
            {lignes.length > 1 && (
              <tr>
                <td style={{ ...cellule, fontWeight: 700 }}>Total</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(total.percu)}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(total.depenses)}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(total.reparations)}</td>
                <td style={{ ...celluleDroite, fontWeight: 800, color: total.net < 0 ? "var(--danger)" : "var(--success)" }}>{argent(total.net)}</td>
              </tr>
            )}
          </Tableau>
        )}
        {valeur > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
            <span>Valeur estimée du parc : <strong style={{ color: "var(--text)" }}>{argent(valeur)}</strong></span>
            <span>Hypothèques : <strong style={{ color: "var(--text)" }}>{argent(dette)}</strong></span>
            <span>Avoir net : <strong style={{ color: "var(--text)" }}>{argent(valeur - dette)}</strong></span>
            <span>Chiffres tirés des loyers, dépenses et réparations inscrits ici (sans lien avec la comptabilité).</span>
          </div>
        )}
      </Section>
    </div>
  );
}
