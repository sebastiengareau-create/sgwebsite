"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScannerCodeBarres from "../../../../components/ScannerCodeBarres";
import RecherchePieces from "../../../../components/RecherchePieces";
import { ResultatPourCommande } from "../../../../components/ResultatsRecherchePieces";
import { BoutonPartsTech, PanierPartsTech, AttentePanierPartsTech } from "./PartsTech";
import { STATUTS_COMMANDE, resteARecevoir } from "@/lib/commandesFournisseurs";
import { suggestionReappro } from "@/lib/reapprovisionnement";
import { trouverPieceParScan, pieceCorrespond } from "@/lib/codesBarres";
import { fournisseurPropose } from "@/lib/recherchePieces";
import { argent } from "@/lib/format";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../../../../components/StyleSection";

const dateFr = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
const aujourdhui = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const arrondi = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `${argent(n)}`;

export default function CommandeDetailClient({ commande, pieces, fournisseurs, enCommande, ventes = { venduParPiece: {}, jours: 90 }, tpsTaux, tvqTaux, peutVoirDepenses, sitesPieces, partstech = null, paniersPartsTech = [], attentePanierPartsTech = false }) {
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
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  // Fiches créées par la recherche de pièces, avant le rafraîchissement
  const [piecesAjoutees, setPiecesAjoutees] = useState([]);

  const pieceParId = new Map([...pieces, ...piecesAjoutees].map((p) => [p.id, p]));
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

  // Pièces de ce fournisseur (habituel ou déjà liées) sous le seuil ou
  // bientôt épuisées au rythme des ventes (lib/reapprovisionnement.js), qui
  // ne sont pas déjà sur cette commande.
  const aReapprovisionner = pieces
    .filter((p) => !lignes.some((l) => l.pieceId === p.id))
    .filter((p) => p.fournisseurId === commande.fournisseurId || p.fournisseurs.some((f) => f.fournisseurId === commande.fournisseurId))
    .map((p) => ({ piece: p, qte: suggestionReappro(p, { enCommande: enCommande[p.id] || 0, vendu: ventes.venduParPiece[p.id] || 0, jours: ventes.jours })?.qte || 0 }))
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

  // La recherche ajoute la pièce sur le serveur : les changements en cours
  // s'enregistrent d'abord.
  async function ouvrirRecherche() {
    if (modifie && !(await enregistrer())) return;
    setRechercheOuverte(true);
  }

  // Ligne ajoutée par la recherche (déjà enregistrée) : reportée ici sans
  // marquer la commande modifiée
  function ligneAjoutee({ piece, ligne }) {
    if (!pieces.some((p) => p.id === piece.id)) setPiecesAjoutees((ps) => [...ps.filter((p) => p.id !== piece.id), piece]);
    setLignes((ls) => ls.some((l) => l.pieceId === ligne.pieceId)
      ? ls.map((l) => (l.pieceId === ligne.pieceId ? versLigneLocale(ligne) : l))
      : [...ls, versLigneLocale(ligne)]);
    router.refresh();
  }

  async function ouvrirPdf() {
    if (modifie && !(await enregistrer())) return;
    window.open(`/api/commandes-fournisseurs/${commande.id}/pdf`, "_blank");
  }

  const nbUnites = lignes.reduce((n, l) => n + (parseInt(l.qteCommandee) || 0), 0);
  const unitesCommandees = commande.lignes.reduce((n, l) => n + l.qteCommandee, 0);
  const unitesRecues = commande.lignes.reduce((n, l) => n + l.qteRecue, 0);
  const totalDepenses = commande.depenses.reduce((s, dep) => s + dep.montant, 0);

  // Actions selon le statut — rangées en grille symétrique
  const actions = [
    { cle: "pdf", icone: "document", label: "Bon de commande (PDF)", onClick: ouvrirPdf },
    commande.statut === "BROUILLON" && { cle: "passee", icone: "crochet", label: "Commande passée", onClick: () => changerStatut("ENVOYEE"), principal: true, desactive: lignes.length === 0 },
    peutRecevoir && !modifie && { cle: "recevoir", icone: "boite", label: commande.statut === "RECUE_PARTIELLE" ? "Recevoir le reste" : "Recevoir la marchandise", onClick: () => setModeReception(true), vert: true },
    commande.statut === "ENVOYEE" && !dejaRecue && { cle: "brouillon", icone: "echange", label: "Revenir en brouillon", onClick: () => changerStatut("BROUILLON") },
    commande.statut === "RECUE_PARTIELLE" && { cle: "clore", icone: "cadenas", label: "Clore la commande", onClick: () => changerStatut("RECUE", "Clore la commande ? Le reste ne sera plus attendu (il ne comptera plus « en commande »).") },
    ["BROUILLON", "ENVOYEE"].includes(commande.statut) && !dejaRecue && { cle: "annuler", icone: "bloque", label: "Annuler la commande", onClick: () => changerStatut("ANNULEE", `Annuler la commande ${commande.numero} ?`), couleur: "var(--avertissement)" },
    commande.statut === "ANNULEE" && { cle: "rouvrir", icone: "echange", label: "Rouvrir", onClick: () => changerStatut("BROUILLON") },
    !dejaRecue && commande.depenses.length === 0 && { cle: "supprimer", icone: "poubelle", label: "Supprimer", onClick: supprimer, couleur: "var(--danger)" },
  ].filter(Boolean);
  // Par deux ; s'il en reste une seule au bout, elle prend toute la largeur
  const colonnesActions = actions.length === 1 ? 1 : 2;

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire/commandes" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux commandes de pièces</Link>

      {/* Carte de la commande */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: statut.couleur }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: statut.couleur, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom="panier" taille={28} couleur={TEINTES.ambre.couleur} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>Commande {commande.numero}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Créée le {dateFr(commande.creeLe)}{commande.creePar ? ` par ${commande.creePar}` : ""}
              {commande.dateEnvoi && ` · passée le ${dateFr(commande.dateEnvoi)}`}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Pastille couleur={statut.couleur} fond="var(--surface-alt)">{statut.label}</Pastille>
              <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{commande.fournisseur.nom}</Pastille>
            </div>
          </div>
        </div>
        {commande.statut === "BROUILLON" && !dejaRecue && (
          <div style={{ position: "relative", marginTop: 14 }}>
            <label style={labelStyle}>Fournisseur</label>
            <select value={commande.fournisseurId} onChange={(e) => changerFournisseur(e.target.value)} disabled={enCours} style={{ ...champStyle, marginBottom: 0 }}>
              {listeFournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>Changer de fournisseur reprend ses numéros et ses derniers prix pour chaque pièce.</p>
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, marginBottom: 10, whiteSpace: "pre-line" }}>{erreur}</p>}

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="Pièces" montant={String(lignes.length)} teinte="var(--bleu)" note={`${nbUnites} unité${nbUnites !== 1 ? "s" : ""} commandée${nbUnites !== 1 ? "s" : ""}`} />
        <CarteChiffre titre="Total estimé" montant={fmt(total)} teinte="var(--accent)" note="Avant taxes" />
        <CarteChiffre
          titre="Reçu" montant={`${unitesRecues} / ${unitesCommandees}`}
          couleur={unitesCommandees > 0 && unitesRecues >= unitesCommandees ? "var(--success)" : "var(--text)"} teinte="var(--success)"
          note={commande.depenses.length > 0 ? `${commande.depenses.length} facture${commande.depenses.length > 1 ? "s" : ""} · ${fmt(totalDepenses)}` : "Aucune réception encore"}
        />
      </div>

      {/* Un panier reçu reste affiché si la commande a été passée entre-temps :
          ses pièces iront alors au brouillon de leur fournisseur */}
      {!modeReception && (
        <>
          {attentePanierPartsTech && paniersPartsTech.length === 0 && commande.statut === "BROUILLON" && <AttentePanierPartsTech />}
          {paniersPartsTech.map((p) => (
            <PanierPartsTech key={p.id} commande={commande} panier={p} fournisseurs={listeFournisseurs} inventaire={[...pieces, ...piecesAjoutees]} />
          ))}
        </>
      )}

      {modeReception ? (
        <FormulaireReception commande={commande} tpsTaux={tpsTaux} tvqTaux={tvqTaux} peutVoirDepenses={peutVoirDepenses} onAnnuler={() => setModeReception(false)} />
      ) : (
        <>
          <div style={stylePanneau}>
            <TitrePanneau icone="boite" teinte={TEINTES.ambre} titre="Pièces commandées" sousTitre={modifiable ? "Ajuste les numéros, quantités et prix, puis enregistre." : undefined} />
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
              {lignes.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune pièce pour l'instant.</p>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "rgba(232,163,61,0.16)", marginTop: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>Total estimé (avant taxes)</span>
              <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
            </div>

            {modifiable && (
              <>
                <AjoutPiece pieces={pieces} onAjouter={(p) => ajouterPiece(p)} />
                {(() => {
                  const outils = [
                    commande.statut === "BROUILLON" && { cle: "rech", icone: "loupe", label: "Rechercher chez nos fournisseurs", onClick: ouvrirRecherche },
                    aReapprovisionner.length > 0 && { cle: "seuil", icone: "plus", label: `${aReapprovisionner.length} pièce${aReapprovisionner.length > 1 ? "s" : ""} à réapprovisionner`, onClick: () => aReapprovisionner.forEach((s) => ajouterPiece(s.piece, s.qte)) },
                  ].filter(Boolean);
                  if (outils.length === 0) return null;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${outils.length}, 1fr)`, gap: 8, marginTop: 10 }}>
                      {outils.map((o) => <BoutonAction key={o.cle} icone={o.icone} couleur="var(--accent-ombre)" bordure="var(--accent)" onClick={o.onClick} disabled={enCours}>{o.label}</BoutonAction>)}
                    </div>
                  );
                })()}
                {commande.statut === "BROUILLON" && partstech?.actif && (
                  <BoutonPartsTech commande={commande} desactive={enCours} avantOuverture={async () => !modifie || (await enregistrer())} />
                )}
                {commande.statut === "BROUILLON" && partstech && !partstech.actif && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
                    🔌 PartsTech pas encore configuré : {!partstech.partenaire
                      ? "identifiants partenaire manquants (variables PARTSTECH_PARTNER_ID et PARTSTECH_PARTNER_KEY sur Railway)"
                      : "entre l'utilisateur et la clé API du garage dans Paramètres → PartsTech"}.
                  </p>
                )}
                {rechercheOuverte && (
                  <RecherchePieces
                    sites={triesParFournisseur(sitesPieces, commande.fournisseur.nom)}
                    resultat={{
                      explication: `elle s'ajoute à cette commande chez ${commande.fournisseur.nom} (fiche d'inventaire créée au besoin).`,
                      rendre: (r) => <ResultatPourCommande {...r} inventaire={[...pieces, ...piecesAjoutees]} commande={commande} onAjoutee={ligneAjoutee} />,
                    }}
                    onFermer={() => setRechercheOuverte(false)}
                  />
                )}
              </>
            )}
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="crayon" teinte={TEINTES.neutre} titre="Note pour le fournisseur" sousTitre="Imprimée sur le bon de commande." />
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setModifie(true); }} rows={2} style={{ ...champStyle, marginBottom: 0, resize: "vertical" }} placeholder="ex. Livrer avant jeudi" />
          </div>

          {modifie && (
            <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              {enCours ? "…" : "Enregistrer les changements"}
            </button>
          )}

          <div style={{ display: "grid", gridTemplateColumns: `repeat(${colonnesActions}, 1fr)`, gap: 8, marginBottom: 16 }}>
            {actions.map((a, i) => (
              <BoutonAction
                key={a.cle} icone={a.icone} onClick={a.onClick} disabled={enCours || a.desactive}
                couleur={a.vert ? "#fff" : a.principal ? "#221f18" : (a.couleur || "var(--text)")}
                fond={a.vert ? "var(--success)" : a.principal ? "var(--accent)" : "var(--surface)"}
                bordure={a.vert ? "var(--success)" : a.principal ? "var(--accent)" : "var(--border)"}
                style={colonnesActions === 2 && actions.length % 2 === 1 && i === actions.length - 1 ? { gridColumn: "1 / -1" } : undefined}
              >
                {a.label}
              </BoutonAction>
            ))}
          </div>
          {modifie && peutRecevoir && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8 }}>Enregistre les changements avant de recevoir la marchandise.</p>
          )}
        </>
      )}

      {commande.depenses.length > 0 && (
        <div style={stylePanneau}>
          <TitrePanneau icone="presse" teinte={TEINTES.vert} titre="Réceptions" sousTitre="Dépenses fournisseur créées à chaque réception." />
          {commande.depenses.map((d, i) => {
            const payee = d.statut === "PAYEE";
            const contenu = (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{d.description}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Facture du {dateFr(d.dateFacture)}{d.dateEcheance ? ` · échéance ${dateFr(d.dateEcheance)}` : ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(d.montant)}</span>
                  <Pastille couleur={payee ? "var(--success)" : "var(--danger)"} fond={payee ? "var(--success-fond)" : "var(--danger-fond)"}>{payee ? "Payée" : "À payer"}</Pastille>
                </div>
              </div>
            );
            return peutVoirDepenses ? (
              <Link key={d.id} href={`/gerant/comptabilite/comptes-a-payer/${d.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{contenu}</Link>
            ) : <div key={d.id}>{contenu}</div>;
          })}
        </div>
      )}
    </div>
  );
}

// Le site du fournisseur de la commande en premier (même nom, à peu près)
function triesParFournisseur(sites, nom) {
  const proche = (s) => fournisseurPropose(s.nom, [{ id: 1, nom }]) ? 0 : 1;
  return [...sites].sort((a, b) => proche(a) - proche(b));
}

// Une ligne : pièce, numéro chez le fournisseur, quantité, prix — et les
// prix connus chez les autres fournisseurs, pour choisir où commander.
function LigneCommande({ ligne, piece, ligneServeur, fournisseurId, modifiable, onChange, onRetirer }) {
  const autres = (piece?.fournisseurs || []).filter((f) => f.fournisseurId !== fournisseurId && f.coutant != null);
  const totalLigne = (parseInt(ligne.qteCommandee) || 0) * (Number(ligne.coutUnitaire) || 0);
  const prixActuel = Number(ligne.coutUnitaire) || 0;

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{piece?.nom || "?"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
            {piece?.numero} · stock {piece?.qte ?? "?"}
            {ligneServeur && ligneServeur.qteRecue > 0 && ` · reçu ${ligneServeur.qteRecue}/${ligneServeur.qteCommandee}`}
          </div>
        </div>
        {modifiable && (
          <button onClick={onRetirer} aria-label="Retirer de la commande" title="Retirer de la commande" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
            <Icone nom="poubelle" taille={14} couleur="var(--danger)" />
          </button>
        )}
      </div>

      {modifiable ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <label style={labelStyle}>No chez le fournisseur</label>
            <input value={ligne.numeroFournisseur} onChange={(e) => onChange("numeroFournisseur", e.target.value)} placeholder="optionnel" style={{ ...champStyle, marginBottom: 0, padding: "8px 10px", fontSize: 13 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Qté</label>
            <input type="number" min={1} value={ligne.qteCommandee} onChange={(e) => onChange("qteCommandee", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "8px 6px", fontSize: 13, textAlign: "center" }} />
          </div>
          <div style={{ flex: 1.3 }}>
            <label style={labelStyle}>Prix unit. ($)</label>
            <input type="number" min={0} step="0.01" value={ligne.coutUnitaire} onChange={(e) => onChange("coutUnitaire", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "8px 8px", fontSize: 13, textAlign: "right" }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
          <span style={{ color: "var(--text-muted)" }}>{ligne.numeroFournisseur ? `No fournisseur : ${ligne.numeroFournisseur}` : ""}</span>
          <span>{ligne.qteCommandee} × {fmt(prixActuel)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {autres.length > 0 && (
            <>Ailleurs : {autres.map((f, k) => (
              <span key={f.id} style={{ color: f.coutant < prixActuel ? "var(--success)" : "var(--text-muted)" }}>
                {k > 0 && " · "}{f.fournisseur?.nom} {fmt(f.coutant)}
              </span>
            ))}</>
          )}
        </div>
        <strong style={{ fontSize: 14, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmt(totalLigne)}</strong>
      </div>
    </div>
  );
}

// Recherche d'une pièce (nom, numéro, code-barres, numéro fournisseur) ou scan.
// Pièces suggérées d'un coup : l'inventaire peut en compter des milliers
const MAX_SUGGESTIONS = 50;

function AjoutPiece({ pieces, onAjouter }) {
  const [recherche, setRecherche] = useState("");
  const [scanner, setScanner] = useState(false);
  const [message, setMessage] = useState("");

  const q = recherche.trim().toLowerCase();
  const suggestions = q
    ? pieces.filter((p) => pieceCorrespond(p, q))
    : [];

  function choisir(p) {
    onAjouter(p);
    setRecherche("");
    setMessage(`${p.nom} ajoutée`);
    setTimeout(() => setMessage(""), 2000);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Ajouter une pièce (nom, numéro, no fournisseur)…" style={{ ...champStyle, marginBottom: 0, paddingLeft: 40 }} />
        </div>
        <button type="button" onClick={() => setScanner(true)} title="Scanner une pièce" aria-label="Scanner une pièce" style={{ width: 44, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="camera" taille={18} couleur="var(--accent-ombre)" />
        </button>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, maxHeight: 320, overflowY: "auto" }}>
          {suggestions.slice(0, MAX_SUGGESTIONS).map((p) => (
            <button key={p.id} onClick={() => choisir(p)} style={{ textAlign: "left", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
              {p.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>— {p.numero} · stock {p.qte}</span>
            </button>
          ))}
          {suggestions.length > MAX_SUGGESTIONS && (
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "2px 0 0" }}>… et {suggestions.length - MAX_SUGGESTIONS} autres — précise la recherche.</p>
          )}
        </div>
      )}
      {q && suggestions.length === 0 && <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0" }}>Aucune pièce trouvée — crée-la d'abord dans l'inventaire.</p>}
      {message && <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)", margin: "6px 0 0" }}>{message}</p>}
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
      <div style={{ ...stylePanneau, border: "1.5px solid var(--success)" }}>
        <TitrePanneau
          icone="crochet" teinte={TEINTES.vert} titre="Marchandise reçue"
          sousTitre={`Le stock et le coût moyen des pièces sont à jour, et une dépense de ${fmt(resultat.montant)} est à payer dans les comptes fournisseurs.`}
        />
        <div style={{ display: "grid", gridTemplateColumns: peutVoirDepenses ? "1fr 1fr" : "1fr", gap: 8 }}>
          {peutVoirDepenses && <BoutonAction href={`/gerant/comptabilite/comptes-a-payer/${resultat.depenseId}`} icone="presse" couleur="#fff" fond="var(--success)" bordure="var(--success)">Voir la dépense</BoutonAction>}
          <BoutonAction icone="panier" onClick={onAnnuler}>Retour à la commande</BoutonAction>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...stylePanneau, border: "1.5px solid var(--success)" }}>
      <TitrePanneau
        icone="boite" teinte={TEINTES.vert} titre="Réception de la marchandise"
        sousTitre="Inscris ce qui est arrivé et les prix de la facture (avant taxes). Le reste demeure en commande si tout n'est pas là."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {lignesAffichees.map((l) => (
          <div key={l.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{l.piece.nom}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {l.piece.numero}{l.numeroFournisseur ? ` · no fournisseur ${l.numeroFournisseur}` : ""} · commandé {l.qteCommandee}{l.qteRecue > 0 ? `, déjà reçu ${l.qteRecue}` : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <label style={labelStyle}>Qté reçue</label>
                <input type="number" min={0} value={saisie[l.id].qte} onChange={(e) => maj(l.id, "qte", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", textAlign: "center" }} />
              </div>
              <div>
                <label style={labelStyle}>Prix unit. facturé ($)</label>
                <input type="number" min={0} step="0.01" value={saisie[l.id].cout} onChange={(e) => maj(l.id, "cout", e.target.value)} style={{ ...champStyle, marginBottom: 0, padding: "6px 8px", textAlign: "right" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={labelStyle}>No de facture du fournisseur</label>
          <input value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} placeholder="optionnel" style={champStyle} />
        </div>
        <div>
          <label style={labelStyle}>Date de la facture</label>
          <input type="date" max="9999-12-31" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={champStyle} />
        </div>
      </div>
      <label style={labelStyle}>Échéance de paiement — optionnelle</label>
      <input type="date" max="9999-12-31" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} style={champStyle} />

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 13.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ color: "var(--text-muted)" }}>Sous-total</span><strong>{fmt(sousTotal)}</strong></div>
        {[["tps", `TPS (${tpsTaux} %)`, tps], ["tvq", `TVQ (${tvqTaux} %)`, tvq]].map(([cle, libelle, valeur]) => (
          <div key={cle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "var(--text-muted)" }}>{libelle}</span>
            <input
              type="number" min={0} step="0.01"
              value={taxesManuelles ? taxesManuelles[cle] : valeur.toFixed(2)}
              onChange={(e) => setTaxesManuelles({ tps: taxesManuelles?.tps ?? tps.toFixed(2), tvq: taxesManuelles?.tvq ?? tvq.toFixed(2), [cle]: e.target.value })}
              style={{ ...champStyle, width: 110, marginBottom: 0, padding: "6px 8px", textAlign: "right" }}
            />
          </div>
        ))}
        {taxesManuelles && (
          <button onClick={() => setTaxesManuelles(null)} style={{ background: "none", border: "none", color: "var(--accent-ombre)", textDecoration: "underline", cursor: "pointer", fontSize: 12.5, fontWeight: 700, padding: 0, marginBottom: 8 }}>
            Recalculer les taxes
          </button>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "rgba(232,163,61,0.16)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>Total à payer</span>
          <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(sousTotal + tps + tvq)}</span>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0", whiteSpace: "pre-line" }}>{erreur}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <BoutonAction icone="crochet" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={recevoir} disabled={enCours || !lignesAffichees.some((l) => parseInt(saisie[l.id].qte) > 0)}>
          {enCours ? "…" : "Recevoir et créer la dépense"}
        </BoutonAction>
        <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onAnnuler} disabled={enCours}>Annuler</BoutonAction>
      </div>
    </div>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };
