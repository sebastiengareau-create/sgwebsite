"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, Icone } from "../../../components/StyleSection";
import { argent, dateLisible } from "@/lib/immobilierCalculs";
import { NavImmo, Panneau, Statistique, champStyle, lien, RetourArriere } from "../../ui";

// Même allure que BoutonContour (StyleSection), mais un vrai lien : le PDF et le CSV viennent d'une route d'API
const boutonLien = {
  display: "inline-flex", alignItems: "center", gap: 10, padding: "11px 18px", borderRadius: 12, border: "1.5px solid var(--accent)",
  background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 700, textDecoration: "none",
};

// Ligne « no · libellé … montant »
function Ligne({ no, libelle, montant, note, gras, discret }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 13.5, color: discret ? "var(--text-muted)" : "var(--text)" }}>
      <span style={{ width: 38, flexShrink: 0, fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{no}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: gras ? 800 : 400 }}>
        {libelle}
        {note && <span style={{ display: "block", fontSize: 11.5, color: "var(--avertissement)" }}>{note}</span>}
      </span>
      <span style={{ fontWeight: gras ? 800 : 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{argent(montant)}</span>
    </div>
  );
}

const Titre = ({ children }) => <div style={{ fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, margin: "12px 0 2px" }}>{children}</div>;

function Etat({ e }) {
  const aZero = e.depenses.filter((d) => d.montant === 0).length;
  return (
    <>
      <Titre>Revenus</Titre>
      <Ligne no="8141" libelle="Loyers bruts (loyers inscrits pour l'année)" montant={e.revenus[8141]} />
      <Ligne no="8230" libelle="Autres revenus (frais refacturés)" montant={e.revenus[8230]} discret={e.revenus[8230] === 0} />
      <Ligne libelle="Revenus bruts" montant={e.revenus.total} gras />
      <Ligne libelle="Pour information : paiements reçus dans l'année" montant={e.percu} discret />
      <Titre>Dépenses</Titre>
      {e.depenses.filter((d) => d.montant !== 0).map((d) => <Ligne key={d.ligne} no={d.ligne} libelle={d.label} montant={d.montant} note={d.note} />)}
      {aZero > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0 0 48px" }}>{aZero} ligne{aZero > 1 ? "s" : ""} à zéro.</div>}
      <Ligne libelle="Total des dépenses" montant={e.totalDepenses} gras />
      <div style={{ marginTop: 6 }}>
        <Ligne libelle="Revenu net avant amortissement" montant={e.net} gras />
      </div>
      <Titre>Immobilisations — pour l'amortissement, non déduites</Titre>
      {e.immobilisations.length === 0
        ? <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "6px 0" }}>Aucune.</div>
        : e.immobilisations.map((x, i) => <Ligne key={i} no={x.date ? dateLisible(x.date).replace(/ \d{4}$/, "") : ""} libelle={`${x.description}${x.payeA ? ` — ${x.payeA}` : ""}`} montant={x.montant} />)}
    </>
  );
}

export default function ImpotClient({ etat, annee, courante }) {
  const router = useRouter();
  const t = etat.total;
  const plusieurs = etat.immeubles.length > 1;
  return (
    <div className="conteneur-page">
      <RetourArriere href="/immobilier/depenses" />
      <BandeauSection icone="🧾" titre="Revenus de location pour l'impôt" sousTitre="Lignes du T776 (ARC) — mêmes renseignements au TP-128 de Revenu Québec, un par immeuble." />
      <NavImmo actif="/immobilier/depenses" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <select value={annee} onChange={(e) => router.push(`/immobilier/depenses/impot?annee=${e.target.value}`)} aria-label="Année" style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
          {Array.from({ length: 6 }, (_, i) => courante - i).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <a href={`/api/immobilier/impot?annee=${annee}&format=pdf`} target="_blank" rel="noreferrer" style={boutonLien}><Icone nom="imprimante" taille={18} couleur="var(--accent-ombre)" />PDF pour le comptable</a>
        <a href={`/api/immobilier/impot?annee=${annee}&format=csv`} style={boutonLien}><Icone nom="document" taille={18} couleur="var(--accent-ombre)" />Détail (CSV)</a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 16 }}>
        <Statistique valeur={argent(t.revenus.total)} label={`Revenus bruts ${annee}`} teinte="var(--success)" />
        <Statistique valeur={argent(t.totalDepenses)} label="Dépenses déductibles" teinte="var(--bleu)" />
        <Statistique valeur={argent(t.net)} label="Revenu net avant amortissement" teinte={t.net < 0 ? "var(--danger)" : "var(--accent)"} />
        <Statistique valeur={argent(t.totalImmobilisations)} label="Immobilisations (amortissement)" teinte="#8C6BC4" />
      </div>

      {etat.immeubles.length === 0 && <Panneau icone="immeuble" titre="Aucun immeuble">Ajoute d'abord tes <Link href="/immobilier/immeubles" style={lien}>immeubles</Link>.</Panneau>}
      {etat.immeubles.map((e) => (
        <Panneau key={e.immeuble.id} icone="immeuble" teinte={TEINTES.ambre} titre={e.immeuble.nom} sousTitre={[e.immeuble.adresse, `${e.immeuble.unites} unité${e.immeuble.unites > 1 ? "s" : ""} locative${e.immeuble.unites > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}>
          <Etat e={e} />
        </Panneau>
      ))}
      {plusieurs && (
        <Panneau icone="balance" teinte={TEINTES.bleu} titre="Tous les immeubles" sousTitre={`${t.immeuble.unites} unités locatives`}>
          <Etat e={t} />
        </Panneau>
      )}

      <Panneau icone="livre" teinte={TEINTES.neutre} titre="Ce qu'il faut savoir">
        <ul style={{ fontSize: 13, margin: "0 0 0 18px", padding: 0, lineHeight: 1.6 }}>
          <li>Comptabilité d'exercice : les loyers inscrits pour l'année comptent, même s'ils n'ont pas encore été payés ; un loyer jamais perçu se traite avec le comptable (créance irrécouvrable).</li>
          <li>Les travaux majeurs et achats durables (toiture, fenêtres, chauffe-eau, électroménagers…) ne se déduisent pas d'un coup : ils s'amortissent. Coche « Dépense d'immobilisation » sur la réparation, ou choisis la catégorie « Travaux majeurs, achat durable » dans les <Link href={`/immobilier/depenses?annee=${annee}`} style={lien}>dépenses</Link>.</li>
          <li>Seuls les intérêts de l'hypothèque se déduisent, pas le remboursement du capital.</li>
          <li>Restent à établir avec le comptable : la déduction pour amortissement (DPA), la partie personnelle si tu habites l'immeuble, et la part de chaque copropriétaire.</li>
        </ul>
      </Panneau>
    </div>
  );
}
