"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import BoutonImporterFichier from "../../components/BoutonImporterFichier";
import ScannerCodeBarres from "../../components/ScannerCodeBarres";
import ImpressionEtiquettes from "../../components/ImpressionEtiquettes";
import { trouverPieceParScan, normaliserCode, extraireIdEtiquette } from "@/lib/codesBarres";

export default function InventaireClient({ pieces, enCommande = {}, categories, comptesRevenu, fournisseurs, alignement, peutGererCategories, peutImporter }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [afficherCategories, setAfficherCategories] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [voirDesactivees, setVoirDesactivees] = useState(false);
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [codeInconnu, setCodeInconnu] = useState(null);
  const [messageScan, setMessageScan] = useState("");
  const [codeBarreNouvelle, setCodeBarreNouvelle] = useState("");
  const [modeEtiquettes, setModeEtiquettes] = useState(false);
  const [selection, setSelection] = useState(() => new Set());
  const nombreDesactivees = pieces.filter((p) => !p.actif).length;

  const nomCategorie = (code) => categories.find((c) => c.code === code)?.nom || code;

  const piecesFiltrees = pieces.filter((p) => {
    if (!p.actif && !voirDesactivees) return false;
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return p.nom.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q)
      || (p.codeBarre && normaliserCode(p.codeBarre).includes(normaliserCode(q)))
      || p.fournisseurs.some((f) => f.numeroFournisseur?.toLowerCase().includes(q));
  });

  // Un scan ouvre la fiche de la pièce ; un code inconnu (boîte d'un
  // fabricant jamais scannée) propose de l'associer à une pièce.
  function scanDetecte(texte) {
    setScannerOuvert(false);
    setMessageScan("");
    const { piece, code, parEtiquette } = trouverPieceParScan(pieces, texte);
    if (piece) return router.push(`/secretaire/inventaire/${piece.id}`);
    if (parEtiquette) return setMessageScan("Cette étiquette correspond à une pièce qui n'existe plus dans l'inventaire.");
    setCodeInconnu(code);
  }

  function basculerSelection(id) {
    setSelection((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id); else copie.add(id);
      return copie;
    });
  }
  const piecesSelectionnees = pieces.filter((p) => selection.has(p.id));

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📦" titre="Inventaire" sousTitre="Crée, ajuste ou retire des pièces. Le stock se déduit automatiquement quand une pièce est utilisée sur un bon de travail." />

      {alignement && <AlignementInventaire alignement={alignement} />}

      <button
        onClick={() => { setCodeInconnu(null); setScannerOuvert(true); }}
        className="bouton-3d"
        style={{ display: "block", width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, marginBottom: 12 }}
      >
        📷 Scanner une pièce
      </button>
      {scannerOuvert && <ScannerCodeBarres titre="Scanner une pièce" onDetecte={scanDetecte} onFermer={() => setScannerOuvert(false)} />}
      {messageScan && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 12px" }}>{messageScan}</p>}
      {codeInconnu && (
        <CodeInconnu
          code={codeInconnu}
          pieces={pieces.filter((p) => p.actif)}
          onAssociee={(id) => router.push(`/secretaire/inventaire/${id}`)}
          onNouvelle={() => { setCodeBarreNouvelle(codeInconnu); setCodeInconnu(null); setAfficherFormulaire(true); }}
          onFermer={() => setCodeInconnu(null)}
        />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => { setModeEtiquettes((v) => !v); setSelection(new Set()); }}
          className="bouton-3d-sombre"
          style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
        >
          {modeEtiquettes ? "Terminer les étiquettes" : "🏷️ Étiquettes"}
        </button>
        {peutImporter && <BoutonImporterFichier apiUrl="/api/inventaire/importer" libelle="depuis Excel" libellePluriel="pièce" />}
        <button
          onClick={() => { setAfficherFormulaire((v) => !v); setCodeBarreNouvelle(""); }}
          className="bouton-3d"
          style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
        >
          {afficherFormulaire ? "Annuler" : "+ Nouvelle pièce"}
        </button>
      </div>

      <Link
        href="/secretaire/inventaire/commandes"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🛒 Commandes fournisseurs
      </Link>
      <Link
        href="/gerant/comptabilite/rapports/inventaire"
        target="_blank"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
      >
        📄 Rapport d'inventaire (PDF / Excel / imprimer)
      </Link>

      {peutGererCategories && (
        <button
          onClick={() => setAfficherCategories((v) => !v)}
          style={{ fontSize: 11.5, color: "var(--accent)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", marginBottom: 12, padding: 0 }}
        >
          {afficherCategories ? "Fermer la gestion des catégories" : "⚙️ Gérer les catégories d'inventaire"}
        </button>
      )}
      {afficherCategories && (
        <GestionCategories categories={categories} comptesRevenu={comptesRevenu} onModifie={() => window.location.reload()} />
      )}

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par nom, numéro ou no fournisseur…"
        style={{ ...champStyle, marginBottom: nombreDesactivees > 0 ? 6 : 16 }}
      />
      {nombreDesactivees > 0 && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={voirDesactivees} onChange={(e) => setVoirDesactivees(e.target.checked)} />
          Afficher les pièces désactivées ({nombreDesactivees})
        </label>
      )}

      {modeEtiquettes && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 8, gap: 8 }}>
            <span style={{ color: "var(--text-muted)" }}>Touche les pièces à étiqueter — {selection.size} choisie{selection.size > 1 ? "s" : ""}</span>
            <span style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setSelection(new Set(piecesFiltrees.map((p) => p.id)))} style={boutonLien}>Tout ({piecesFiltrees.length})</button>
              <button onClick={() => setSelection(new Set())} style={boutonLien}>Aucune</button>
            </span>
          </div>
          {piecesSelectionnees.length > 0 && (
            <ImpressionEtiquettes pieces={piecesSelectionnees.map((p) => ({ id: p.id, qte: p.qte }))} />
          )}
        </>
      )}

      {afficherFormulaire && (
        <FormulaireCreation key={codeBarreNouvelle} codeBarreInitial={codeBarreNouvelle} categories={categories.filter((c) => c.actif)} fournisseurs={fournisseurs} onCree={() => { setAfficherFormulaire(false); router.refresh(); }} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {piecesFiltrees.map((p) => {
          const carte = (
            <div style={{ background: "var(--surface)", border: modeEtiquettes && selection.has(p.id) ? "1px solid var(--accent)" : p.actif && p.qte <= p.qteMin ? "1px solid #3a2620" : "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, opacity: p.actif ? 1 : 0.55 }}>
              {modeEtiquettes && <input type="checkbox" checked={selection.has(p.id)} readOnly style={{ flexShrink: 0, pointerEvents: "none" }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{p.nom}{!p.actif && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}> (désactivée)</span>}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{p.numero}</div>
                <div style={{ fontSize: 10.5, color: "var(--accent)", marginTop: 2 }}>{nomCategorie(p.categorie)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: p.actif && p.qte <= p.qteMin ? "var(--danger)" : "var(--text)" }}>{p.qte} en stock</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.prix.toFixed(2)} $ vente</div>
                {enCommande[p.id] > 0 && <div style={{ fontSize: 10.5, color: "var(--accent)" }}>+{enCommande[p.id]} en commande</div>}
              </div>
            </div>
          );
          return modeEtiquettes ? (
            <div key={p.id} onClick={() => basculerSelection(p.id)} style={{ cursor: "pointer" }}>{carte}</div>
          ) : (
            <Link key={p.id} href={`/secretaire/inventaire/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>{carte}</Link>
          );
        })}
        {piecesFiltrees.length === 0 && pieces.length > 0 && recherche.trim() && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune pièce ne correspond à "{recherche}".</p>
        )}
        {pieces.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune pièce dans l'inventaire — ajoute la première avec "+ Nouvelle pièce".</p>
        )}
      </div>
    </div>
  );
}

function GestionCategories({ categories, comptesRevenu, onModifie }) {
  const [nom, setNom] = useState("");
  const [modeCompte, setModeCompte] = useState("nouveau"); // "existant" | "nouveau"
  const [compteRevenuNumero, setCompteRevenuNumero] = useState(comptesRevenu[0]?.numero || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [editionId, setEditionId] = useState(null);
  const [nomEdition, setNomEdition] = useState("");
  const [compteEdition, setCompteEdition] = useState("");

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    if (!nom.trim()) return;
    setEnCours(true);
    const res = await fetch("/api/inventaire/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        modeCompte === "nouveau" ? { nom, nomNouveauCompte: nom } : { nom, compteRevenuNumero }
      ),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setNom("");
    onModifie();
  }

  async function desactiver(id) {
    if (!window.confirm("Retirer cette catégorie ? Les pièces déjà classées dedans garderont leur catégorie, mais elle n'apparaîtra plus dans la liste pour de nouvelles pièces.")) return;
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    onModifie();
  }

  async function reactiver(id) {
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: true }),
    });
    onModifie();
  }

  function commencerEdition(c) {
    setEditionId(c.id);
    setNomEdition(c.nom);
    setCompteEdition(c.compteRevenuNumero);
  }

  async function enregistrerEdition(id) {
    if (!nomEdition.trim()) return;
    setEnCours(true);
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomEdition.trim(), compteRevenuNumero: compteEdition }),
    });
    setEnCours(false);
    setEditionId(null);
    onModifie();
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Catégories existantes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ opacity: c.actif ? 1 : 0.55 }}>
            {editionId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 8 }}>
                <input value={nomEdition} onChange={(e) => setNomEdition(e.target.value)} style={{ ...champStyle, marginBottom: 0, fontSize: 12.5 }} />
                <select value={compteEdition} onChange={(e) => setCompteEdition(e.target.value)} style={{ ...champStyle, marginBottom: 0, fontSize: 12.5 }}>
                  {comptesRevenu.map((co) => <option key={co.id} value={co.numero}>{co.numero} — {co.nom}</option>)}
                  {!comptesRevenu.some((co) => co.numero === c.compteRevenuNumero) && (
                    <option value={c.compteRevenuNumero}>{c.compteRevenuNumero} — (actuel)</option>
                  )}
                </select>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <button type="button" onClick={() => enregistrerEdition(c.id)} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEditionId(null)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 11.5, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span>{c.nom}{!c.actif && " (inactive)"} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>→ {c.compteRevenuNumero}</span></span>
                <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => commencerEdition(c)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>✏️</button>
                  {c.actif ? (
                    <button onClick={() => desactiver(c.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>✕</button>
                  ) : (
                    <button onClick={() => reactiver(c.id)} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", fontSize: 11 }}>Réactiver</button>
                  )}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input placeholder="Nom de la catégorie (ex : Huiles)" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />

        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
          <button type="button" onClick={() => setModeCompte("nouveau")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "nouveau" ? "var(--accent)" : "none", color: modeCompte === "nouveau" ? "#17150f" : "var(--text-muted)" }}>
            + Nouveau compte
          </button>
          <button type="button" onClick={() => setModeCompte("existant")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "existant" ? "var(--accent)" : "none", color: modeCompte === "existant" ? "#17150f" : "var(--text-muted)" }}>
            Compte existant
          </button>
        </div>

        {modeCompte === "nouveau" ? (
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "2px 0 0" }}>Un compte "{nom || "…"}" sera créé automatiquement, avec le prochain numéro disponible.</p>
        ) : (
          <select value={compteRevenuNumero} onChange={(e) => setCompteRevenuNumero(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
            {comptesRevenu.map((c) => <option key={c.id} value={c.numero}>{c.numero} — {c.nom}</option>)}
          </select>
        )}

        {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "Création…" : "+ Ajouter la catégorie"}
        </button>
      </form>
    </div>
  );
}

function FormulaireCreation({ categories, fournisseurs, onCree, codeBarreInitial = "" }) {
  const [nom, setNom] = useState("");
  const [numero, setNumero] = useState("");
  const [codeBarre, setCodeBarre] = useState(codeBarreInitial);
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [qte, setQte] = useState("0");
  const [qteMin, setQteMin] = useState("0");
  const [qteMax, setQteMax] = useState("");
  const [emplacement, setEmplacement] = useState("");
  const [fournisseurId, setFournisseurId] = useState("");
  const [prix, setPrix] = useState("");
  const [coutant, setCoutant] = useState("");
  const [categorie, setCategorie] = useState(categories[0]?.code || "PIECE");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/inventaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, numero, codeBarre, qte, qteMin, qteMax, emplacement, fournisseurId, prix, coutant, categorie }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    const cree = await res.json().catch(() => ({}));
    if (cree.avertissementComptable) {
      window.alert(`Pièce créée, mais aucune écriture comptable n'a été passée pour son stock de départ :\n${cree.avertissementComptable}`);
    }
    onCree();
  }

  return (
    <form onSubmit={creer} className="carte carte-m" style={{ marginBottom: 4 }}>
      <input required placeholder="Nom de la pièce (ex : Filtre à huile)" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <input required placeholder="Numéro de référence (ex : FO-2201)" value={numero} onChange={(e) => setNumero(e.target.value)} style={champStyle} />
      <label style={labelStyle}>Code-barres du fabricant (UPC/EAN) — optionnel</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={codeBarre} onChange={(e) => setCodeBarre(e.target.value)} placeholder="Scanne la boîte d'origine" style={{ ...champStyle, flex: 1 }} />
        <button type="button" onClick={() => setScannerOuvert(true)} className="bouton-3d-sombre" title="Scanner le code de la boîte" style={{ padding: "0 12px", borderRadius: 8, fontSize: 15, marginBottom: 8 }}>📷</button>
      </div>
      {scannerOuvert && (
        <ScannerCodeBarres
          titre="Code-barres de la boîte"
          onFermer={() => setScannerOuvert(false)}
          onDetecte={(texte) => {
            setScannerOuvert(false);
            if (extraireIdEtiquette(texte)) return setErreur("C'est une étiquette de l'appli, pas le code du fabricant — scanne le code-barres imprimé sur la boîte.");
            setCodeBarre(texte.trim());
          }}
        />
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Quantité en stock</label>
          <input type="number" min={0} value={qte} onChange={(e) => setQte(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Seuil minimum</label>
          <input type="number" min={0} value={qteMin} onChange={(e) => setQteMin(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Seuil maximum</label>
          <input type="number" min={0} value={qteMax} onChange={(e) => setQteMax(e.target.value)} placeholder="optionnel" style={champStyle} />
        </div>
      </div>
      <label style={labelStyle}>Prix unitaire ($)</label>
      <input required type="number" min={0} step="0.01" value={prix} onChange={(e) => setPrix(e.target.value)} style={champStyle} />
      <label style={labelStyle}>Prix coûtant ($) — optionnel, pour le calcul de marge</label>
      <input type="number" min={0} step="0.01" value={coutant} onChange={(e) => setCoutant(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Emplacement — optionnel</label>
          <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="ex. A-03-02" style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Fournisseur habituel — optionnel</label>
          <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} style={champStyle}>
            <option value="">Aucun</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>
      </div>
      <label style={labelStyle}>Catégorie</label>
      <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
        {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
      </select>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, fontWeight: 700 }}>
        {enCours ? "Création…" : "Ajouter la pièce"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
const boutonLien = { background: "none", border: "none", color: "var(--accent)", textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0 };
const boutonSecondaire = {
  flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "none",
  color: "var(--text-muted)", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
};

const fmtMontant = (n) => `${n.toFixed(2)} $`;

function AlignementInventaire({ alignement }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const aligne = Math.abs(alignement.ecart) < 0.005;

  async function aligner() {
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/inventaire/aligner", { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{
      background: aligne ? "rgba(111,169,107,0.10)" : "rgba(201,162,39,0.12)",
      border: `1px solid ${aligne ? "var(--success)" : "#C9A227"}`,
      borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12.5,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>Valeur du stock (qté × coûtant)</span><strong>{fmtMontant(alignement.valeurStock)}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <span>Grand livre — 1200 Inventaire de pièces</span><strong>{fmtMontant(alignement.soldeGL)}</strong>
      </div>
      {alignement.surBonsNonFactures > 0.005 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 2, color: "var(--text-muted)" }}>
          <span>Pièces sur bons non facturés (sorties du stock, pas encore au G/L)</span><span>{fmtMontant(alignement.surBonsNonFactures)}</span>
        </div>
      )}
      <p style={{ margin: "8px 0 0", fontWeight: 700 }}>
        {aligne ? "✅ Inventaire aligné avec le grand livre" : `⚠️ Écart de ${fmtMontant(alignement.ecart)}`}
      </p>
      {!aligne && (
        <>
          <p style={{ margin: "4px 0 8px", color: "var(--text-muted)" }}>
            L'alignement passe une écriture entre 1200 et 3010 Soldes d'ouverture, sans toucher au bénéfice. Un solde d'ouverture déjà saisi est pris en compte.
          </p>
          <button onClick={aligner} disabled={enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            {enCours ? "…" : "Aligner l'inventaire sur le grand livre"}
          </button>
        </>
      )}
      {erreur && <p style={{ color: "var(--danger)", margin: "6px 0 0" }}>{erreur}</p>}
    </div>
  );
}

// Code scanné qui ne correspond à aucune pièce (typiquement le code-barres
// d'un fabricant, la première fois) : l'associer à une pièce existante ou
// créer la pièce avec ce code.
function CodeInconnu({ code, pieces, onAssociee, onNouvelle, onFermer }) {
  const [recherche, setRecherche] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const q = recherche.trim().toLowerCase();
  const suggestions = q
    ? pieces.filter((p) => p.nom.toLowerCase().includes(q) || p.numero.toLowerCase().includes(q)).slice(0, 8)
    : [];

  async function associer(piece) {
    if (piece.codeBarre && !window.confirm(`« ${piece.nom} » a déjà le code ${piece.codeBarre}. Le remplacer par ${code} ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeBarre: code }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onAssociee(piece.id);
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 12, border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 13 }}>
          Code inconnu : <strong style={{ fontFamily: "monospace" }}>{code}</strong>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Associe-le à une pièce : la prochaine fois, le scan la trouvera directement.</div>
        </div>
        <button onClick={onFermer} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>✕</button>
      </div>
      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Chercher la pièce par nom ou numéro…"
        autoFocus
        style={{ ...champStyle, marginTop: 10 }}
      />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {suggestions.map((p) => (
            <button
              key={p.id}
              onClick={() => associer(p)}
              disabled={enCours}
              style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}
            >
              {p.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>— {p.numero}</span>
              {p.codeBarre && <span style={{ color: "var(--text-muted)" }}> (a déjà un code)</span>}
            </button>
          ))}
        </div>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <button onClick={onNouvelle} className="bouton-3d-sombre" style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
        + Nouvelle pièce avec ce code
      </button>
    </div>
  );
}
