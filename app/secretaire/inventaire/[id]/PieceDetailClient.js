"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection } from "../../../components/ui";
import ScannerCodeBarres from "../../../components/ScannerCodeBarres";
import ImpressionEtiquettes from "../../../components/ImpressionEtiquettes";
import { extraireIdEtiquette } from "@/lib/codesBarres";

const ONGLETS = [
  { code: "resume", label: "Résumé" },
  { code: "mouvements", label: "Mouvements" },
  { code: "achats", label: "Achats" },
  { code: "ventes", label: "Ventes" },
  { code: "fournisseurs", label: "Fournisseurs" },
  { code: "historique", label: "Historique" },
];

const TYPE_MOUVEMENT = {
  RECEPTION: { label: "Réception", couleur: "var(--success)" },
  VENTE: { label: "Vente", couleur: "var(--danger)" },
  AJUSTEMENT: { label: "Ajustement", couleur: "var(--text-muted)" },
};

export default function PieceDetailClient({ piece, categories, fournisseurs, autresPieces, nomEntreprise }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("resume");
  const [afficherEtiquettes, setAfficherEtiquettes] = useState(false);
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [afficherFusion, setAfficherFusion] = useState(false);

  const [nom, setNom] = useState(piece.nom);
  const [numero, setNumero] = useState(piece.numero);
  const [codeBarre, setCodeBarre] = useState(piece.codeBarre || "");
  const [qte, setQte] = useState(piece.qte);
  const [qteMin, setQteMin] = useState(piece.qteMin);
  const [qteMax, setQteMax] = useState(piece.qteMax ?? "");
  const [emplacement, setEmplacement] = useState(piece.emplacement || "");
  const [fournisseurId, setFournisseurId] = useState(piece.fournisseurId || "");
  const [prix, setPrix] = useState(piece.prix);
  const [coutant, setCoutant] = useState(piece.coutant || 0);
  const [categorie, setCategorie] = useState(piece.categorie || "PIECE");

  const marge = piece.prix - (piece.coutant || 0);
  const margePct = piece.prix > 0 ? (marge / piece.prix) * 100 : 0;
  const stockBas = piece.qte <= piece.qteMin;
  const nomCategorie = categories.find((c) => c.code === piece.categorie)?.nom || piece.categorie;

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom, numero, qte, qteMin, prix, coutant, categorie, codeBarre,
        qteMax: qteMax === "" ? null : qteMax,
        emplacement: emplacement.trim() || null,
        fournisseurId: fournisseurId || null,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    const misAJour = await res.json().catch(() => ({}));
    if (misAJour.avertissementComptable) {
      window.alert(`Stock ajusté, mais aucune écriture comptable n'a été passée :\n${misAJour.avertissementComptable}`);
    }
    setModeEdition(false);
    router.refresh();
  }

  async function basculerActif() {
    const message = piece.actif
      ? `Désactiver "${piece.nom}" ? Elle n'apparaîtra plus dans les choix de pièces (bons, réceptions), mais son historique est conservé. Tu pourras la réactiver en tout temps.`
      : `Réactiver "${piece.nom}" ?`;
    if (!window.confirm(message)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !piece.actif }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer "${piece.nom}" de l'inventaire ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/inventaire");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>

      <div style={{ background: "var(--surface)", border: stockBas && piece.actif ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{piece.nom}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{piece.numero}</div>
        <span className="bouton-3d" style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{nomCategorie}</span>
        {!piece.actif && (
          <span style={{ display: "inline-block", marginTop: 8, marginLeft: 6, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid var(--border)", color: "var(--text-muted)" }}>Désactivée</span>
        )}
        {stockBas && piece.actif && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 8, fontWeight: 700 }}>⚠ Stock sous le seuil minimum</div>}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div className="carte">
          <label className="etiquette">Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="champ" />
          <label className="etiquette">Numéro de référence</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} className="champ" />
          <label className="etiquette">Code-barres du fabricant (UPC/EAN) — optionnel</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={codeBarre} onChange={(e) => setCodeBarre(e.target.value)} placeholder="Scanne la boîte d'origine" className="champ" style={{ flex: 1 }} />
            <button type="button" onClick={() => setScannerOuvert(true)} className="bouton-3d-sombre" title="Scanner le code de la boîte" style={{ padding: "0 12px", borderRadius: 8, fontSize: 15, alignSelf: "stretch", marginBottom: 8 }}>📷</button>
          </div>
          {scannerOuvert && (
            <ScannerCodeBarres
              titre="Code-barres de la boîte"
              onFermer={() => setScannerOuvert(false)}
              onDetecte={(texte) => {
                setScannerOuvert(false);
                if (extraireIdEtiquette(texte)) {
                  setErreur("C'est une étiquette de l'appli, pas le code du fabricant — scanne le code-barres imprimé sur la boîte.");
                  return;
                }
                setErreur("");
                setCodeBarre(texte.trim());
              }}
            />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Stock</label>
              <input type="number" min={0} value={qte} onChange={(e) => setQte(e.target.value)} className="champ" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Seuil min.</label>
              <input type="number" min={0} value={qteMin} onChange={(e) => setQteMin(e.target.value)} className="champ" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Seuil max.</label>
              <input type="number" min={0} value={qteMax} onChange={(e) => setQteMax(e.target.value)} placeholder="optionnel" className="champ" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Coût moyen ($)</label>
              <input type="number" min={0} step="0.01" value={coutant} onChange={(e) => setCoutant(e.target.value)} className="champ" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Prix de vente ($)</label>
              <input type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} className="champ" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Emplacement</label>
              <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="ex. A-03-02" className="champ" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="etiquette">Fournisseur habituel</label>
              <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className="champ">
                <option value="">Aucun</option>
                {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </div>
          </div>
          <label className="etiquette">Catégorie</label>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="champ" style={{ marginBottom: 12 }}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <button onClick={() => setModeEdition(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 11, borderRadius: 10, fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
            {ONGLETS.map((o) => (
              <button
                key={o.code}
                onClick={() => setOnglet(o.code)}
                style={{
                  flex: "1 0 auto", fontSize: 11.5, fontWeight: 700, padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  background: onglet === o.code ? "var(--accent)" : "none",
                  color: onglet === o.code ? "#17150f" : "var(--text-muted)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {onglet === "resume" && (
            <OngletResume piece={piece} marge={marge} margePct={margePct} />
          )}
          {onglet === "mouvements" && <OngletMouvements mouvements={piece.mouvements} />}
          {onglet === "achats" && <OngletAchats lignesDepense={piece.lignesDepense} />}
          {onglet === "ventes" && <OngletVentes utilisee={piece.utilisee} />}
          {onglet === "fournisseurs" && <OngletFournisseurs piece={piece} fournisseurs={fournisseurs} />}
          {onglet === "historique" && <OngletHistorique historique={piece.historique} />}

          {afficherFusion && <FusionPiece piece={piece} autresPieces={autresPieces} onFermer={() => setAfficherFusion(false)} />}

          {afficherEtiquettes && (
            <div style={{ marginTop: 16 }}>
              <ImpressionEtiquettes pieces={[{ id: piece.id, qte: piece.qte }]} uneSeule nomEntreprise={nomEntreprise} onFermer={() => setAfficherEtiquettes(false)} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => setAfficherEtiquettes((v) => !v)} className="bouton-3d-sombre" title="Imprimer une étiquette code-barres" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              🏷️
            </button>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              ✏️ Modifier
            </button>
            <button onClick={basculerActif} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              {piece.actif ? "🚫 Désactiver" : "✅ Réactiver"}
            </button>
            <button onClick={() => setAfficherFusion((v) => !v)} disabled={enCours} className="bouton-3d-sombre" title="Fusionner ce doublon dans une autre fiche" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
              🔀
            </button>
            <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
              🗑️
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function OngletResume({ piece, marge, margePct }) {
  return (
    <>
      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Stock</TitreSection>
        <Champ label="Stock actuel" valeur={`${piece.qte}`} />
        <Champ label="Seuil minimum" valeur={`${piece.qteMin}`} />
        {piece.qteMax != null && <Champ label="Seuil maximum" valeur={`${piece.qteMax}`} />}
        {piece.emplacement && <Champ label="Emplacement" valeur={piece.emplacement} />}
        <Champ label="Code-barres fabricant" valeur={piece.codeBarre || "Aucun"} />
        {piece.lignesCommande.length > 0 && (
          <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6 }}>
            {piece.lignesCommande.map((l) => (
              <Link key={l.id} href={`/secretaire/inventaire/commandes/${l.commande.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, color: "inherit", textDecoration: "none" }}>
                <span style={{ color: "var(--text-muted)" }}>{l.commande.statut === "BROUILLON" ? "Brouillon" : "En commande"} — {l.commande.numero} ({l.commande.fournisseur.nom})</span>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>{Math.max(0, l.qteCommandee - l.qteRecue)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Prix et marge</TitreSection>
        <Champ label="Coût moyen" valeur={`${(piece.coutant || 0).toFixed(2)} $`} />
        <Champ label="Prix de vente" valeur={`${piece.prix.toFixed(2)} $`} />
        <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6 }}>
          <Champ label="Marge par unité" valeur={`${marge.toFixed(2)} $ (${margePct.toFixed(0)} %)`} accent />
        </div>
      </div>

      <div className="carte">
        <TitreSection>Fournisseur</TitreSection>
        <Champ label="Fournisseur habituel" valeur={piece.fournisseur?.nom || "Aucun"} />
      </div>
    </>
  );
}

function OngletMouvements({ mouvements }) {
  if (mouvements.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun mouvement de stock enregistré pour cet article pour l'instant.</p>;
  }
  return (
    <div className="carte">
      <TitreSection>Historique des mouvements de stock</TitreSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {mouvements.map((m) => {
          const info = TYPE_MOUVEMENT[m.type] || { label: m.type, couleur: "var(--text)" };
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: info.couleur }}>{info.label}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{new Date(m.creeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
                {m.note && <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{m.note}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.qte >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {m.qte >= 0 ? "+" : ""}{m.qte}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>Solde : {m.solde}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OngletAchats({ lignesDepense }) {
  if (lignesDepense.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun achat lié à cet article — utilise l'option "Réception d'inventaire" en créant une dépense fournisseur pour en enregistrer.</p>;
  }
  return (
    <div className="carte">
      <TitreSection>Réceptions liées à des factures fournisseur</TitreSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lignesDepense.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{l.depense.fournisseur.nom}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                {new Date(l.depense.dateFacture).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {l.depense.description}
              </div>
              <div style={{ fontSize: 10.5, color: l.depense.statut === "PAYEE" ? "var(--success)" : "var(--danger)" }}>
                {l.depense.statut === "PAYEE" ? "Payée" : "Impayée"}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>+{l.qteRecue}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{(l.montant / l.qteRecue).toFixed(2)} $ / unité</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OngletVentes({ utilisee }) {
  if (utilisee.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Cette pièce n'a pas encore été utilisée sur un bon de travail.</p>;
  }
  return (
    <div className="carte">
      <TitreSection>Utilisations sur des bons de travail</TitreSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {utilisee.map((u) => (
          <Link key={u.id} href={`/bons/${u.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              <span style={{ color: "var(--text-muted)" }}>#{u.probleme.bon.numero} — {u.probleme.bon.client.nom}</span>
              <span>{u.qte} × {u.prix.toFixed(2)} $</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Les numéros et prix de cette pièce chez chaque fournisseur — une seule
// fiche pour tous ses numéros — et commande directe chez celui choisi.
function OngletFournisseurs({ piece, fournisseurs }) {
  const router = useRouter();
  const [ajout, setAjout] = useState(false);
  const [nouveauFournisseur, setNouveauFournisseur] = useState("");
  const [nouveauNumero, setNouveauNumero] = useState("");
  const [nouveauCout, setNouveauCout] = useState("");
  const [edition, setEdition] = useState(null); // { id, numero, cout }
  const [commande, setCommande] = useState(null); // { fournisseurId, qte }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  // Quantité déjà reçue de chaque fournisseur (réceptions sur dépenses)
  const recuParFournisseur = {};
  for (const l of piece.lignesDepense) recuParFournisseur[l.depense.fournisseurId] = (recuParFournisseur[l.depense.fournisseurId] || 0) + l.qteRecue;
  const liens = [...piece.fournisseurs].sort((a, b) => (a.coutant ?? Infinity) - (b.coutant ?? Infinity));
  const moinsCher = liens.find((l) => l.coutant != null);
  const fournisseursLibres = fournisseurs.filter((f) => !piece.fournisseurs.some((l) => l.fournisseurId === f.id));

  async function appel(url, methode, corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(url, { method: methode, headers: { "Content-Type": "application/json" }, body: corps ? JSON.stringify(corps) : undefined });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur.");
      return null;
    }
    return data;
  }

  async function ajouterLien(e) {
    e.preventDefault();
    if (!nouveauFournisseur) return;
    const ok = await appel("/api/pieces-fournisseurs", "POST", { pieceId: piece.id, fournisseurId: nouveauFournisseur, numeroFournisseur: nouveauNumero, coutant: nouveauCout });
    if (!ok) return;
    setAjout(false);
    setNouveauFournisseur(""); setNouveauNumero(""); setNouveauCout("");
    router.refresh();
  }

  async function enregistrerEdition() {
    const ok = await appel(`/api/pieces-fournisseurs/${edition.id}`, "PATCH", { numeroFournisseur: edition.numero, coutant: edition.cout });
    if (!ok) return;
    setEdition(null);
    router.refresh();
  }

  async function retirerLien(lien) {
    if (!window.confirm(`Retirer ${lien.fournisseur.nom} des fournisseurs de cette pièce ?`)) return;
    if (await appel(`/api/pieces-fournisseurs/${lien.id}`, "DELETE")) router.refresh();
  }

  async function commander() {
    const data = await appel("/api/commandes-fournisseurs", "POST", {
      fournisseurId: commande.fournisseurId,
      lignes: [{ pieceId: piece.id, qte: Math.max(1, parseInt(commande.qte) || 1) }],
      ajouterAuBrouillon: true,
    });
    if (data) router.push(`/secretaire/inventaire/commandes/${data.id}`);
  }

  return (
    <>
      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Numéros et prix par fournisseur</TitreSection>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
          La même pièce peut avoir un numéro différent chez chaque fournisseur. Le dernier prix se met à jour à chaque réception ; la recherche et le scan trouvent la pièce par n'importe lequel de ces numéros.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {liens.map((l) => (
            <div key={l.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
              {edition?.id === l.id ? (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{l.fournisseur.nom}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={edition.numero} onChange={(e) => setEdition({ ...edition, numero: e.target.value })} placeholder="No chez ce fournisseur" className="champ" style={{ flex: 2, marginBottom: 0 }} />
                    <input type="number" min={0} step="0.01" value={edition.cout} onChange={(e) => setEdition({ ...edition, cout: e.target.value })} placeholder="Prix $" className="champ" style={{ flex: 1, marginBottom: 0 }} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={enregistrerEdition} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 7, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Enregistrer</button>
                    <button onClick={() => setEdition(null)} className="bouton-3d-sombre" style={{ flex: 1, padding: 7, borderRadius: 8, fontSize: 12 }}>Annuler</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {l.fournisseur.nom}
                        {piece.fournisseurId === l.fournisseurId && <span style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 400 }}> · habituel</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{l.numeroFournisseur ? `No ${l.numeroFournisseur}` : "No fournisseur non saisi"}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {l.dernierAchat ? `Dernier achat : ${new Date(l.dernierAchat).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}` : "Jamais acheté ici"}
                        {recuParFournisseur[l.fournisseurId] ? ` · ${recuParFournisseur[l.fournisseurId]} reçues au total` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: moinsCher && l.id === moinsCher.id && liens.length > 1 ? "var(--success)" : "var(--text)" }}>
                        {l.coutant != null ? `${l.coutant.toFixed(2)} $` : "—"}
                      </div>
                      {moinsCher && l.id === moinsCher.id && liens.length > 1 && <div style={{ fontSize: 10, color: "var(--success)" }}>le moins cher</div>}
                    </div>
                  </div>
                  {commande?.fournisseurId === l.fournisseurId ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12 }}>Qté :</span>
                      <input type="number" min={1} value={commande.qte} onChange={(e) => setCommande({ ...commande, qte: e.target.value })} className="champ" style={{ width: 70, marginBottom: 0 }} />
                      <button onClick={commander} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 7, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Ajouter à la commande</button>
                      <button onClick={() => setCommande(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12 }}>
                      <button onClick={() => setCommande({ fournisseurId: l.fournisseurId, qte: "1" })} style={boutonLienStyle}>🛒 Commander ici</button>
                      <button onClick={() => setEdition({ id: l.id, numero: l.numeroFournisseur || "", cout: l.coutant ?? "" })} style={boutonLienStyle}>✏️ Modifier</button>
                      <button onClick={() => retirerLien(l)} style={{ ...boutonLienStyle, color: "var(--danger)" }}>Retirer</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {liens.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Aucun fournisseur lié pour l'instant.</p>}
        </div>

        {ajout ? (
          <form onSubmit={ajouterLien} style={{ marginTop: 10 }}>
            <select value={nouveauFournisseur} onChange={(e) => setNouveauFournisseur(e.target.value)} className="champ" required>
              <option value="">Choisir le fournisseur…</option>
              {fournisseursLibres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={nouveauNumero} onChange={(e) => setNouveauNumero(e.target.value)} placeholder="No chez ce fournisseur" className="champ" style={{ flex: 2 }} />
              <input type="number" min={0} step="0.01" value={nouveauCout} onChange={(e) => setNouveauCout(e.target.value)} placeholder="Prix $" className="champ" style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" disabled={enCours || !nouveauFournisseur} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Lier ce fournisseur</button>
              <button type="button" onClick={() => setAjout(false)} className="bouton-3d-sombre" style={{ flex: 1, padding: 8, borderRadius: 8, fontSize: 12 }}>Annuler</button>
            </div>
          </form>
        ) : (
          fournisseursLibres.length > 0 && (
            <button onClick={() => setAjout(true)} className="bouton-3d-sombre" style={{ width: "100%", marginTop: 10, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>+ Ajouter un fournisseur</button>
          )
        )}
        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>{erreur}</p>}
      </div>

      <div className="carte">
        <TitreSection>Fournisseur habituel</TitreSection>
        <Champ label="Fournisseur par défaut" valeur={piece.fournisseur?.nom || "Aucun — configurable dans Modifier"} />
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0 }}>Proposé en premier quand la pièce passe sous le seuil minimum.</p>
      </div>
    </>
  );
}

// Fusion d'un doublon : cette fiche est versée dans une autre (stock,
// historique, numéros fournisseurs), puis supprimée.
function FusionPiece({ piece, autresPieces, onFermer }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const q = recherche.trim().toLowerCase();
  const suggestions = q ? autresPieces.filter((p) => p.nom.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q)).slice(0, 8) : [];

  async function fusionner(cible) {
    if (!window.confirm(`Fusionner « ${piece.nom} » (${piece.numero}) dans « ${cible.nom} » (${cible.numero}) ?\n\nLe stock (${piece.qte}) s'ajoute à celui de « ${cible.nom} », tout l'historique et les numéros fournisseurs suivent, puis la fiche ${piece.numero} est supprimée. C'est irréversible.`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}/fusionner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cibleId: cible.id }) });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Erreur.");
    router.push(`/secretaire/inventaire/${cible.id}`);
  }

  return (
    <div className="carte" style={{ marginTop: 16, border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 13 }}>🔀 Fusionner ce doublon dans une autre fiche</strong>
        <button onClick={onFermer} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 8px" }}>
        Pour la même pièce entrée deux fois (souvent sous les numéros de deux fournisseurs). Choisis la fiche à garder.
      </p>
      <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Fiche à garder (nom ou numéro)…" className="champ" autoFocus />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {suggestions.map((p) => (
          <button key={p.id} onClick={() => fusionner(p)} disabled={enCours} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}>
            {p.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>— {p.numero} · stock {p.qte}{!p.actif ? " · désactivée" : ""}</span>
          </button>
        ))}
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>{erreur}</p>}
    </div>
  );
}

const boutonLienStyle = { background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0 };

function OngletHistorique({ historique }) {
  if (historique.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune modification enregistrée sur la fiche de cet article.</p>;
  }
  return (
    <div className="carte">
      <TitreSection>Modifications de la fiche</TitreSection>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {historique.map((h) => (
          <div key={h.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
            <div style={{ fontSize: 12 }}>
              <strong>{h.champ}</strong> : {h.ancienneValeur ?? "—"} → {h.nouvelleValeur ?? "—"}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {new Date(h.modifieLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}{h.modifiePar ? ` · ${h.modifiePar}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Champ({ label, valeur, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>{valeur}</span>
    </div>
  );
}

