"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { CHAMPS, DESTINATAIRES } from "@/lib/documents";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonPlein, BoutonContour, Panneau } from "../../components/StyleSection";

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
        <div style={{
          position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px", marginBottom: 18,
        }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--accent)" }} />
          <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="crayon" taille={20} couleur={TEINTES.ambre.couleur} />
          </span>
          <span style={{ flex: 1, minWidth: 180, fontSize: 14 }}>
            Lettre pour <strong>{pour.nom}</strong> — choisis un modèle.
          </span>
          <Link href="/gerant/documents" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", textDecoration: "none" }}>Voir tous les modèles</Link>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <BoutonPlein icone={nouveau ? null : "plus"} onClick={() => { setNouveau((v) => !v); setEnEdition(null); }}>
          {nouveau ? "Annuler" : "Nouveau modèle"}
        </BoutonPlein>
        <BoutonContour href="/gerant/documents/historique" icone="horloge">Historique des courriels</BoutonContour>
      </div>

      {nouveau && <FormulaireModele destinataires={destinataires} onEnregistre={apresEnregistrement} onAnnule={() => setNouveau(false)} />}

      {!pour && (
        <GrilleChiffres>
          {destinataires.map((d) => (
            <CarteChiffre
              key={d}
              titre={`Lettres aux ${DESTINATAIRES[d].libelle.toLowerCase()}s`}
              montant={String(modeles.filter((m) => m.destinataire === d).length)}
              teinte={TEINTE_DESTINATAIRE[d].couleur}
              note={d === "CLIENT" ? "Modèles · imprimer ou envoyer par courriel" : "Modèles · remplis depuis la fiche"}
            />
          ))}
        </GrilleChiffres>
      )}

      {destinataires.map((d) => {
        const liste = modeles.filter((m) => m.destinataire === d);
        const teinte = TEINTE_DESTINATAIRE[d];
        return (
          <Panneau key={d} titre={`Lettres aux ${DESTINATAIRES[d].libelle.toLowerCase()}s`}>
            {liste.length > 0 && (
              <div style={{ display: "flex", padding: "0 6px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: `2px solid ${teinte.couleur}` }}>
                <span style={{ flex: 1 }}>{liste.length} modèle{liste.length > 1 ? "s" : ""}</span>
              </div>
            )}
            {liste.map((m, i) => enEdition === m.id ? (
              <div key={m.id} style={{ marginTop: 12 }}>
                <FormulaireModele modele={m} destinataires={destinataires} onEnregistre={apresEnregistrement} onAnnule={() => setEnEdition(null)} />
              </div>
            ) : (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 6px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: teinte.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icone nom="document" taille={20} couleur={teinte.couleur} />
                </span>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.nom}</div>
                  {m.destinataire === "CLIENT" && !pour && (
                    <Link href={`/gerant/documents/envoi-groupe?modele=${m.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 12.5, color: "var(--accent-ombre)", textDecoration: "none", fontWeight: 700 }}>
                      <Icone nom="utilisateurs" taille={14} /> Envoi groupé par courriel
                    </Link>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
                  <button onClick={() => { setEnEdition(m.id); setNouveau(false); }} style={boutonSecondaire}>Modifier</button>
                  <Link href={`/gerant/documents/rediger?modele=${m.id}${pour ? `&pour=${pour.id}` : ""}`} style={{ ...boutonSecondaire, background: "var(--accent)", borderColor: "var(--accent)", color: "#221f18", textDecoration: "none" }}>
                    <Icone nom="crayon" taille={15} /> Rédiger
                  </Link>
                </div>
              </div>
            ))}
            {liste.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun modèle.</p>}
          </Panneau>
        );
      })}
    </div>
  );
}

const TEINTE_DESTINATAIRE = { EMPLOYE: TEINTES.bleu, CLIENT: TEINTES.vert };

const boutonSecondaire = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer",
};

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
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
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
          <button key={cle} type="button" onClick={() => insererChamp(cle)} title={`{${cle}}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: "none", background: "rgba(232,163,61,0.14)", color: "var(--accent-ombre)", cursor: "pointer" }}>
            <span style={{ fontWeight: 800 }}>+</span>
            {libelle}
          </button>
        ))}
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={enregistrer} disabled={enCours} style={{ ...boutonSecondaire, background: "var(--accent)", borderColor: "var(--accent)", color: "#221f18" }}>Enregistrer</button>
        <button onClick={onAnnule} disabled={enCours} style={boutonSecondaire}>Annuler</button>
        {modele && (
          <button onClick={supprimer} disabled={enCours} style={{ ...boutonSecondaire, marginLeft: "auto", color: "var(--danger)" }}>
            <Icone nom="poubelle" taille={15} /> Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
