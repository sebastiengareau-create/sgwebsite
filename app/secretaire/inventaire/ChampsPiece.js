"use client";

import { useState } from "react";
import { Icone } from "../../components/StyleSection";
import ScannerCodeBarres from "../../components/ScannerCodeBarres";
import { extraireIdEtiquette } from "@/lib/codesBarres";

// Champs d'une fiche de pièce, les mêmes pour « Nouvelle pièce »
// (InventaireClient) et « Modifier la pièce » (PieceDetailClient).
// valeurs : { nom, numero, autresNumeros, codeBarre, qte, qteMin, qteMax,
// coutant, prix, emplacement, fournisseurId, categorie } ; onChange(champ,
// valeur) ; onErreur(message) pour une étiquette de l'appli scannée.
export default function ChampsPiece({ valeurs: v, onChange, onErreur, categories, fournisseurs, libelleCoutant = "Coût moyen ($)", libellePrix = "Prix de vente ($)", requis = false }) {
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const champ = (nom) => ({ value: v[nom], onChange: (e) => onChange(nom, e.target.value) });

  return (
    <>
      <label className="etiquette">Description{requis ? " *" : ""}</label>
      <input required={requis} {...champ("nom")} placeholder={requis ? "ex. Filtre à huile" : undefined} className="champ" />
      <label className="etiquette">Numéro de référence{requis ? " *" : ""}</label>
      <input required={requis} {...champ("numero")} placeholder={requis ? "ex. FO-2201" : undefined} className="champ" />
      <label className="etiquette">Autres numéros (UGS) — séparés par des virgules, trouvés en recherche</label>
      <input {...champ("autresNumeros")} placeholder="ex. ABC-123, 4567" className="champ" />
      <label className="etiquette">Code-barres du fabricant (UPC/EAN) — optionnel</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input {...champ("codeBarre")} placeholder="Scanne la boîte d'origine" className="champ" style={{ flex: 1 }} />
        <button type="button" onClick={() => setScannerOuvert(true)} title="Scanner le code de la boîte" aria-label="Scanner le code de la boîte" style={{ width: 44, borderRadius: 10, alignSelf: "stretch", marginBottom: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="camera" taille={18} couleur="var(--accent-ombre)" />
        </button>
      </div>
      {scannerOuvert && (
        <ScannerCodeBarres
          titre="Code-barres de la boîte"
          onFermer={() => setScannerOuvert(false)}
          onDetecte={(texte) => {
            setScannerOuvert(false);
            if (extraireIdEtiquette(texte)) {
              onErreur?.("C'est une étiquette de l'appli, pas le code du fabricant — scanne le code-barres imprimé sur la boîte.");
              return;
            }
            onErreur?.("");
            onChange("codeBarre", texte.trim());
          }}
        />
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <div>
          <label className="etiquette">Stock</label>
          <input type="number" min={0} {...champ("qte")} className="champ" />
        </div>
        <div>
          <label className="etiquette">Seuil min.</label>
          <input type="number" min={0} {...champ("qteMin")} className="champ" />
        </div>
        <div>
          <label className="etiquette">Seuil max.</label>
          <input type="number" min={0} {...champ("qteMax")} placeholder="optionnel" className="champ" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label className="etiquette">{libelleCoutant}</label>
          <input type="number" min={0} step="0.01" {...champ("coutant")} className="champ" />
        </div>
        <div>
          <label className="etiquette">{libellePrix}</label>
          <input required={requis} type="number" min={0} step="0.01" {...champ("prix")} className="champ" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label className="etiquette">Emplacement</label>
          <input {...champ("emplacement")} placeholder="ex. A-03-02" className="champ" />
        </div>
        <div>
          <label className="etiquette">Fournisseur habituel</label>
          <select {...champ("fournisseurId")} className="champ">
            <option value="">Aucun</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>
      </div>
      <label className="etiquette">Catégorie</label>
      <select {...champ("categorie")} className="champ" style={{ marginBottom: 14 }}>
        {categories.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
      </select>
    </>
  );
}
