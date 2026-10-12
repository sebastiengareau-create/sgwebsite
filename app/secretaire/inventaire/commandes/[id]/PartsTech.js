"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CLIENT } from "@/lib/client";
import { pieceExistante, prixVentePropose } from "@/lib/recherchePieces";

const fmt = (n) => `${n.toFixed(2)} $`;
const CREER = "__creer";

// « 🔌 Chercher dans PartsTech » d'une commande en brouillon : ouvre la
// session PartsTech dans cet onglet ; « Submit Quote » ramène ici avec le
// panier. Voir lib/partstech.js.
export function BoutonPartsTech({ commande, avantOuverture, desactive }) {
  const [numero, setNumero] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function ouvrir(e) {
    e.preventDefault();
    setErreur("");
    if (!(await avantOuverture())) return;
    setEnCours(true);
    const res = await fetch(`/api/commandes-fournisseurs/${commande.id}/partstech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroPiece: numero }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    if (!res?.ok) {
      setEnCours(false);
      return setErreur(data.erreur || "Erreur de connexion.");
    }
    window.location.href = data.redirectUrl;
  }

  return (
    <form onSubmit={ouvrir} style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° de pièce (facultatif)" maxLength={60} style={{ ...champ, flex: 1 }} />
        <button type="submit" disabled={enCours || desactive} className="bouton-3d-sombre" style={{ padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
          {enCours ? "Ouverture…" : "🔌 Chercher dans PartsTech"}
        </button>
      </div>
      <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "4px 0 0" }}>
        Choisis le véhicule et les pièces chez PartsTech, puis « Submit Quote » : le panier revient ici.
      </p>
      {erreur && <p style={{ fontSize: 12, color: "var(--danger)", margin: "4px 0 0" }}>{erreur}</p>}
    </form>
  );
}

// Retour de PartsTech : le panier arrive parfois une seconde après la page.
// La page se recharge quelques fois en l'attendant.
export function AttentePanierPartsTech() {
  const router = useRouter();
  const [essais, setEssais] = useState(0);
  useEffect(() => {
    if (essais >= 10) return;
    const t = setTimeout(() => { setEssais((n) => n + 1); router.refresh(); }, 2000);
    return () => clearTimeout(t);
  }, [essais, router]);
  return (
    <div className="carte" style={{ marginBottom: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
      {essais < 10
        ? "🔌 En attente du panier PartsTech…"
        : "Aucun panier reçu de PartsTech. Retournes-y et clique « Submit Quote » pour l'envoyer ici."}
    </div>
  );
}

// Panier reçu : chaque fournisseur PartsTech est associé à un fournisseur de
// l'appli (proposé : l'association déjà faite, sinon celui de la commande
// quand le panier n'en a qu'un, sinon le même nom), puis le tout s'ajoute —
// à cette commande pour son fournisseur, au brouillon des autres.
export function PanierPartsTech({ commande, panier, fournisseurs, inventaire }) {
  const groupes = panier.panier.fournisseurs;
  const marge = CLIENT.margePrixVente;
  const [choix, setChoix] = useState(() => groupes.map((g) => {
    const associe = g.partstechId != null && fournisseurs.find((f) => f.partstechId === g.partstechId);
    if (associe) return associe.id;
    if (groupes.length === 1 && commande.fournisseur.partstechId == null) return commande.fournisseurId;
    return fournisseurs.find((f) => f.nom.trim().toLowerCase() === g.nom.trim().toLowerCase())?.id || "";
  }));
  const [prixVente, setPrixVente] = useState(() => Object.fromEntries(groupes.flatMap((g, i) => g.pieces.map((p, j) => [
    `${i}-${j}`, p.detail != null ? p.detail.toFixed(2) : prixVentePropose(p.cout, marge),
  ]))));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultats, setResultats] = useState(null);

  const total = groupes.reduce((s, g) => s + g.pieces.reduce((s2, p) => s2 + (p.cout || 0) * p.qte, 0), 0);

  async function envoyer(methode) {
    if (methode === "DELETE" && !window.confirm("Ignorer ce panier PartsTech ?")) return;
    setEnCours(true);
    setErreur("");
    const res = await fetch(`/api/commandes-fournisseurs/${commande.id}/partstech/${panier.id}`, {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: methode === "POST"
        ? JSON.stringify({ choix: choix.map((c) => (c === CREER ? { creer: true } : { fournisseurId: c })), prixVente })
        : undefined,
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) return setErreur(data.erreur || "Erreur de connexion.");
    if (methode === "DELETE") return recharger();
    setResultats(data.resultats);
  }

  // Les lignes de la commande viennent du serveur : rechargées sans
  // ?partstech=… dans l'adresse
  function recharger() {
    window.location.replace(`/secretaire/inventaire/commandes/${commande.id}`);
  }

  if (resultats) {
    return (
      <div className="carte" style={{ marginBottom: 12, border: "1px solid var(--success)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>✓ Panier PartsTech ajouté</div>
        {resultats.map((r) => (
          <div key={r.commandeId} style={{ fontSize: 12.5, marginBottom: 4 }}>
            {r.pieces} pièce{r.pieces > 1 ? "s" : ""} chez {r.fournisseur} →{" "}
            {r.dansCetteCommande ? "cette commande" : <Link href={`/secretaire/inventaire/commandes/${r.commandeId}`} style={{ color: "var(--accent)", fontWeight: 700 }}>commande {r.numero}</Link>}
          </div>
        ))}
        <button onClick={recharger} className="bouton-3d" style={{ marginTop: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>OK</button>
      </div>
    );
  }

  return (
    <div className="carte" style={{ marginBottom: 12, border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔌 Panier PartsTech reçu</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmt(total)} avant taxes</div>
      </div>
      {groupes.map((g, i) => {
        const fournisseurId = choix[i] === CREER ? null : choix[i];
        return (
          <div key={i} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{g.nom}{g.magasin && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> — {g.magasin}</span>}</div>
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", margin: "6px 0 3px" }}>Fournisseur dans l'appli</label>
            <select value={choix[i]} onChange={(e) => setChoix((cs) => cs.map((c, k) => (k === i ? e.target.value : c)))} style={{ ...champ, width: "100%" }}>
              <option value="">— Choisir —</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}{f.id === commande.fournisseurId ? " (cette commande)" : ""}</option>)}
              <option value={CREER}>+ Créer « {g.nom} »</option>
            </select>
            {choix[i] && (choix[i] !== commande.fournisseurId || commande.statut !== "BROUILLON") && (
              <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "4px 0 0" }}>Ces pièces iront dans le brouillon de commande de ce fournisseur (créé au besoin).</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {g.pieces.map((p, j) => {
                const existante = pieceExistante(p.numero, fournisseurId, inventaire);
                return (
                  <div key={j} style={{ fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                        <strong>{p.qte} ×</strong> {p.nom || "(sans nom)"} <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{p.numero}</span>
                      </span>
                      <span style={{ flexShrink: 0 }}>{p.cout != null ? fmt(p.cout) : "prix ?"}{p.consigne > 0 && <span style={{ color: "var(--text-muted)" }}> + {fmt(p.consigne)} consigne</span>}</span>
                    </div>
                    {existante ? (
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Fiche d'inventaire : {existante.nom} ({existante.numero}) — vendue {fmt(existante.prix)}</div>
                    ) : (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>
                        Nouvelle pièce — prix de vente ($)
                        <input
                          value={prixVente[`${i}-${j}`] || ""}
                          onChange={(e) => setPrixVente((pv) => ({ ...pv, [`${i}-${j}`]: e.target.value }))}
                          inputMode="decimal"
                          style={{ ...champ, width: 90, padding: "4px 6px", fontSize: 12 }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {erreur && <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 8px" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => envoyer("POST")} disabled={enCours || choix.some((c) => !c)} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
          {enCours ? "Ajout…" : "🛒 Ajouter aux commandes"}
        </button>
        <button onClick={() => envoyer("DELETE")} disabled={enCours} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Ignorer ce panier</button>
      </div>
    </div>
  );
}

const champ = { padding: "7px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box", minWidth: 0 };
