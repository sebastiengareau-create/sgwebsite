"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../components/ChampsAdresse";
import SelectProvince from "../../../components/SelectProvince";
import { PROVINCE_DEFAUT } from "@/lib/adresse";
import { formaterTelephone } from "@/lib/telephone";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

export default function InfosEntrepriseClient({ infosInit, modeleConditions }) {
  const router = useRouter();
  const [nomEntreprise, setNomEntreprise] = useState(infosInit.nomEntreprise);
  const [adresseLigne1, setAdresseLigne1] = useState(infosInit.adresseLigne1);
  const [ville, setVille] = useState(infosInit.ville);
  const [province, setProvince] = useState(infosInit.province || PROVINCE_DEFAUT);
  const [codePostal, setCodePostal] = useState(infosInit.codePostal);
  const [telephone, setTelephone] = useState(infosInit.telephone);
  const [courriel, setCourriel] = useState(infosInit.courriel);
  const [personneResponsable, setPersonneResponsable] = useState(infosInit.personneResponsable);
  const [numeroEmployeurArc, setNumeroEmployeurArc] = useState(infosInit.numeroEmployeurArc);
  const [numeroEmployeurRq, setNumeroEmployeurRq] = useState(infosInit.numeroEmployeurRq);
  const [conditionsGenerales, setConditionsGenerales] = useState(infosInit.conditionsGenerales);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const remplir = remplisseurAdresse({ ville, setAdresse: setAdresseLigne1, setVille, setProvince, setCodePostal });

  async function sauvegarder(e) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/administrateur/entreprise", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomEntreprise, adresseLigne1, ville, province, codePostal, telephone, courriel, personneResponsable, conditionsGenerales,
        numeroEmployeurArc: numeroEmployeurArc.replace(/\s+/g, "").toUpperCase(), numeroEmployeurRq: numeroEmployeurRq.replace(/\s+/g, "").toUpperCase(),
        // Ligne affichée sur les documents (voir lib/config.js)
        adresseLigne2: [ville.trim(), province].filter(Boolean).join(", "),
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "erreur", texte: data.erreur || "Erreur." });
      return;
    }
    setMessage({ type: "succes", texte: "Informations sauvegardées ✓" });
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/administrateur" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Administrateur</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🏢" titre="Informations de l'entreprise" sousTitre="Elles apparaissent partout — factures, courriels, documents imprimés. À changer ici pour un nouveau garage, sans toucher au code." />
      </div>

      <form onSubmit={sauvegarder}>
        <div style={stylePanneau}>
        <TitrePanneau icone="immeuble" teinte={TEINTES.ambre} titre="Coordonnées" sousTitre="Nom, adresse et moyens de joindre l'entreprise" />
        <label style={{ ...labelStyle, marginTop: 0 }}>Nom de l'entreprise</label>
        <input required value={nomEntreprise} onChange={(e) => setNomEntreprise(e.target.value)} style={champStyle} />

        <label style={labelStyle}>Adresse</label>
        <ChampAdresse valeur={adresseLigne1} onChange={setAdresseLigne1} onChoisir={remplir.onChoisir} placeholder="Ex : 880 Rang Ste Philomène" style={champStyle} />

        <label style={labelStyle}>Ville</label>
        <ChampVille valeur={ville} onChange={setVille} codePostal={codePostal} placeholder="Ex : Sainte-Geneviève-de-Berthier" style={champStyle} />

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Province</label>
            <SelectProvince valeur={province} onChange={setProvince} style={champStyle} />
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>Code postal</label>
            <ChampCodePostal valeur={codePostal} onChange={setCodePostal} onSecteur={remplir.onSecteur} placeholder="J0K 0E8" style={champStyle} />
          </div>
        </div>

        <label style={labelStyle}>Téléphone</label>
        <input value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} placeholder="Ex : 438-526-8936" style={champStyle} />

        <label style={labelStyle}>Courriel (optionnel — affiché sur certains documents)</label>
        <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="Ex : info@garage.com" style={champStyle} />

        </div>

        <div style={stylePanneau}>
        <TitrePanneau icone="document" teinte={TEINTES.bleu} titre="Signature et numéros d'employeur" sousTitre="Lettres de la section Documents, feuillets T4 et RL-1" />
        <label style={{ ...labelStyle, marginTop: 0 }}>Personne responsable (signe les lettres de la section Documents)</label>
        <input value={personneResponsable} onChange={(e) => setPersonneResponsable(e.target.value)} placeholder="Ex : Marc Tremblay, propriétaire" style={champStyle} />

        <label style={labelStyle}>Numéro d'employeur ARC — compte de retenues sur la paie (pour les T4)</label>
        <input value={numeroEmployeurArc} onChange={(e) => setNumeroEmployeurArc(e.target.value)} placeholder="Ex : 123456789RP0001" style={champStyle} />

        <label style={labelStyle}>Numéro d'identification Revenu Québec — dossier RS (pour les RL-1)</label>
        <input value={numeroEmployeurRq} onChange={(e) => setNumeroEmployeurRq(e.target.value)} placeholder="Ex : 1234567890RS0001" style={champStyle} />

        </div>

        <div style={stylePanneau}>
        <TitrePanneau
          icone="presse" teinte={TEINTES.neutre} titre="Conditions générales"
          sousTitre="En petits caractères au bas de la soumission, du bon de travail et de la facture (vide = rien)"
        />
        {!conditionsGenerales.trim() && (
          <button type="button" onClick={() => setConditionsGenerales(modeleConditions)} style={{ display: "block", width: "100%", marginBottom: 10, fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--accent)", background: "rgba(232,163,61,0.12)", color: "var(--text)", cursor: "pointer" }}>
            Insérer le texte suggéré
          </button>
        )}
        <textarea value={conditionsGenerales} onChange={(e) => setConditionsGenerales(e.target.value)} rows={10} placeholder="Ex : CONDITIONS GÉNÉRALES — 1. Garantie. …" style={{ ...champStyle, fontSize: 13, lineHeight: 1.45, resize: "vertical", marginBottom: 4, fontFamily: "inherit" }} />
        {/\[[^\]]*\]/.test(conditionsGenerales) && (
          <p style={{ fontSize: 12.5, color: "var(--avertissement)", background: "var(--avertissement-fond)", borderRadius: 10, padding: "8px 10px", margin: "6px 0 0" }}>⚠ Le texte contient encore des crochets [ ] à compléter (délais, montants).</p>
        )}
        </div>

        {message && (
          <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px", color: message.type === "succes" ? "var(--success)" : "var(--danger)" }}>{message.texte}</p>
        )}

        <button
          type="submit" disabled={enCours}
          style={{
            position: "sticky", bottom: 12, zIndex: 5, width: "100%", marginBottom: 24, padding: 13, borderRadius: 12, border: "none",
            background: "var(--accent)", color: "#221f18", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          }}
        >
          {enCours ? "Enregistrement…" : "Sauvegarder"}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4, marginTop: 12 };
const champStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
};
