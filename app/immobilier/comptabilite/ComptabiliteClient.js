"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { TEINTES, BoutonContour } from "../../components/StyleSection";
import { argent } from "@/lib/immobilierCalculs";
import { NavImmo, Panneau, Interrupteur, useApi, Erreur, Alerte, champStyle, lien, RetourArriere } from "../ui";

const dateHeure = (d) => new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(d));
const liste = { fontSize: 13, margin: "0 0 0 18px", padding: 0, lineHeight: 1.65, color: "var(--text)" };
const note = { fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" };
const ligne = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 10 };
const bouton = { padding: "7px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700 };

export default function ComptabiliteClient({ reglages, dernier, etat, tresorerie, moduleCompta, acces, comptes }) {
  const { appeler, enCours, erreur } = useApi();
  const [depuis, setDepuis] = useState(reglages.depuis);
  const [resultat, setResultat] = useState(dernier);
  const actif = reglages.actif && moduleCompta;

  async function envoyer(corps) {
    const data = await appeler("/api/immobilier/comptabilite", "POST", corps);
    if (data?.resultat) setResultat(data.resultat);
  }

  return (
    <div className="conteneur-page">
      <RetourArriere href="/immobilier/depenses" />
      <BandeauSection icone="📚" titre="Lien avec la comptabilité" sousTitre="Loyers, paiements, dépenses et réparations aux livres, aux fournisseurs et aux comptes à payer." />
      <NavImmo actif="/immobilier/depenses" />
      <Erreur texte={erreur} />
      {!moduleCompta && <Alerte>Le module Comptabilité est désactivé (Administrateur → Modules) : l'Immobilier reste autonome.</Alerte>}
      {!acces && <p style={{ ...note, margin: "0 0 12px" }}>🔒 Seule une personne qui a aussi l'accès « Comptabilité » peut changer ces réglages.</p>}

      <Panneau
        icone="banque" teinte={TEINTES.bleu} titre="Relier l'Immobilier à la comptabilité"
        sousTitre={actif ? `Actif depuis le ${reglages.depuis}` : "Inactif — l'Immobilier est autonome, rien ne va aux livres"}
        droite={<Interrupteur actif={actif} libelle="Relier à la comptabilité" onClick={() => envoyer({ actif: !reglages.actif })} disabled={enCours || !acces || (!moduleCompta && !reglages.actif)} />}
      >
        <ul style={liste}>
          <li><strong>Loyers et frais</strong> inscrits aux baux : au compte « Loyers à recevoir » et aux revenus de location.</li>
          <li><strong>Paiements des locataires</strong> : au compte de banque choisi ci-dessous, prêts pour la conciliation bancaire.</li>
          <li><strong>Dépenses des immeubles</strong> : facture du fournisseur aux <Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>comptes à payer</Link>, à payer là comme les autres — ou « déjà payée » à la saisie.</li>
          <li><strong>Réparations terminées</strong> avec un coût réel : facture de l'entrepreneur aux comptes à payer.</li>
          <li><strong>Travaux majeurs</strong> (dépense d'immobilisation) : au compte d'actif « Immeubles — améliorations », pas en dépense.</li>
        </ul>
        <p style={note}>
          Le fournisseur se choisit dans la dépense ou la réparation ; sinon, celui du même nom que « Payé à » ou « Entrepreneur » est repris (ou créé). Taxes : le loyer résidentiel est exonéré, donc la TPS et la TVQ payées sur les dépenses d'un immeuble restent dans la dépense (pas de crédit de taxe).
        </p>
        <p style={note}>
          L'Immobilier reste la source : une correction ou un retrait dans l'Immobilier suit aux livres. Une facture de l'Immobilier se paie aux comptes à payer, mais se modifie ici. Désactiver le lien arrête le suivi ; ce qui est déjà aux livres y reste.
        </p>
      </Panneau>

      <Panneau icone="calendrier" teinte={TEINTES.ambre} titre="Réglages">
        <div style={ligne}>
          <span>Aux livres à partir du</span>
          <input type="date" value={depuis} max="9999-12-31" onChange={(e) => setDepuis(e.target.value)} aria-label="Date de départ" style={{ ...champStyle, width: "auto", marginBottom: 0 }} disabled={!acces} />
          {depuis !== reglages.depuis && (
            <button type="button" onClick={() => envoyer({ depuis })} disabled={enCours} className="bouton-3d" style={bouton}>{enCours ? "…" : "Enregistrer"}</button>
          )}
        </div>
        <p style={{ ...note, marginTop: 0, marginBottom: 12 }}>Ce qui est daté d'avant reste hors des livres : choisis le lendemain du dernier mois déjà entré par ton comptable, pour ne rien compter deux fois.</p>
        <div style={ligne}>
          <span>Paiements des locataires déposés dans</span>
          <select value={reglages.tresorerieId || ""} onChange={(e) => envoyer({ tresorerieId: e.target.value })} disabled={enCours || !acces} style={{ ...champStyle, width: "auto", marginBottom: 0 }} aria-label="Compte des paiements">
            <option value="">Encaisse / Banque (1000)</option>
            {tresorerie.filter((t) => t.compte.numero !== "1000").map((t) => <option key={t.id} value={t.id}>{t.nom} ({t.compte.numero})</option>)}
          </select>
        </div>
        {comptes.length > 0 && (
          <>
            <p style={{ fontSize: 13, margin: "12px 0 4px", fontWeight: 700 }}>Comptes du plan comptable</p>
            <ul style={liste}>{comptes.map((c) => <li key={c.numero}>{c.numero} — {c.nom}</li>)}</ul>
            <p style={note}>Avec un poste « Immeubles — … » par catégorie de dépense, dans le plan comptable. Renomme-les au besoin dans Comptabilité → Plan comptable.</p>
          </>
        )}
      </Panneau>

      {actif && (
        <Panneau icone="graphique" teinte={TEINTES.vert} titre="Aux livres">
          <div className="ligne-info"><span>Écritures de loyers et de frais</span><span>{etat.charges}</span></div>
          <div className="ligne-info"><span>Écritures de paiements</span><span>{etat.paiements}</span></div>
          <div className="ligne-info"><span>Factures à payer</span><span>{etat.aPayer.nombre} · {argent(etat.aPayer.montant)}</span></div>
          <div className="ligne-info"><span>Factures payées</span><span>{etat.payees.nombre} · {argent(etat.payees.montant)}</span></div>
          <p style={note}><Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>Comptes à payer</Link> · <Link href="/gerant/comptabilite" style={lien}>Comptabilité</Link></p>
        </Panneau>
      )}

      {actif && (
        <Panneau
          icone="horloge" teinte={TEINTES.neutre} titre="Dernière mise à jour des livres"
          sousTitre={resultat?.le ? dateHeure(resultat.le) : "Pas encore faite"}
        >
          {resultat?.erreurs?.length > 0 && (
            <Alerte>
              {resultat.erreurs.length} écart{resultat.erreurs.length > 1 ? "s" : ""} à régler :
              <ul style={{ ...liste, marginTop: 6 }}>{resultat.erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
            </Alerte>
          )}
          {resultat?.lignes?.length > 0 ? <ul style={liste}>{resultat.lignes.map((l) => <li key={l}>{l}</li>)}</ul> : !resultat?.erreurs?.length && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Les livres se mettent à jour après chaque changement dans l'Immobilier, et une fois par jour.</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <BoutonContour onClick={() => envoyer({ synchroniser: true })} icone="echange">{enCours ? "Mise à jour…" : "Mettre à jour maintenant"}</BoutonContour>
            <span style={{ ...note, margin: 0, flex: "1 1 220px" }}>Rien n'est inscrit deux fois. Une période verrouillée ou fermée, ou une écriture déjà conciliée, n'est jamais touchée : l'écart paraît ici.</span>
          </div>
        </Panneau>
      )}
    </div>
  );
}
