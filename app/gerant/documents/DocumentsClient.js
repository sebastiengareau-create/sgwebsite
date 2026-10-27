"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { CHAMPS, DESTINATAIRES } from "@/lib/documents";

export default function DocumentsClient({ modeles, destinataires, pour }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState(false);
  const [enEdition, setEnEdition] = useState(null);

  function apresEnregistrement() {
    setNouveau(false);
    setEnEdition(null);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📄" titre="Documents" sousTitre="Lettres prêtes à imprimer, remplies à partir de la fiche d'un employé ou d'un client." />

      {pour && (
        <div className="carte carte-s" style={{ marginBottom: 16, fontSize: 13 }}>
          Lettre pour <strong>{pour.nom}</strong> — choisis un modèle.{" "}
          <Link href="/gerant/documents" style={{ color: "var(--text-muted)", fontSize: 12 }}>Voir tous les modèles</Link>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => { setNouveau((v) => !v); setEnEdition(null); }} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>
          {nouveau ? "Annuler" : "+ Nouveau modèle"}
        </button>
      </div>

      {nouveau && <FormulaireModele destinataires={destinataires} onEnregistre={apresEnregistrement} onAnnule={() => setNouveau(false)} />}

      {destinataires.map((d) => {
        const liste = modeles.filter((m) => m.destinataire === d);
        return (
          <div key={d} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Lettres aux {DESTINATAIRES[d].libelle.toLowerCase()}s</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {liste.map((m) => enEdition === m.id ? (
                <FormulaireModele key={m.id} modele={m} destinataires={destinataires} onEnregistre={apresEnregistrement} onAnnule={() => setEnEdition(null)} />
              ) : (
                <div key={m.id} className="carte carte-m" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 600 }}>{m.nom}</div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => { setEnEdition(m.id); setNouveau(false); }} className="bouton-3d-sombre" style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Modifier</button>
                    <Link href={`/gerant/documents/rediger?modele=${m.id}${pour ? `&pour=${pour.id}` : ""}`} className="bouton-3d" style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>✍️ Rédiger</Link>
                  </div>
                </div>
              ))}
              {liste.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun modèle.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Création (sans modele) ou modification d'un modèle
function FormulaireModele({ modele, destinataires, onEnregistre, onAnnule }) {
  const [nom, setNom] = useState(modele?.nom || "");
  const [destinataire, setDestinataire] = useState(modele?.destinataire || destinataires[0]);
  const [contenu, setContenu] = useState(modele?.contenu || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const zoneTexte = useRef(null);

  // Insère {champ} là où est le curseur
  function insererChamp(cle) {
    const zone = zoneTexte.current;
    const debut = zone?.selectionStart ?? contenu.length;
    const fin = zone?.selectionEnd ?? contenu.length;
    const jeton = `{${cle}}`;
    setContenu(contenu.slice(0, debut) + jeton + contenu.slice(fin));
    requestAnimationFrame(() => {
      zone?.focus();
      zone?.setSelectionRange(debut + jeton.length, debut + jeton.length);
    });
  }

  async function enregistrer() {
    setEnCours(true);
    setErreur("");
    const res = await fetch(modele ? `/api/documents/modeles/${modele.id}` : "/api/documents/modeles", {
      method: modele ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, destinataire, contenu }),
    });
    setEnCours(false);
    if (!res.ok) return setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de l'enregistrement.");
    onEnregistre();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le modèle « ${modele.nom} » ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/documents/modeles/${modele.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) return setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de la suppression.");
    onEnregistre();
  }

  return (
    <div className="carte" style={{ marginBottom: 16 }}>
      <label className="etiquette">Nom du modèle</label>
      <input value={nom} onChange={(e) => setNom(e.target.value)} className="champ" placeholder="ex. Lettre de référence" />
      {destinataires.length > 1 && (
        <>
          <label className="etiquette">Destinataire</label>
          <select value={destinataire} onChange={(e) => setDestinataire(e.target.value)} className="champ">
            {destinataires.map((d) => <option key={d} value={d}>{DESTINATAIRES[d].libelle}</option>)}
          </select>
        </>
      )}
      <label className="etiquette">Texte de la lettre</label>
      <textarea ref={zoneTexte} value={contenu} onChange={(e) => setContenu(e.target.value)} className="champ" rows={16} style={{ fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} />
      <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 6px" }}>
        Champs remplis automatiquement — touche pour l'insérer. Écris entre [crochets] ce qui reste à compléter à la main.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(CHAMPS[destinataire]).map(([cle, libelle]) => (
          <button key={cle} type="button" onClick={() => insererChamp(cle)} title={`{${cle}}`} style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer" }}>
            {libelle}
          </button>
        ))}
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>Enregistrer</button>
        <button onClick={onAnnule} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>Annuler</button>
        {modele && (
          <button onClick={supprimer} disabled={enCours} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "none", border: "1px solid var(--danger)", color: "var(--danger)", cursor: "pointer" }}>Supprimer</button>
        )}
      </div>
    </div>
  );
}
