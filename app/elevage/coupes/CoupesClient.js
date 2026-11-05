"use client";

import { useState } from "react";
import BandeauSection from "../../components/BandeauSection";
import { TitreSection } from "../../components/ui";
import { estimerDecoupe, totauxDecoupe, carcasseDepuisVif, argent, kg } from "@/lib/elevageCalculs";
import {
  champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, Onglets, NavElevage, Tableau, TableEstimation, cellule, useApi,
} from "../ui";

const nombre = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")) || 0;
const texte = (n) => String(n ?? "").replace(".", ",");

export default function CoupesClient({ coupes, rendementCarcasse }) {
  const actives = coupes.filter((c) => c.actif);
  const totalRendement = actives.reduce((s, c) => s + c.rendement, 0);
  return (
    <div className="conteneur-page">
      <BandeauSection icone="📐" titre="Coupes et rendements" sousTitre="Ce que donne une carcasse : la part de chaque coupe, le poids d'un paquet et son prix au kg selon le canal de vente." />
      <NavElevage actif="/elevage/coupes" />
      <Simulateur coupes={actives} rendementCarcasse={rendementCarcasse} />
      <div className="carte" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <TitreSection>Coupes</TitreSection>
          <span style={{ fontSize: 12, color: totalRendement > 100 ? "var(--danger)" : "var(--text-muted)" }}>
            {texte(Math.round(totalRendement * 10) / 10)} % de la carcasse en paquets · {texte(Math.round((100 - totalRendement) * 10) / 10)} % os, gras et pertes
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Rendement = % du poids de carcasse froide. Prix en $/kg avant taxes ; le prix d'un paquet = son poids × le prix au kg du canal.
        </p>
        <Tableau entetes={["Coupe", "Rendement %", "Paquet (kg)", "Boutique $/kg", "En ligne $/kg", "En ligne", "Active", ""]}>
          {coupes.map((c) => <LigneCoupe key={c.id} coupe={c} />)}
        </Tableau>
        <NouvelleCoupe />
      </div>
    </div>
  );
}

function LigneCoupe({ coupe }) {
  const initial = { nom: coupe.nom, rendement: texte(coupe.rendement), poidsPaquet: texte(coupe.poidsPaquet), prixBoutique: texte(coupe.prixBoutique), prixEnLigne: texte(coupe.prixEnLigne) };
  const [champs, setChamps] = useState(initial);
  const { appeler, enCours, erreur } = useApi();
  const modifie = Object.keys(initial).some((k) => champs[k] !== initial[k]);
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const petit = (largeur) => ({ ...champStyle, marginBottom: 0, width: largeur, padding: "6px 8px" });

  async function supprimer() {
    if (window.confirm(`Supprimer la coupe « ${coupe.nom} » ?`)) await appeler(`/api/elevage/coupes/${coupe.id}`, "DELETE");
  }

  return (
    <tr style={{ opacity: coupe.actif ? 1 : 0.55 }}>
      <td style={cellule}>
        <input value={champs.nom} onChange={maj("nom")} style={petit(170)} />
        <Erreur texte={erreur} />
      </td>
      <td style={cellule}><input inputMode="decimal" value={champs.rendement} onChange={maj("rendement")} style={petit(64)} /></td>
      <td style={cellule}><input inputMode="decimal" value={champs.poidsPaquet} onChange={maj("poidsPaquet")} style={petit(64)} /></td>
      <td style={cellule}><input inputMode="decimal" value={champs.prixBoutique} onChange={maj("prixBoutique")} style={petit(74)} /></td>
      <td style={cellule}><input inputMode="decimal" value={champs.prixEnLigne} onChange={maj("prixEnLigne")} style={petit(74)} disabled={!coupe.enLigne} /></td>
      <td style={{ ...cellule, textAlign: "center" }}><input type="checkbox" checked={coupe.enLigne} onChange={(e) => appeler(`/api/elevage/coupes/${coupe.id}`, "PATCH", { enLigne: e.target.checked })} /></td>
      <td style={{ ...cellule, textAlign: "center" }}><input type="checkbox" checked={coupe.actif} onChange={(e) => appeler(`/api/elevage/coupes/${coupe.id}`, "PATCH", { actif: e.target.checked })} /></td>
      <td style={{ ...cellule, whiteSpace: "nowrap" }}>
        {modifie ? (
          <>
            <button onClick={() => appeler(`/api/elevage/coupes/${coupe.id}`, "PATCH", champs)} disabled={enCours} style={{ ...boutonLien, color: "var(--accent)", fontWeight: 700 }}>Enregistrer</button>{" "}
            <button onClick={() => setChamps(initial)} style={{ ...boutonLien, color: "var(--text-muted)" }}>↺</button>
          </>
        ) : (
          coupe._count.lots === 0 && <button onClick={supprimer} style={{ ...boutonLien, color: "var(--danger)" }}>✕</button>
        )}
      </td>
    </tr>
  );
}

function NouvelleCoupe() {
  const vide = { nom: "", rendement: "", poidsPaquet: "", prixBoutique: "", prixEnLigne: "" };
  const [champs, setChamps] = useState(null);
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));

  if (!champs) return <button onClick={() => setChamps(vide)} style={{ ...boutonLien, color: "var(--accent)", marginTop: 10, fontWeight: 700 }}>+ Nouvelle coupe</button>;
  return (
    <div className="carte carte-m" style={{ marginTop: 12 }}>
      <div style={grille2}>
        <Champ label="Nom"><input value={champs.nom} onChange={maj("nom")} style={champStyle} /></Champ>
        <Champ label="Rendement (% de la carcasse)"><input inputMode="decimal" value={champs.rendement} onChange={maj("rendement")} style={champStyle} /></Champ>
        <Champ label="Poids d'un paquet (kg)"><input inputMode="decimal" value={champs.poidsPaquet} onChange={maj("poidsPaquet")} style={champStyle} /></Champ>
        <Champ label="Prix boutique ($/kg)"><input inputMode="decimal" value={champs.prixBoutique} onChange={maj("prixBoutique")} style={champStyle} /></Champ>
        <Champ label="Prix en ligne ($/kg)"><input inputMode="decimal" value={champs.prixEnLigne} onChange={maj("prixEnLigne")} style={champStyle} /></Champ>
      </div>
      <Erreur texte={erreur} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={async () => (await appeler("/api/elevage/coupes", "POST", champs)) && setChamps(null)} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>Ajouter la coupe</button>
        <button onClick={() => setChamps(null)} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
      </div>
    </div>
  );
}

// « Un bœuf de X kg donne… » : poids vif (× rendement carcasse) ou poids de
// carcasse → paquets de chaque coupe
function Simulateur({ coupes, rendementCarcasse }) {
  const [base, setBase] = useState("VIF");
  const [poids, setPoids] = useState("750");
  const [rendement, setRendement] = useState(texte(rendementCarcasse));
  const { appeler, enCours, erreur } = useApi();
  const carcasse = base === "VIF" ? carcasseDepuisVif(nombre(poids), nombre(rendement)) : nombre(poids);
  const lignes = estimerDecoupe(carcasse, coupes);
  const totaux = totauxDecoupe(lignes);
  const valeurEnLigne = lignes.reduce((s, l) => s + l.valeurEnLigne, 0);

  return (
    <div className="carte" style={{ marginBottom: 14 }}>
      <TitreSection>Simulateur — ce que donne une bête</TitreSection>
      <Onglets options={[{ code: "VIF", label: "Poids vif" }, { code: "CARCASSE", label: "Poids de carcasse" }]} valeur={base} onChange={setBase} />
      <div style={grille2}>
        <Champ label={base === "VIF" ? "Poids vif (kg)" : "Carcasse froide (kg)"}>
          <input inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} style={champStyle} />
        </Champ>
        {base === "VIF" && (
          <Champ label="Rendement carcasse (%)">
            <div style={{ display: "flex", gap: 6 }}>
              <input inputMode="decimal" value={rendement} onChange={(e) => setRendement(e.target.value)} style={champStyle} />
              {nombre(rendement) !== rendementCarcasse && (
                <button onClick={() => appeler("/api/elevage/parametres", "PATCH", { rendementCarcasse: rendement })} disabled={enCours} style={{ ...boutonLien, color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", marginBottom: 8 }} title="Sert à estimer la découpe des bêtes du troupeau">
                  Garder par défaut
                </button>
              )}
            </div>
          </Champ>
        )}
      </div>
      <Erreur texte={erreur} />
      {base === "VIF" && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 8px" }}>Carcasse froide estimée : <strong style={{ color: "var(--text)" }}>{kg(carcasse, 0)}</strong></p>}
      <TableEstimation lignes={lignes} />
      <p style={{ fontSize: 13, margin: "10px 0 0" }}>
        <strong>{totaux.paquets} paquets</strong> · {kg(totaux.poidsPaquets)} de viande
        {totaux.valeurBoutique > 0 && <> · {argent(totaux.valeurBoutique)} en boutique</>}
        {valeurEnLigne > 0 && <> · {argent(valeurEnLigne)} en ligne (coupes offertes)</>}
      </p>
    </div>
  );
}
