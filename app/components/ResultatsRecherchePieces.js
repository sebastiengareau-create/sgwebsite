"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT } from "@/lib/client";
import { pieceExistante, prixVentePropose } from "@/lib/recherchePieces";

// Ce qu'on fait d'un résultat collé dans « 🔎 Rechercher des pièces »
// (RecherchePieces.js), selon l'endroit : bon de travail ou commande de
// pièces en brouillon. Chacun reçoit lu ({ description,
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

// Commande de pièces en brouillon : la pièce s'ajoute à cette commande —
// même logique que « 🛒 Commander » d'un bon (fiche trouvée par le numéro,
// sinon créée).
export function ResultatPourCommande({ lu, inventaire, commande, onAjoutee, terminer }) {
  const marge = CLIENT.margePrixVente;
  const cout = lu.prix != null ? lu.prix.toFixed(2) : "";
  const [ligne, setLigne] = useState({
    description: lu.description, numero: lu.numero, qte: "1", coutUnitaire: cout,
    prixVente: prixVentePropose(cout, marge),
  });
  const [prixVenteManuel, setPrixVenteManuel] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const maj = (champ) => (e) => setLigne({ ...ligne, [champ]: e.target.value });
  const existante = pieceExistante(ligne.numero, commande.fournisseurId, inventaire);

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
      body: JSON.stringify({ ...ligne, qte: Number(ligne.qte), prixVente: existante ? undefined : ligne.prixVente, commandeId: commande.id }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) return setErreur(data.erreur || "Erreur de connexion.");
    terminer(`« ${data.piece.nom} » ajoutée à la commande ${data.numero}${data.pieceCreee ? " (nouvelle fiche d'inventaire)" : ""} ✓`);
    onAjoutee(data);
  }

  return (
    <form onSubmit={commander} style={grille}>
      <Champ libelle="Description" plein>
        <input value={ligne.description} onChange={maj("description")} maxLength={150} className="champ" required />
      </Champ>
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
        Elle s'ajoute à cette commande ; le stock entre à la réception.
      </p>
      <Bouton enCours={enCours} libelle="🛒 Ajouter à cette commande" />
      {erreur && <Erreur texte={erreur} />}
    </form>
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
