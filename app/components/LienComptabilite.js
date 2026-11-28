"use client";

// Écran du lien avec la comptabilité d'un module (Immobilier → Comptabilité,
// Copropriété → Comptabilité ; moteur : lib/lienCompta.js). L'option se
// voit ici ; elle s'active seulement dans Administrateur → Modules. Le
// client y règle la date de départ et le compte des encaissements, voit ce
// qui est aux livres et les écarts à régler.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEINTES, BoutonContour, TitrePanneau, stylePanneau } from "./StyleSection";
import { argent } from "@/lib/format";

const dateHeure = (d) => new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(new Date(d));
const liste = { fontSize: 13, margin: "0 0 0 18px", padding: 0, lineHeight: 1.65, color: "var(--text)" };
const note = { fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" };
const ligne = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 10 };
const bouton = { padding: "7px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700 };
const champ = { padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit" };
const lien = { color: "var(--accent)" };

function Panneau({ titre, icone, teinte, sousTitre, children }) {
  return (
    <div style={stylePanneau}>
      <TitrePanneau icone={icone} teinte={teinte} titre={titre} sousTitre={sousTitre} />
      {children}
    </div>
  );
}

function Alerte({ children }) {
  return <div style={{ background: "var(--danger-fond)", border: "1px solid var(--danger)", color: "var(--text)", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>⚠️ {children}</div>;
}

// entete : bandeau et navigation du module ; titre : « Immobilier relié à
// la comptabilité » ; module : « l'Immobilier » ; points : ce qui va aux
// livres (<li>) ; notes : paragraphes ; encaissements : « Paiements des
// locataires déposés dans » ; postes : « Immeubles — … »
export default function LienComptabilite({ api, entete, titre, module, points, notes = [], encaissements, postes, reglages, dernier, etat, tresorerie, moduleCompta, acces, comptes }) {
  const router = useRouter();
  const [depuis, setDepuis] = useState(reglages.depuis);
  const [resultat, setResultat] = useState(dernier);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const actif = reglages.actif && moduleCompta;

  async function envoyer(corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setEnCours(false);
    if (!res?.ok) return setErreur(data.erreur || "Erreur.");
    if (data.resultat) setResultat(data.resultat);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      {entete}
      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 10px" }}>{erreur}</p>}
      {reglages.actif && !moduleCompta && <Alerte>Le module Comptabilité est désactivé : {module} reste autonome tant qu'il ne l'est pas.</Alerte>}
      {actif && !acces && <p style={{ ...note, margin: "0 0 12px" }}>🔒 Seule une personne qui a aussi l'accès « Comptabilité » peut changer ces réglages.</p>}

      <Panneau icone="banque" teinte={TEINTES.bleu} titre={titre} sousTitre={actif ? `Actif — aux livres à partir du ${reglages.depuis}` : `Non inclus dans cette installation — ${module} est autonome, rien ne va aux livres`}>
        <ul style={liste}>{points}</ul>
        {notes.map((n, i) => <p key={i} style={note}>{n}</p>)}
        {!reglages.actif && <p style={{ ...note, fontWeight: 700, color: "var(--text)" }}>Option offerte avec le forfait : communique avec kontrolshop pour l'ajouter.</p>}
      </Panneau>

      {actif && (
        <Panneau icone="calendrier" teinte={TEINTES.ambre} titre="Réglages">
          <div style={ligne}>
            <span>Aux livres à partir du</span>
            <input type="date" value={depuis} max="9999-12-31" onChange={(e) => setDepuis(e.target.value)} aria-label="Date de départ" style={champ} disabled={!acces} />
            {depuis !== reglages.depuis && <button type="button" onClick={() => envoyer({ depuis })} disabled={enCours} className="bouton-3d" style={bouton}>{enCours ? "…" : "Enregistrer"}</button>}
          </div>
          <p style={{ ...note, marginTop: 0, marginBottom: 12 }}>Ce qui est daté d'avant reste hors des livres : choisis le lendemain du dernier mois déjà entré par ton comptable, pour ne rien compter deux fois.</p>
          <div style={ligne}>
            <span>{encaissements}</span>
            <select value={reglages.tresorerieId || ""} onChange={(e) => envoyer({ tresorerieId: e.target.value })} disabled={enCours || !acces} style={champ} aria-label="Compte des encaissements">
              <option value="">Encaisse / Banque (1000)</option>
              {tresorerie.filter((t) => t.compte.numero !== "1000").map((t) => <option key={t.id} value={t.id}>{t.nom} ({t.compte.numero})</option>)}
            </select>
          </div>
          {comptes.length > 0 && (
            <>
              <p style={{ fontSize: 13, margin: "12px 0 4px", fontWeight: 700 }}>Comptes du plan comptable</p>
              <ul style={liste}>{comptes.map((c) => <li key={c.numero}>{c.numero} — {c.nom}</li>)}</ul>
              <p style={note}>Avec un poste « {postes} » par genre de dépense, dans les comptes à payer. Renomme-les au besoin dans Comptabilité → Plan comptable.</p>
            </>
          )}
        </Panneau>
      )}

      {actif && (
        <Panneau icone="graphique" teinte={TEINTES.vert} titre="Aux livres">
          {etat.ecritures.map((e) => <div key={e.libelle} className="ligne-info"><span>{e.libelle}</span><span>{e.nombre}</span></div>)}
          <div className="ligne-info"><span>Factures à payer</span><span>{etat.aPayer.nombre} · {argent(etat.aPayer.montant)}</span></div>
          <div className="ligne-info"><span>Factures payées</span><span>{etat.payees.nombre} · {argent(etat.payees.montant)}</span></div>
          <p style={note}><Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>Comptes à payer</Link> · <Link href="/gerant/comptabilite" style={lien}>Comptabilité</Link></p>
        </Panneau>
      )}

      {actif && (
        <Panneau icone="horloge" teinte={TEINTES.neutre} titre="Dernière mise à jour des livres" sousTitre={resultat?.le ? dateHeure(resultat.le) : "Pas encore faite"}>
          {resultat?.erreurs?.length > 0 && (
            <Alerte>
              {resultat.erreurs.length} écart{resultat.erreurs.length > 1 ? "s" : ""} à régler :
              <ul style={{ ...liste, marginTop: 6 }}>{resultat.erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
            </Alerte>
          )}
          {resultat?.lignes?.length > 0 ? <ul style={liste}>{resultat.lignes.map((l) => <li key={l}>{l}</li>)}</ul> : !resultat?.erreurs?.length && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Les livres se mettent à jour après chaque changement dans {module}.</p>
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
