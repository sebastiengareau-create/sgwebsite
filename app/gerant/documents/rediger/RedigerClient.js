"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DESTINATAIRES, remplirModele, passagesACompleter, sujetParDefaut } from "@/lib/documents";
import { image } from "@/lib/client";
import { correspondRecherche } from "@/lib/recherche";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../../../components/StyleSection";

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
  const resultats = terme ? personnes.filter((p) => correspondRecherche(terme, p.nom) || p.telephone?.includes(terme)).slice(0, 8) : [];

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
        <div style={{ marginTop: 8 }}>
          <BandeauSection icone="✍️" titre={modele.nom} sousTitre={`Lettre pour un ${libelle} — remplie avec sa fiche, à imprimer ou à envoyer par courriel.`} />
        </div>

        <div style={stylePanneau}>
          <TitrePanneau
            icone="personne" teinte={TEINTES.bleu} titre={choisi ? choisi.nom : `Choisis le ${libelle}`}
            sousTitre={choisi ? `${DESTINATAIRES[modele.destinataire].libelle}${choisi.courriel ? ` · ${choisi.courriel}` : ""}` : "La lettre se remplit avec sa fiche."}
            droite={choisi && choisi.desabonne && modele.destinataire === "CLIENT" ? <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Désabonné</Pastille> : undefined}
          />
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 19, transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
              <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
            </span>
            <input
              type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ"
              placeholder={choisi ? `Changer de ${libelle}…` : `Rechercher un ${libelle} par nom${modele.destinataire === "CLIENT" ? " ou téléphone" : ""}…`}
              style={{ paddingLeft: 40, marginBottom: 0 }}
            />
          </div>
          {resultats.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {resultats.map((p, i) => (
                <button key={p.id} onClick={() => choisir(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "9px 4px", border: "none", borderTop: i === 0 ? "none" : "1px solid var(--border)", background: "none", color: "var(--text)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: TEINTES.bleu.fond, color: TEINTES.bleu.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{p.nom.charAt(0).toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{p.nom}</strong>
                    {p.telephone && <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}> · {p.telephone}</span>}
                    {p.actif === false && <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}> · inactif</span>}
                  </span>
                  <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
                </button>
              ))}
            </div>
          )}
          {terme && resultats.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0" }}>Aucun {libelle} ne correspond.</p>}
        </div>

        {choisi && (
          <div style={stylePanneau}>
            <TitrePanneau icone="document" teinte={TEINTES.ambre} titre="Texte de la lettre" sousTitre="Modifiable avant d'imprimer — le modèle, lui, ne change pas." />
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} className="champ" rows={16} style={{ fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", marginBottom: 0 }} />
            {aCompleter.length > 0 && (
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--avertissement)", margin: "10px 0 0", padding: "8px 12px", borderRadius: 12, background: "var(--avertissement-fond)" }}>
                ⚠️ À compléter avant d'imprimer : {aCompleter.join(" · ")}
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <BoutonAction icone="imprimante" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={() => window.print()}>Imprimer / PDF</BoutonAction>
              <BoutonAction icone="echange" onClick={() => setTexte(remplirModele(modele.contenu, valeurs, modele.destinataire))}>Recommencer</BoutonAction>
            </div>
            <EnvoiCourriel modele={modele} choisi={choisi} texte={texte} aCompleter={aCompleter} courrielConfigure={courrielConfigure} />
          </div>
        )}
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

  if (!courrielConfigure) return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>L'envoi par courriel n'est pas configuré sur cette installation.</p>;
  if (choisi.desabonne && modele.destinataire === "CLIENT") return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>Ce client s'est désabonné de nos courriels — impression seulement.</p>;

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
      <BoutonAction icone="courriel" couleur="var(--bleu)" bordure="var(--bleu)" onClick={() => setOuvert(true)} style={{ width: "100%", marginTop: 8 }}>Envoyer par courriel</BoutonAction>
    );
  }
  return (
    <div style={{ marginTop: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, marginBottom: 8 }}><Icone nom="courriel" taille={18} couleur="var(--bleu)" /> Envoyer par courriel</div>
      <label className="etiquette" style={{ marginTop: 0 }}>Courriel du destinataire</label>
      <input type="email" value={a} onChange={(e) => setA(e.target.value)} className="champ" placeholder="adresse@exemple.com" />
      <label className="etiquette">Sujet</label>
      <input value={sujet} onChange={(e) => setSujet(e.target.value)} className="champ" />
      {modele.destinataire === "CLIENT" && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>Vos coordonnées et un lien de désabonnement sont ajoutés au bas du courriel (exigé par la loi anti-pourriel).</p>
      )}
      {etat.erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, margin: "8px 0 0" }}>{etat.erreur}</p>}
      {etat.message && <p style={{ color: "var(--success)", fontSize: 13, fontWeight: 700, margin: "8px 0 0" }}>{etat.message}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <BoutonAction icone="courriel" couleur="#fff" fond="var(--bleu)" bordure="var(--bleu)" onClick={envoyer} disabled={etat.enCours || !a.trim() || !sujet.trim()}>{etat.enCours ? "Envoi…" : "Envoyer"}</BoutonAction>
        <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setOuvert(false)}>Annuler</BoutonAction>
      </div>
    </div>
  );
}
