"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScannerCodeBarres from "../../../../components/ScannerCodeBarres";
import { STATUTS_COMMANDE, resteARecevoir, quantiteSuggeree } from "@/lib/commandesFournisseurs";
import { trouverPieceParScan, normaliserCode, autreNumeroContient } from "@/lib/codesBarres";

const dateFr = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
const aujourdhui = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const arrondi = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `${n.toFixed(2)} $`;

export default function CommandeDetailClient({ commande, pieces, fournisseurs, enCommande, tpsTaux, tvqTaux, peutVoirDepenses }) {
  const router = useRouter();
  const statut = STATUTS_COMMANDE[commande.statut] || { label: commande.statut, couleur: "var(--text)" };
  const dejaRecue = commande.lignes.some((l) => l.qteRecue > 0);
  const modifiable = ["BROUILLON", "ENVOYEE"].includes(commande.statut) && !dejaRecue;
  const peutRecevoir = ["BROUILLON", "ENVOYEE", "RECUE_PARTIELLE"].includes(commande.statut) && commande.lignes.length > 0;

  const versLigneLocale = (l) => ({ pieceId: l.pieceId, numeroFournisseur: l.numeroFournisseur || "", qteCommandee: String(l.qteCommandee), coutUnitaire: String(l.coutUnitaire) });
  const [lignes, setLignes] = useState(() => commande.lignes.map(versLigneLocale));
  const [note, setNote] = useState(commande.note || "");
  const [modifie, setModifie] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [modeReception, setModeReception] = useState(false);

  const pieceParId = new Map(pieces.map((p) => [p.id, p]));
  commande.lignes.forEach((l) => { if (!pieceParId.has(l.pieceId)) pieceParId.set(l.pieceId, { ...l.piece, fournisseurs: [] }); });
  const listeFournisseurs = fournisseurs.some((f) => f.id === commande.fournisseurId) ? fournisseurs : [commande.fournisseur, ...fournisseurs];
  const total = lignes.reduce((s, l) => s + (parseInt(l.qteCommandee) || 0) * (Number(l.coutUnitaire) || 0), 0);

  function majLignes(fn) {
    setLignes(fn);
    setModifie(true);
  }

  // Prix et numéro par défaut d'une pièce chez le fournisseur de la commande.
  function nouvelleLigne(piece, qte) {
    const lien = piece.fournisseurs.find((f) => f.fournisseurId === commande.fournisseurId);
    return { pieceId: piece.id, numeroFournisseur: lien?.numeroFournisseur || "", qteCommandee: String(qte), coutUnitaire: String(lien?.coutant ?? piece.coutant ?? 0) };
  }

  function ajouterPiece(piece, qte = 1) {
    majLignes((ls) => {
      const existante = ls.find((l) => l.pieceId === piece.id);
      if (existante) return ls.map((l) => (l.pieceId === piece.id ? { ...l, qteCommandee: String((parseInt(l.qteCommandee) || 0) + qte) } : l));
      return [...ls, nouvelleLigne(piece, qte)];
    });
  }

  // Pièces de ce fournisseur (habituel ou déjà liées) sous le seuil, qui ne
  // sont pas déjà sur cette commande.
  const aReapprovisionner = pieces
    .filter((p) => !lignes.some((l) => l.pieceId === p.id))
    .filter((p) => p.fournisseurId === commande.fournisseurId || p.fournisseurs.some((f) => f.fournisseurId === commande.fournisseurId))
    .map((p) => ({ piece: p, qte: quantiteSuggeree(p, enCommande[p.id] || 0) }))
    .filter((s) => s.qte > 0);

  async function envoyerPatch(corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/commandes-fournisseurs/${commande.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return false;
    }
    setModifie(false);
    router.refresh();
    return true;
  }

  const corpsLignes = () => (modifiable ? { lignes, note } : { note });
  const enregistrer = () => envoyerPatch(corpsLignes());
  const changerStatut = (nouveau, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return;
    return envoyerPatch({ ...(modifie ? corpsLignes() : {}), statut: nouveau });
  };

  async function changerFournisseur(id) {
    if (modifie && !(await enregistrer())) return;
    envoyerPatch({ fournisseurId: id });
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer la commande ${commande.numero} ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/commandes-fournisseurs/${commande.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setErreur(data.erreur || "Erreur.");
    }
    router.push("/secretaire/inventaire/commandes");
  }

  async function ouvrirPdf() {
    if (modifie && !(await enregistrer())) return;
    window.open(`/api/commandes-fournisseurs/${commande.id}/pdf`, "_blank");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire/commandes" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Commandes fournisseurs</Link>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{commande.numero}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
              Créée le {dateFr(commande.creeLe)}{commande.creePar ? ` par ${commande.creePar}` : ""}
              {commande.dateEnvoi && ` · passée le ${dateFr(commande.dateEnvoi)}`}
            </div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: statut.couleur, border: `1px solid ${statut.couleur}`, borderRadius: 999, padding: "3px 10px", flexShrink: 0 }}>{statut.label}</span>
        </div>
        <label style={{ ...labelStyle, marginTop: 12 }}>Fournisseur</label>
        {commande.statut === "BROUILLON" && !dejaRecue ? (
          <>
            <select value={commande.fournisseurId} onChange={(e) => changerFournisseur(e.target.value)} disabled={enCours} style={{ ...champStyle, marginBottom: 0 }}>
              {listeFournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "4px 0 0" }}>Changer de fournisseur reprend ses numéros et ses derniers prix pour chaque pièce.</p>
          </>
        ) : (
          <div style={{ fontWeight: 600 }}>{commande.fournisseur.nom}</div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10, whiteSpace: "pre-line" }}>{erreur}</p>}

      {modeReception ? (
        <FormulaireReception commande={commande} tpsTaux={tpsTaux} tvqTaux={tvqTaux} peutVoirDepenses={peutVoirDepenses} onAnnuler={() => setModeReception(false)} />
      ) : (
        <>
          <div className="carte" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Pièces commandées</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lignes.map((l, i) => (
                <LigneCommande
                  key={l.pieceId}
                  ligne={l}
                  piece={pieceParId.get(l.pieceId)}
                  ligneServeur={commande.lignes.find((x) => x.pieceId === l.pieceId)}
                  fournisseurId={commande.fournisseurId}
                  modifiable={modifiable}
                  onChange={(champ, valeur) => majLignes((ls) => ls.map((x, k) => (k === i ? { ...x, [champ]: valeur } : x)))}
                  onRetirer={() => majLignes((ls) => ls.filter((_, k) => k !== i))}
                />
              ))}
              {lignes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 12.5, margin: 0 }}>Aucune pièce pour l'instant.</p>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 8, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Total estimé (avant taxes)</span>
              <strong>{fmt(total)}</strong>
            </div>

            {modifiable && (
              <>
                <AjoutPiece pieces={pieces} onAjouter={(p) => ajouterPiece(p)} />
                {aReapprovisionner.length > 0 && (
                  <button
                    onClick={() => aReapprovisionner.forEach((s) => ajouterPiece(s.piece, s.qte))}
                    className="bouton-3d-sombre"
                    style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                  >
                    + {aReapprovisionner.length} pièce{aReapprovisionner.length > 1 ? "s" : ""} de ce fournisseur sous le seuil minimum
                  </button>
                )}
              </>
            )}
          </div>

          <div className="carte" style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Note pour le fournisseur (imprimée sur le bon)</label>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setModifie(true); }} rows={2} style={{ ...champStyle, marginBottom: 0, resize: "vertical" }} placeholder="ex. Livrer avant jeudi" />
          </div>

          {modifie && (
            <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
              {enCours ? "…" : "💾 Enregistrer les changements"}
            </button>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <button onClick={ouvrirPdf} disabled={enCours} className="bouton-3d-sombre" style={boutonAction}>📄 Bon de commande (PDF)</button>
            {commande.statut === "BROUILLON" && (
              <button onClick={() => changerStatut("ENVOYEE")} disabled={enCours || lignes.length === 0} className="bouton-3d" style={boutonAction}>✅ Commande passée</button>
            )}
            {peutRecevoir && !modifie && (
              <button onClick={() => setModeReception(true)} disabled={enCours} className="bouton-3d" style={boutonAction}>
                📦 {commande.statut === "RECUE_PARTIELLE" ? "Recevoir le reste" : "Recevoir la marchandise"}
              </button>
            )}
            {commande.statut === "ENVOYEE" && !dejaRecue && (
              <button onClick={() => changerStatut("BROUILLON")} disabled={enCours} className="bouton-3d-sombre" style={boutonAction}>↩️ Revenir en brouillon</button>
            )}
            {commande.statut === "RECUE_PARTIELLE" && (
              <button onClick={() => changerStatut("RECUE", "Clore la commande ? Le reste ne sera plus attendu (il ne comptera plus « en commande »).")} disabled={enCours} className="bouton-3d-sombre" style={boutonAction}>
                ✅ Clore (le reste ne viendra pas)
              </button>
            )}
            {["BROUILLON", "ENVOYEE"].includes(commande.statut) && !dejaRecue && (
              <button onClick={() => changerStatut("ANNULEE", `Annuler la commande ${commande.numero} ?`)} disabled={enCours} className="bouton-3d-sombre" style={boutonAction}>🚫 Annuler</button>
            )}
            {commande.statut === "ANNULEE" && (
              <button onClick={() => changerStatut("BROUILLON")} disabled={enCours} className="bouton-3d-sombre" style={boutonAction}>↩️ Rouvrir</button>
            )}
            {!dejaRecue && commande.depenses.length === 0 && (
              <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={boutonAction}>🗑️</button>
            )}
          </div>
          {modifie && peutRecevoir && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -8 }}>Enregistre les changements avant de recevoir la marchandise.</p>
          )}
        </>
      )}

      {commande.depenses.length > 0 && (
        <div className="carte">
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Réceptions — dépenses fournisseur</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {commande.depenses.map((d) => {
              const contenu = (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                  <div>
                    <div>{d.description}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Facture du {dateFr(d.dateFacture)}{d.dateEcheance ? ` · échéance ${dateFr(d.dateEcheance)}` : ""}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <div style={{ fontWeight: 700 }}>{fmt(d.montant)}</div>
                    <div style={{ fontSize: 10.5, color: d.statut === "PAYEE" ? "var(--success)" : "var(--danger)" }}>{d.statut === "PAYEE" ? "Payée" : "À payer"}</div>
                  </div>
                </div>
              );
              return peutVoirDepenses ? (
                <Link key={d.id} href={`/gerant/comptabilite/comptes-a-payer/${d.id}`} style={{ textDecoration: "none", color: "inherit" }}>{contenu}</Link>
              ) : <div key={d.id}>{contenu}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Une ligne : pièce, numéro chez le fournisseur, quantité, prix — et les
// prix connus chez les autres fournisseurs, pour choisir où commander.
function LigneCommande({ ligne, piece, ligneServeur, fournisseurId, modifiable, onChange, onRetirer }) {
  const autres = (piece?.fournisseurs || []).filter((f) => f.fournisseurId !== fournisseurId && f.coutant != null);
  const totalLigne = (parseInt(ligne.qteCommandee) || 0) * (Number(ligne.coutUnitaire) || 0);
  const prixActuel = Number(ligne.coutUnitaire) || 0;

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{piece?.nom || "?"}</div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace" }}>
            {piece?.numero} · stock {piece?.qte ?? "?"}
            {ligneServeur && ligneServeur.qteRecue > 0 && ` · reçu ${ligneServeur.qteRecue}/${ligneServeur.qteCommandee}`}
          </div>
        </div>
        {modifiable && <button onClick={onRetirer} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13, alignSelf: "flex-start" }}>✕</button>}
      </div>

      {modifiable ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <label style={labelStyle}>No chez le fournisseur</label>
            <input value={ligne.numeroFournisseur} onChange={(e) => onChange("numeroFournisseur", e.target.value)} placeholder="optionnel" style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", fontSize: 12 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Qté</label>
            <input type="number" min={1} value={ligne.qteCommandee} onChange={(e) => onChange("qteCommandee", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", fontSize: 12, textAlign: "center" }} />
          </div>
          <div style={{ flex: 1.3 }}>
            <label style={labelStyle}>Prix unit. ($)</label>
            <input type="number" min={0} step="0.01" value={ligne.coutUnitaire} onChange={(e) => onChange("coutUnitaire", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", fontSize: 12, textAlign: "right" }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
          <span style={{ color: "var(--text-muted)" }}>{ligne.numeroFournisseur ? `No fournisseur : ${ligne.numeroFournisseur}` : ""}</span>
          <span>{ligne.qteCommandee} × {fmt(prixActuel)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
          {autres.length > 0 && (
            <>Ailleurs : {autres.map((f, k) => (
              <span key={f.id} style={{ color: f.coutant < prixActuel ? "var(--success)" : "var(--text-muted)" }}>
                {k > 0 && " · "}{f.fournisseur?.nom} {fmt(f.coutant)}
              </span>
            ))}</>
          )}
        </div>
        <strong style={{ fontSize: 12.5, flexShrink: 0 }}>{fmt(totalLigne)}</strong>
      </div>
    </div>
  );
}

// Recherche d'une pièce (nom, numéro, code-barres, numéro fournisseur) ou scan.
function AjoutPiece({ pieces, onAjouter }) {
  const [recherche, setRecherche] = useState("");
  const [scanner, setScanner] = useState(false);
  const [message, setMessage] = useState("");

  const q = recherche.trim().toLowerCase();
  const suggestions = q
    ? pieces.filter((p) => p.nom.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q) || autreNumeroContient(p, q)
        || (p.codeBarre && normaliserCode(p.codeBarre) === normaliserCode(q))
        || p.fournisseurs.some((f) => f.numeroFournisseur?.toLowerCase().includes(q))).slice(0, 8)
    : [];

  function choisir(p) {
    onAjouter(p);
    setRecherche("");
    setMessage(`${p.nom} ajoutée`);
    setTimeout(() => setMessage(""), 2000);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Ajouter une pièce (nom, numéro, no fournisseur)…" style={{ ...champStyle, marginBottom: 0, flex: 1 }} />
        <button type="button" onClick={() => setScanner(true)} title="Scanner une pièce" className="bouton-3d-sombre" style={{ padding: "0 12px", borderRadius: 8, fontSize: 15 }}>📷</button>
      </div>
      {scanner && (
        <ScannerCodeBarres
          titre="Ajouter une pièce à la commande"
          onFermer={() => setScanner(false)}
          onDetecte={(texte) => {
            setScanner(false);
            const { piece, code } = trouverPieceParScan(pieces, texte);
            if (piece) choisir(piece);
            else setMessage(`Code « ${code} » inconnu dans l'inventaire.`);
          }}
        />
      )}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {suggestions.map((p) => (
            <button key={p.id} onClick={() => choisir(p)} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>
              {p.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>— {p.numero} · stock {p.qte}</span>
            </button>
          ))}
        </div>
      )}
      {q && suggestions.length === 0 && <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0" }}>Aucune pièce trouvée — crée-la d'abord dans l'inventaire.</p>}
      {message && <p style={{ fontSize: 11.5, color: "var(--accent)", margin: "6px 0 0" }}>{message}</p>}
    </div>
  );
}

// Réception : quantités reçues et prix réels de la facture, puis création
// de la dépense à payer (stock et coût moyen mis à jour au même moment).
function FormulaireReception({ commande, tpsTaux, tvqTaux, peutVoirDepenses, onAnnuler }) {
  const router = useRouter();
  const lignesARecevoir = commande.lignes.filter((l) => resteARecevoir(l) > 0);
  const lignesAffichees = lignesARecevoir.length > 0 ? lignesARecevoir : commande.lignes;
  const [saisie, setSaisie] = useState(() => Object.fromEntries(lignesAffichees.map((l) => [l.id, { qte: String(resteARecevoir(l)), cout: String(l.coutUnitaire) }])));
  const [numeroFacture, setNumeroFacture] = useState("");
  const [dateFacture, setDateFacture] = useState(aujourdhui());
  const [dateEcheance, setDateEcheance] = useState("");
  const [taxesManuelles, setTaxesManuelles] = useState(null); // { tps, tvq } une fois modifiées à la main
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState(null);

  const sousTotal = lignesAffichees.reduce((s, l) => s + arrondi((parseInt(saisie[l.id].qte) || 0) * (Number(saisie[l.id].cout) || 0)), 0);
  const tps = taxesManuelles ? Number(taxesManuelles.tps) || 0 : arrondi(sousTotal * tpsTaux / 100);
  const tvq = taxesManuelles ? Number(taxesManuelles.tvq) || 0 : arrondi(sousTotal * tvqTaux / 100);
  const maj = (id, champ, valeur) => setSaisie((s) => ({ ...s, [id]: { ...s[id], [champ]: valeur } }));

  async function recevoir() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/commandes-fournisseurs/${commande.id}/reception`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lignes: lignesAffichees.map((l) => ({ ligneId: l.id, qte: saisie[l.id].qte, coutUnitaire: saisie[l.id].cout })),
        numeroFacture, dateFacture, dateEcheance, tpsPayee: tps, tvqPayee: tvq,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Erreur lors de la réception.");
    setResultat(data);
    router.refresh();
  }

  if (resultat) {
    return (
      <div className="carte" style={{ marginBottom: 12, border: "1px solid var(--success)" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>✅ Marchandise reçue</p>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 10px" }}>
          Le stock et le coût moyen des pièces sont à jour, et une dépense de {fmt(resultat.montant)} est à payer dans les comptes fournisseurs.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {peutVoirDepenses && (
            <Link href={`/gerant/comptabilite/comptes-a-payer/${resultat.depenseId}`} className="bouton-3d" style={{ ...boutonAction, textDecoration: "none", textAlign: "center" }}>Voir la dépense</Link>
          )}
          <button onClick={onAnnuler} className="bouton-3d-sombre" style={boutonAction}>Retour à la commande</button>
        </div>
      </div>
    );
  }

  return (
    <div className="carte" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📦 Réception de la marchandise</div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Inscris ce qui est arrivé et les prix de la facture (avant taxes). Le reste demeure en commande si tout n'est pas là.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {lignesAffichees.map((l) => (
          <div key={l.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{l.piece.nom}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {l.piece.numero}{l.numeroFournisseur ? ` · no fournisseur ${l.numeroFournisseur}` : ""} · commandé {l.qteCommandee}{l.qteRecue > 0 ? `, déjà reçu ${l.qteRecue}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Qté reçue</label>
                <input type="number" min={0} value={saisie[l.id].qte} onChange={(e) => maj(l.id, "qte", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", textAlign: "center" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Prix unit. facturé ($)</label>
                <input type="number" min={0} step="0.01" value={saisie[l.id].cout} onChange={(e) => maj(l.id, "cout", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", textAlign: "right" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>No de facture du fournisseur</label>
          <input value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} placeholder="optionnel" style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date de la facture</label>
          <input type="date" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={champStyle} />
        </div>
      </div>
      <label style={labelStyle}>Échéance de paiement — optionnelle</label>
      <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} style={champStyle} />

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Sous-total</span><span>{fmt(sousTotal)}</span></div>
        {[["tps", `TPS (${tpsTaux} %)`, tps], ["tvq", `TVQ (${tvqTaux} %)`, tvq]].map(([cle, libelle, valeur]) => (
          <div key={cle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span>{libelle}</span>
            <input
              type="number" min={0} step="0.01"
              value={taxesManuelles ? taxesManuelles[cle] : valeur.toFixed(2)}
              onChange={(e) => setTaxesManuelles({ tps: taxesManuelles?.tps ?? tps.toFixed(2), tvq: taxesManuelles?.tvq ?? tvq.toFixed(2), [cle]: e.target.value })}
              style={{ ...champStyle, width: 100, marginBottom: 0, padding: "4px 8px", textAlign: "right" }}
            />
          </div>
        ))}
        {taxesManuelles && (
          <button onClick={() => setTaxesManuelles(null)} style={{ background: "none", border: "none", color: "var(--accent)", textDecoration: "underline", cursor: "pointer", fontSize: 11.5, padding: 0, marginBottom: 6 }}>
            Recalculer les taxes
          </button>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Total à payer</span><span>{fmt(sousTotal + tps + tvq)}</span></div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0", whiteSpace: "pre-line" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={recevoir} disabled={enCours || !lignesAffichees.some((l) => parseInt(saisie[l.id].qte) > 0)} className="bouton-3d" style={{ ...boutonAction, flex: 2 }}>
          {enCours ? "…" : "Recevoir et créer la dépense"}
        </button>
        <button onClick={onAnnuler} disabled={enCours} className="bouton-3d-sombre" style={{ ...boutonAction, flex: 1 }}>Annuler</button>
      </div>
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
const boutonAction = { padding: "10px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700 };
