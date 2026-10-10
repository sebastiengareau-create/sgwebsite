"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CLIENT } from "@/lib/client";
import { pieceExistante, fournisseurPropose, prixVentePropose } from "@/lib/recherchePieces";

// Ce qu'on fait d'un résultat collé dans « 🔎 Rechercher des pièces »
// (RecherchePieces.js), selon l'endroit. Chacun reçoit lu ({ description,
// numero, prix, lien }, à corriger au besoin), site (nom du dernier
// fournisseur ouvert) et terminer(message — texte ou éléments).

// Bon de travail : la pièce s'ajoute à sa liste « à commander »
export function ResultatPourBon({ bonId, sites, lu, site, terminer }) {
  const router = useRouter();
  const [ligne, setLigne] = useState({
    description: lu.description, numero: lu.numero, fournisseur: site,
    prix: lu.prix != null ? lu.prix.toFixed(2) : "", qte: "1", lien: lu.lien,
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (champ) => (e) => setLigne({ ...ligne, [champ]: e.target.value });

  async function ajouter(e) {
    e.preventDefault();
    if (enCours) return;
    setEnCours(true);
    setErreur("");
    const res = await fetch(`/api/bons/${bonId}/pieces-a-commander`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ligne),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) return setErreur(data.erreur || "Erreur de connexion.");
    terminer(`« ${data.description} » ajoutée aux pièces à commander ✓`);
    router.refresh();
  }

  return (
    <form onSubmit={ajouter} style={grille}>
      <Champ libelle="Description" plein>
        <input value={ligne.description} onChange={maj("description")} maxLength={150} className="champ" required />
      </Champ>
      <Champ libelle="N° de pièce">
        <input value={ligne.numero} onChange={maj("numero")} maxLength={60} className="champ" />
      </Champ>
      <Champ libelle="Fournisseur">
        <input value={ligne.fournisseur} onChange={maj("fournisseur")} maxLength={60} list="fournisseurs-recherche-pieces" className="champ" />
        <datalist id="fournisseurs-recherche-pieces">
          {sites.map((s, i) => <option key={i} value={s.nom} />)}
        </datalist>
      </Champ>
      <Champ libelle="Prix unitaire ($)">
        <input value={ligne.prix} onChange={maj("prix")} inputMode="decimal" className="champ" />
      </Champ>
      <Champ libelle="Quantité">
        <input type="number" min={1} max={999} value={ligne.qte} onChange={maj("qte")} className="champ" />
      </Champ>
      <Champ libelle="Lien de la pièce (facultatif)" plein>
        <input value={ligne.lien} onChange={maj("lien")} placeholder="https://…" className="champ" />
      </Champ>
      <Bouton enCours={enCours} libelle="+ Ajouter aux pièces à commander" />
      {erreur && <Erreur texte={erreur} />}
    </form>
  );
}

// Inventaire : une pièce qui y est déjà (même numéro) s'ouvre ; sinon le
// formulaire « Nouvelle pièce » s'ouvre, pré-rempli.
export function ResultatPourInventaire({ lu, site, inventaire, fournisseurs, onCreerFiche }) {
  const existante = pieceExistante(lu.numero, fournisseurPropose(site, fournisseurs), inventaire);
  if (existante) {
    return (
      <div style={{ fontSize: 12.5, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
        Déjà dans l'inventaire : <strong>{existante.nom}</strong> <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>({existante.numero})</span> — {existante.qte} en stock.{" "}
        <Link href={`/secretaire/inventaire/${existante.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>Ouvrir la fiche →</Link>
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12.5 }}>
      <Apercu lu={lu} site={site} />
      <button
        type="button"
        onClick={() => onCreerFiche({ nom: lu.description, numero: lu.numero, coutant: lu.prix != null ? lu.prix.toFixed(2) : "", fournisseurId: fournisseurPropose(site, fournisseurs) })}
        className="bouton-3d"
        style={{ marginTop: 8, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
      >
        + Créer la fiche d'inventaire
      </button>
    </div>
  );
}

// Commandes de pièces : la pièce s'ajoute à une commande — même logique que
// « 🛒 Commander » d'un bon (fiche trouvée par le numéro, sinon créée).
// commande : la commande ouverte (fournisseur fixé) ; sinon le fournisseur
// se choisit et la pièce va dans son brouillon (ou une nouvelle commande).
export function ResultatPourCommande({ lu, site, inventaire, fournisseurs, commande = null, onAjoutee, terminer }) {
  const marge = CLIENT.margePrixVente;
  const cout = lu.prix != null ? lu.prix.toFixed(2) : "";
  const [ligne, setLigne] = useState({
    description: lu.description, numero: lu.numero, qte: "1", coutUnitaire: cout,
    prixVente: prixVentePropose(cout, marge),
    fournisseurId: commande ? commande.fournisseurId : fournisseurPropose(site, fournisseurs),
  });
  const [prixVenteManuel, setPrixVenteManuel] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (champ) => (e) => setLigne({ ...ligne, [champ]: e.target.value });
  const existante = pieceExistante(ligne.numero, ligne.fournisseurId, inventaire);

  function changerCout(e) {
    const valeur = e.target.value;
    setLigne({ ...ligne, coutUnitaire: valeur, ...(!prixVenteManuel && { prixVente: prixVentePropose(valeur, marge) }) });
  }

  async function commander(e) {
    e.preventDefault();
    if (enCours) return;
    setEnCours(true);
    setErreur("");
    const res = await fetch("/api/commandes-fournisseurs/recherche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ligne, qte: Number(ligne.qte), prixVente: existante ? undefined : ligne.prixVente, commandeId: commande?.id }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) return setErreur(data.erreur || "Erreur de connexion.");
    const texte = `« ${data.piece.nom} » ajoutée à la commande ${data.numero}${data.pieceCreee ? " (nouvelle fiche d'inventaire)" : ""} ✓`;
    terminer(commande ? texte : <>{texte} <Link href={`/secretaire/inventaire/commandes/${data.id}`} style={{ color: "var(--accent)", fontWeight: 700 }}>Ouvrir la commande →</Link></>);
    onAjoutee(data);
  }

  if (!commande && fournisseurs.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
        Aucun fournisseur au dossier — ajoute-le d'abord dans <Link href="/gerant/fournisseurs" style={{ color: "var(--accent)" }}>Fournisseurs</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={commander} style={grille}>
      <Champ libelle="Description" plein>
        <input value={ligne.description} onChange={maj("description")} maxLength={150} className="champ" required />
      </Champ>
      {!commande && (
        <Champ libelle="Fournisseur" plein>
          <select value={ligne.fournisseurId} onChange={maj("fournisseurId")} required className="champ">
            <option value="">— Choisir —</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </Champ>
      )}
      <Champ libelle="N° de pièce chez le fournisseur">
        <input value={ligne.numero} onChange={maj("numero")} maxLength={60} required className="champ" />
      </Champ>
      <Champ libelle="Quantité">
        <input type="number" min={1} max={999} value={ligne.qte} onChange={maj("qte")} required className="champ" />
      </Champ>
      <Champ libelle="Coût unitaire ($, avant taxes)">
        <input value={ligne.coutUnitaire} onChange={changerCout} inputMode="decimal" className="champ" />
      </Champ>
      {existante ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "end", paddingBottom: 8 }}>
          Fiche d'inventaire : <strong>{existante.nom}</strong> ({existante.numero}) — vendue {existante.prix.toFixed(2)} $
        </div>
      ) : (
        <Champ libelle="Prix de vente au client ($)">
          <input value={ligne.prixVente} onChange={(e) => { setLigne({ ...ligne, prixVente: e.target.value }); setPrixVenteManuel(e.target.value !== ""); }} inputMode="decimal" required className="champ" />
        </Champ>
      )}
      <p style={{ gridColumn: "1 / -1", fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
        {!existante && <>Nouvelle pièce : une fiche d'inventaire sera créée (« {ligne.description || "…"} », n° {ligne.numero || "…"}, quantité 0). </>}
        {commande
          ? <>Elle s'ajoute à cette commande ; le stock entre à la réception.</>
          : <>Elle s'ajoute au brouillon de commande de ce fournisseur (ou à une nouvelle commande) ; le stock entre à la réception.</>}
      </p>
      <Bouton enCours={enCours} libelle={commande ? "🛒 Ajouter à cette commande" : "🛒 Ajouter à la commande du fournisseur"} />
      {erreur && <Erreur texte={erreur} />}
    </form>
  );
}

function Apercu({ lu, site }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontWeight: 600 }}>{lu.description || "(description non trouvée)"}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        {site && <span>{site}</span>}
        <span style={{ fontFamily: "monospace" }}>N° {lu.numero || "non trouvé"}</span>
        {lu.prix != null && <span>{lu.prix.toFixed(2)} $</span>}
      </div>
    </div>
  );
}

function Champ({ libelle, plein, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "var(--text-muted)", gridColumn: plein ? "1 / -1" : undefined, minWidth: 0 }}>
      {libelle}
      {children}
    </label>
  );
}

function Bouton({ enCours, libelle }) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
        {enCours ? "Ajout…" : libelle}
      </button>
    </div>
  );
}

function Erreur({ texte }) {
  return <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--danger)", margin: 0 }}>{texte}</p>;
}

const grille = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 };
