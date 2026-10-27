"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DESTINATAIRES, remplirModele, passagesACompleter, sujetParDefaut } from "@/lib/documents";
import { image } from "@/lib/client";

// Choix de l'employé ou du client, texte rempli modifiable, puis impression
// de la lettre sur l'en-tête de l'entreprise, ou envoi par courriel. Le
// texte modifié n'est pas enregistré : le modèle, lui, reste intact.
export default function RedigerClient({ modele, personnes, choisi, valeurs, entreprise, courrielConfigure }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [texte, setTexte] = useState(() => (valeurs ? remplirModele(modele.contenu, valeurs, modele.destinataire) : ""));
  const libelle = DESTINATAIRES[modele.destinataire].libelle.toLowerCase();
  const aCompleter = passagesACompleter(texte);

  const terme = recherche.trim().toLowerCase();
  const resultats = terme ? personnes.filter((p) => p.nom.toLowerCase().includes(terme) || p.telephone?.includes(terme)).slice(0, 8) : [];

  function choisir(id) {
    setRecherche("");
    router.replace(`/gerant/documents/rediger?modele=${modele.id}&pour=${id}`);
  }

  return (
    <div>
      <style>{`
        @media print {
          .cacher-impression { display: none !important; }
          body { background: white !important; }
          .feuille-lettre { margin: 0 !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="cacher-impression conteneur-page" style={{ paddingBottom: 0 }}>
        <Link href="/gerant/documents" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux documents</Link>
        <h1 style={{ fontSize: 20, margin: "10px 0 14px" }}>✍️ {modele.nom}</h1>

        <div className="carte" style={{ marginBottom: 16 }}>
          <label className="etiquette" style={{ marginTop: 0 }}>{choisi ? `Pour : ${choisi.nom}` : `Choisis le ${libelle}`}</label>
          <input
            type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ"
            placeholder={choisi ? `🔍 Changer de ${libelle}…` : `🔍 Rechercher un ${libelle} par nom${modele.destinataire === "CLIENT" ? " ou téléphone" : ""}…`}
          />
          {resultats.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {resultats.map((p) => (
                <button key={p.id} onClick={() => choisir(p.id)} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
                  {p.nom}
                  {p.telephone && <span style={{ color: "var(--text-muted)", fontSize: 11 }}> · {p.telephone}</span>}
                  {p.actif === false && <span style={{ color: "var(--text-muted)", fontSize: 11 }}> · inactif</span>}
                </button>
              ))}
            </div>
          )}
          {terme && resultats.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>Aucun {libelle} ne correspond.</p>}

          {choisi && (
            <>
              <label className="etiquette">Texte de la lettre — modifiable avant d'imprimer (le modèle ne change pas)</label>
              <textarea value={texte} onChange={(e) => setTexte(e.target.value)} className="champ" rows={16} style={{ fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} />
              {aCompleter.length > 0 && (
                <p style={{ fontSize: 12, color: "var(--avertissement)", margin: "8px 0 0" }}>
                  ⚠️ À compléter avant d'imprimer : {aCompleter.join(" · ")}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={() => window.print()} className="bouton-3d" style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>🖨️ Imprimer / PDF</button>
                <button onClick={() => setTexte(remplirModele(modele.contenu, valeurs, modele.destinataire))} className="bouton-3d-sombre" style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>Recommencer à partir du modèle</button>
              </div>
              <EnvoiCourriel modele={modele} choisi={choisi} texte={texte} aCompleter={aCompleter} courrielConfigure={courrielConfigure} />
            </>
          )}
        </div>
      </div>

      {choisi && (
        <div className="feuille-lettre" style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 48px", fontFamily: "Arial, sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #17150f", paddingBottom: 14, marginBottom: 28 }}>
            <img src={image("logo.png")} alt={entreprise.nomEntreprise} style={{ width: 50, height: 50, objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{entreprise.nomEntreprise}</div>
              <div style={{ fontSize: 11.5, color: "#666", marginTop: 3, lineHeight: 1.4 }}>
                {[entreprise.adresseLigne1, entreprise.adresseLigne2, [entreprise.telephone, entreprise.courriel].filter(Boolean).join(" · ")].filter(Boolean).map((l) => <div key={l}>{l}</div>)}
              </div>
            </div>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{texte}</div>
        </div>
      )}
    </div>
  );
}

// Envoi de la lettre (le texte tel qu'affiché) au courriel de la fiche, ou
// à une autre adresse
function EnvoiCourriel({ modele, choisi, texte, aCompleter, courrielConfigure }) {
  const [ouvert, setOuvert] = useState(false);
  const [a, setA] = useState(choisi.courriel);
  const [sujet, setSujet] = useState(() => sujetParDefaut(texte, modele.nom));
  const [etat, setEtat] = useState({ enCours: false, message: "", erreur: "" });

  if (!courrielConfigure) return <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "10px 0 0" }}>L'envoi par courriel n'est pas configuré sur cette installation.</p>;
  if (choisi.desabonne && modele.destinataire === "CLIENT") return <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "10px 0 0" }}>✉️ Ce client s'est désabonné de nos courriels — impression seulement.</p>;

  async function envoyer() {
    if (aCompleter.length > 0 && !window.confirm(`Il reste à compléter : ${aCompleter.join(" · ")}\n\nEnvoyer quand même ?`)) return;
    setEtat({ enCours: true, message: "", erreur: "" });
    const res = await fetch("/api/documents/envoyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeleId: modele.id, pourId: choisi.id, a, sujet, texte }),
    });
    const donnees = await res.json().catch(() => ({}));
    setEtat(res.ok ? { enCours: false, message: `✅ Envoyé à ${donnees.a}`, erreur: "" } : { enCours: false, message: "", erreur: donnees.erreur || "Échec de l'envoi." });
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="bouton-3d-sombre" style={{ marginTop: 8, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
        ✉️ Envoyer par courriel
      </button>
    );
  }
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      <label className="etiquette" style={{ marginTop: 0 }}>Courriel du destinataire</label>
      <input type="email" value={a} onChange={(e) => setA(e.target.value)} className="champ" placeholder="adresse@exemple.com" />
      <label className="etiquette">Sujet</label>
      <input value={sujet} onChange={(e) => setSujet(e.target.value)} className="champ" />
      {modele.destinataire === "CLIENT" && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>Vos coordonnées et un lien de désabonnement sont ajoutés au bas du courriel (exigé par la loi anti-pourriel).</p>
      )}
      {etat.erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>{etat.erreur}</p>}
      {etat.message && <p style={{ color: "var(--success)", fontSize: 12, margin: "8px 0 0" }}>{etat.message}</p>}
      <button onClick={envoyer} disabled={etat.enCours || !a.trim() || !sujet.trim()} className="bouton-3d" style={{ marginTop: 10, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
        {etat.enCours ? "Envoi…" : "✉️ Envoyer"}
      </button>
    </div>
  );
}
