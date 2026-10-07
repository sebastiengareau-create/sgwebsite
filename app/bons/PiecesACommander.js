"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CLIENT } from "@/lib/client";
import { STATUTS_COMMANDE } from "@/lib/commandesFournisseurs";

// Pièces trouvées chez un fournisseur et notées à commander pour ce bon
// (collées dans « 🔎 Rechercher des pièces »). « 🛒 Commander » les met dans
// une commande fournisseur et sur une tâche du bon en B/O (comptée dans le
// total, pas encore sortie du stock) ; la suite suit le circuit des
// commandes : commande passée, recevoir avec la facture (stock + dépense à payer,
// la pièce B/O sort alors du stock), payer.
export default function PiecesACommander({ bon, lignes, inventaire, fournisseurs, modifiable, peutCommander, verrouille }) {
  const router = useRouter();
  const [erreur, setErreur] = useState("");
  const [commandeOuverte, setCommandeOuverte] = useState(null);

  async function modifier(ligne, data) {
    setErreur("");
    const res = await fetch(`/api/bons/${bon.id}/pieces-a-commander/${ligne.id}`, {
      method: data ? "PATCH" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    }).catch(() => null);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) || {};
      setErreur(d.erreur || "Erreur de connexion.");
      return;
    }
    router.refresh();
  }

  if (lignes.length === 0) return null;
  const restantes = lignes.filter((l) => !l.commandee).length;

  return (
    <div style={{ marginTop: 20, paddingBottom: 72 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)", marginBottom: 8 }}>
        📦 Pièces à commander ({restantes ? `${restantes} à commander` : "toutes commandées"})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lignes.map((l) => {
          // Commande annulée : la pièce peut être commandée de nouveau
          const enCommande = l.commande && l.commande.statut !== "ANNULEE";
          return (
            <div key={l.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {!enCommande && (
                  <input
                    type="checkbox"
                    checked={l.commandee}
                    disabled={!modifiable}
                    onChange={() => modifier(l, { commandee: !l.commandee })}
                    title={l.commandee ? "Commandée" : "Cocher une fois commandée (hors du logiciel)"}
                    style={{ marginTop: 3 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <div style={{ textDecoration: l.commandee && !enCommande ? "line-through" : "none", overflowWrap: "anywhere" }}>
                    {l.qte > 1 && <strong>{l.qte} × </strong>}{l.description}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                    {l.fournisseur && <span>{l.fournisseur}</span>}
                    {l.numero && <span style={{ fontFamily: "monospace", userSelect: "all" }}>N° {l.numero}</span>}
                    {l.prix != null && <span>{l.prix.toFixed(2)} $</span>}
                    {l.lien && <a href={l.lien} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>↗ Voir sur le site</a>}
                  </div>
                </div>
                {modifiable && !enCommande && (
                  <button onClick={() => { if (window.confirm(`Retirer « ${l.description} » des pièces à commander ?`)) modifier(l, null); }} style={boutonTexte} aria-label="Retirer">✕</button>
                )}
              </div>

              {enCommande ? (
                <SuiviCommande bon={bon} ligne={l} />
              ) : peutCommander && modifiable && !verrouille && (
                commandeOuverte === l.id ? (
                  <FormulaireCommande
                    bonId={bon.id} ligne={l} problemes={bon.problemes} inventaire={inventaire} fournisseurs={fournisseurs}
                    onFermer={() => setCommandeOuverte(null)}
                  />
                ) : (
                  <button onClick={() => setCommandeOuverte(l.id)} className="bouton-3d" style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                    🛒 Commander
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      {erreur && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{erreur}</p>}
    </div>
  );
}

// Fournisseur proposé : celui dont le nom ressemble au fournisseur noté
// (« NAPA Canada » → « NAPA Pièces d'auto »), sinon aucun
function fournisseurPropose(nom, fournisseurs) {
  const mots = String(nom || "").toLowerCase().split(/[^a-z0-9àâçéèêëîïôûùüÿ]+/).filter((m) => m.length >= 3);
  return fournisseurs.find((f) => mots.some((m) => f.nom.toLowerCase().includes(m)))?.id || "";
}

// Fiche d'inventaire qui porte déjà ce numéro (même logique que le serveur,
// sur les pièces actives) — sinon une nouvelle fiche sera créée
function pieceExistante(numero, fournisseurId, inventaire) {
  const n = String(numero || "").trim().toLowerCase();
  if (!n) return null;
  return inventaire.find((p) => p.fournisseurs?.some((f) => f.fournisseurId === fournisseurId && f.numeroFournisseur?.toLowerCase() === n))
    || inventaire.find((p) => p.numero.toLowerCase() === n || p.autresNumeros?.includes(numero.trim()))
    || inventaire.find((p) => p.fournisseurs?.some((f) => f.numeroFournisseur?.toLowerCase() === n))
    || null;
}

function FormulaireCommande({ bonId, ligne, problemes, inventaire, fournisseurs, onFermer }) {
  const router = useRouter();
  const marge = CLIENT.margePrixVente;
  const [fournisseurId, setFournisseurId] = useState(fournisseurPropose(ligne.fournisseur, fournisseurs));
  const [numero, setNumero] = useState(ligne.numero || "");
  const [qte, setQte] = useState(String(ligne.qte || 1));
  const [problemeId, setProblemeId] = useState(problemes[0]?.id || "");
  const [cout, setCout] = useState(ligne.prix != null ? ligne.prix.toFixed(2) : "");
  const [prixVente, setPrixVente] = useState(
    marge != null && ligne.prix != null ? (ligne.prix / (1 - marge / 100)).toFixed(2) : ""
  );
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const existante = pieceExistante(numero, fournisseurId, inventaire);

  async function commander(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    const res = await fetch(`/api/bons/${bonId}/pieces-a-commander/${ligne.id}/commander`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fournisseurId, numero, qte: Number(qte), coutUnitaire: cout, prixVente: existante ? undefined : prixVente, problemeId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) || {};
    setEnCours(false);
    if (!res?.ok) {
      setErreur(data.erreur || "Erreur de connexion.");
      return;
    }
    onFermer();
    router.refresh();
  }

  if (fournisseurs.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
        Aucun fournisseur au dossier — ajoute-le d'abord dans <Link href="/gerant/fournisseurs" style={{ color: "var(--accent)" }}>Fournisseurs</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={commander} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
      <Champ libelle="Fournisseur" plein>
        <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} required className="champ">
          <option value="">— Choisir —</option>
          {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
      </Champ>
      <Champ libelle="N° de pièce chez le fournisseur">
        <input value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={60} required className="champ" />
      </Champ>
      <Champ libelle="Quantité">
        <input type="number" min={1} max={999} value={qte} onChange={(e) => setQte(e.target.value)} required className="champ" />
      </Champ>
      <Champ libelle="Coût unitaire ($, avant taxes)">
        <input value={cout} onChange={(e) => setCout(e.target.value)} inputMode="decimal" className="champ" />
      </Champ>
      {existante ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "end", paddingBottom: 8 }}>
          Fiche d'inventaire : <strong>{existante.nom}</strong> ({existante.numero}) — vendue {existante.prix.toFixed(2)} $
        </div>
      ) : (
        <Champ libelle="Prix de vente au client ($)">
          <input value={prixVente} onChange={(e) => setPrixVente(e.target.value)} inputMode="decimal" required className="champ" />
        </Champ>
      )}
      <Champ libelle="Ajouter au bon sur la tâche" plein>
        <select value={problemeId} onChange={(e) => setProblemeId(e.target.value)} required className="champ">
          {problemes.map((pr, i) => <option key={pr.id} value={pr.id}>{i + 1}. {pr.description}</option>)}
        </select>
      </Champ>
      <p style={{ gridColumn: "1 / -1", fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
        {!existante && <>Nouvelle pièce : une fiche d'inventaire sera créée (« {ligne.description} », n° {numero || "…"}, quantité 0). </>}
        Elle s'ajoute au brouillon de commande de ce fournisseur, avec les autres pièces à lui commander ; une fois la commande faite chez lui, marque-la « Commande passée ».
        La pièce s'ajoute au bon en <strong style={{ color: "#D9822B" }}>B/O</strong> à son prix de vente (comptée dans le total) ; elle sort du stock à la réception de la commande.
      </p>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
          {enCours ? "Ajout…" : "🛒 Ajouter à la commande du fournisseur"}
        </button>
        <button type="button" onClick={onFermer} style={{ ...boutonTexte, fontSize: 12 }}>Annuler</button>
      </div>
      {erreur && <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--danger)", margin: 0 }}>{erreur}</p>}
    </form>
  );
}

// Où en est la pièce : commande (brouillon, passée, reçue), dépense à
// payer, et sa ligne sur le bon (B/O jusqu'à la réception)
function SuiviCommande({ bon, ligne }) {
  const c = ligne.commande;
  const statut = STATUTS_COMMANDE[c.statut] || { label: c.statut, couleur: "var(--text)" };
  const recue = ["RECUE", "RECUE_PARTIELLE"].includes(c.statut);
  const aPayer = c.depenses.filter((d) => d.statut !== "PAYEE");
  const lienCommande = `/secretaire/inventaire/commandes/${c.id}`;
  const surBon = ligne.pieceUtilisee;
  const indexTache = surBon ? bon.problemes.findIndex((pr) => pr.id === surBon.problemeId) : -1;
  const tache = indexTache >= 0 ? `${indexTache + 1}. ${bon.problemes[indexTache].description}` : "";

  const etape = { fontSize: 11.5, fontWeight: 700, textDecoration: "none", padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg)" };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      <Link href={lienCommande} style={{ ...etape, color: statut.couleur, borderColor: statut.couleur }}>
        🛒 {c.numero} · {statut.label}
      </Link>
      {c.statut === "BROUILLON" && <Link href={lienCommande} style={{ ...etape, color: "var(--accent)" }}>À commander — marquer « Commande passée » →</Link>}
      {(c.statut === "ENVOYEE" || c.statut === "RECUE_PARTIELLE") && <Link href={lienCommande} style={{ ...etape, color: "var(--accent)" }}>📦 Recevoir →</Link>}
      {aPayer.map((d) => (
        <Link key={d.id} href={`/gerant/comptabilite/comptes-a-payer/${d.id}`} style={{ ...etape, color: "var(--danger)" }}>💲 Payer →</Link>
      ))}
      {recue && c.depenses.length > 0 && aPayer.length === 0 && <span style={{ ...etape, color: "var(--success)" }}>✓ Payée</span>}
      {surBon ? (
        surBon.bo
          ? <span style={{ ...etape, color: "#D9822B", borderColor: "#D9822B" }}>B/O sur la tâche {tache}</span>
          : <span style={{ ...etape, color: "var(--success)" }}>✓ Reçue — sur la tâche {tache}</span>
      ) : (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Retirée du bon</span>
      )}
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

const boutonTexte = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 };
