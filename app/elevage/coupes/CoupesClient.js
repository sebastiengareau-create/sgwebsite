"use client";

import { useState } from "react";
import BandeauSection from "../../components/BandeauSection";
import { TitreSection } from "../../components/ui";
import { estimerDecoupe, totauxDecoupe, carcasseDepuisVif, argent, kg } from "@/lib/elevageCalculs";
import {
  champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, Onglets, NavElevage, TableEstimation, useApi, Statistique, DeuxColonnes,
} from "../ui";

const nombre = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")) || 0;
const texte = (n) => String(n ?? "").replace(".", ",");

export default function CoupesClient({ coupes, rendementCarcasse, gmqCible, poidsAbattage }) {
  const actives = coupes.filter((c) => c.actif);
  const totalRendement = actives.reduce((s, c) => s + c.rendement, 0);
  const sansPrix = actives.filter((c) => !c.prixBoutique).length;
  // Ce que rapporte 1 kg de carcasse une fois découpé et vendu en boutique
  const valeurKg = totauxDecoupe(estimerDecoupe(1000, actives)).valeurBoutique / 1000;
  return (
    <div className="conteneur-page" style={{ maxWidth: 1100 }}>
      <BandeauSection icone="📐" titre="Coupes et rendements" sousTitre="Ce que donne une carcasse : la part de chaque coupe, le poids d'un paquet et son prix au kg selon le canal de vente." />
      <NavElevage actif="/elevage/coupes" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Statistique valeur={actives.length} label="Coupes actives" teinte="var(--bleu)" note={coupes.length > actives.length ? `${coupes.length - actives.length} désactivée${coupes.length - actives.length > 1 ? "s" : ""}` : `${actives.filter((c) => c.enLigne).length} offertes en ligne`} />
        <Statistique valeur={`${texte(Math.round(totalRendement * 10) / 10)} %`} label="De la carcasse en paquets" teinte={totalRendement > 100 ? "var(--danger)" : "var(--accent)"} couleur={totalRendement > 100 ? "var(--danger)" : undefined} note={totalRendement > 100 ? "plus de 100 % : rendements à corriger" : `${texte(Math.round((100 - totalRendement) * 10) / 10)} % en os, gras et pertes`} />
        <Statistique valeur={sansPrix} label={`Coupe${sansPrix > 1 ? "s" : ""} sans prix`} teinte={sansPrix > 0 ? "var(--avertissement)" : "var(--success)"} note={sansPrix > 0 ? "prix boutique à fixer" : "tous les prix sont fixés"} />
        <Statistique valeur={valeurKg > 0 ? `${argent(valeurKg)}` : "—"} label="Valeur par kg de carcasse" teinte="var(--success)" note="au prix boutique, selon les rendements" />
      </div>

      <div className="carte" style={{ marginBottom: 14 }}>
        <TitreSection>Coupes</TitreSection>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Rendement = % du poids de carcasse froide. Prix en $/kg avant taxes ; le prix d'un paquet = son poids × le prix au kg du canal.
        </p>
        {/* Rangées en grille (.reglage-coupe, app/globals.css) : colonnes sur un écran large, carte sur un téléphone */}
        <div className="reglage-coupe entete">
          <span style={{ gridArea: "nom" }}>Coupe</span><span style={{ gridArea: "rend" }}>Rendement %</span><span style={{ gridArea: "paquet" }}>Paquet (kg)</span>
          <span style={{ gridArea: "boutique" }}>Boutique $/kg</span><span style={{ gridArea: "enligne" }}>En ligne $/kg</span>
          <span className="centre" style={{ gridArea: "offerte" }}>En ligne</span><span className="centre" style={{ gridArea: "active" }}>Active</span><span style={{ gridArea: "action" }} />
        </div>
        {coupes.map((c) => <LigneCoupe key={c.id} coupe={c} />)}
        <NouvelleCoupe />
      </div>

      <DeuxColonnes>
        <Simulateur coupes={actives} rendementCarcasse={rendementCarcasse} />
        <CibleCroissance gmqCible={gmqCible} poidsAbattage={poidsAbattage} />
      </DeuxColonnes>
    </div>
  );
}

function LigneCoupe({ coupe }) {
  const initial = { nom: coupe.nom, rendement: texte(coupe.rendement), poidsPaquet: texte(coupe.poidsPaquet), prixBoutique: texte(coupe.prixBoutique), prixEnLigne: texte(coupe.prixEnLigne) };
  const [champs, setChamps] = useState(initial);
  const { appeler, enCours, erreur } = useApi();
  const modifie = Object.keys(initial).some((k) => champs[k] !== initial[k]);
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const champ = { ...champStyle, marginBottom: 0, width: "100%", padding: "7px 9px" };
  const prixPaquet = (prix) => (nombre(prix) > 0 && nombre(champs.poidsPaquet) > 0 ? `${argent(nombre(prix) * nombre(champs.poidsPaquet))} le paquet` : null);
  const note = { fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 };

  async function supprimer() {
    if (window.confirm(`Supprimer la coupe « ${coupe.nom} » ?`)) await appeler(`/api/elevage/coupes/${coupe.id}`, "DELETE");
  }

  return (
    <div className="reglage-coupe" style={{ opacity: coupe.actif ? 1 : 0.55 }}>
      <label style={{ gridArea: "nom" }}>
        <span className="etiquette">Coupe</span>
        <input value={champs.nom} onChange={maj("nom")} aria-label="Nom de la coupe" style={{ ...champ, fontWeight: 700 }} />
        <Erreur texte={erreur} />
      </label>
      <label style={{ gridArea: "rend" }}>
        <span className="etiquette">Rendement %</span>
        <input inputMode="decimal" value={champs.rendement} onChange={maj("rendement")} aria-label="Rendement en % de la carcasse" style={champ} />
      </label>
      <label style={{ gridArea: "paquet" }}>
        <span className="etiquette">Paquet (kg)</span>
        <input inputMode="decimal" value={champs.poidsPaquet} onChange={maj("poidsPaquet")} aria-label="Poids d'un paquet en kg" style={champ} />
      </label>
      <label style={{ gridArea: "boutique" }}>
        <span className="etiquette">Boutique $/kg</span>
        <input inputMode="decimal" value={champs.prixBoutique} onChange={maj("prixBoutique")} aria-label="Prix en boutique au kg" style={champ} />
        {prixPaquet(champs.prixBoutique) && <div style={note}>{prixPaquet(champs.prixBoutique)}</div>}
      </label>
      <label style={{ gridArea: "enligne" }}>
        <span className="etiquette">En ligne $/kg</span>
        <input inputMode="decimal" value={champs.prixEnLigne} onChange={maj("prixEnLigne")} aria-label="Prix en ligne au kg" style={champ} disabled={!coupe.enLigne} />
        {coupe.enLigne && prixPaquet(champs.prixEnLigne) && <div style={note}>{prixPaquet(champs.prixEnLigne)}</div>}
      </label>
      <label className="case" style={{ gridArea: "offerte" }}>
        <input type="checkbox" checked={coupe.enLigne} aria-label="Offerte en ligne" onChange={(e) => appeler(`/api/elevage/coupes/${coupe.id}`, "PATCH", { enLigne: e.target.checked })} />
        <span>Offerte en ligne</span>
      </label>
      <label className="case" style={{ gridArea: "active" }}>
        <input type="checkbox" checked={coupe.actif} aria-label="Coupe active" onChange={(e) => appeler(`/api/elevage/coupes/${coupe.id}`, "PATCH", { actif: e.target.checked })} />
        <span>Active</span>
      </label>
      <div style={{ gridArea: "action", whiteSpace: "nowrap", paddingTop: 6, textAlign: "right" }}>
        {modifie ? (
          <>
            <button onClick={() => appeler(`/api/elevage/coupes/${coupe.id}`, "PATCH", champs)} disabled={enCours} style={{ ...boutonLien, color: "var(--accent-ombre)", fontWeight: 700, fontSize: 13 }}>Enregistrer</button>{" "}
            <button onClick={() => setChamps(initial)} title="Annuler les changements" aria-label="Annuler les changements" style={{ ...boutonLien, color: "var(--text-muted)", fontSize: 14, padding: "0 4px" }}>↺</button>
          </>
        ) : (
          coupe._count.lots === 0 && <button onClick={supprimer} title="Supprimer la coupe" aria-label={`Supprimer la coupe ${coupe.nom}`} style={{ ...boutonLien, color: "var(--danger)", fontSize: 13, padding: "0 4px" }}>✕</button>
        )}
      </div>
    </div>
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

// Gain moyen quotidien visé : une bête en croissance (bouvillon, ou jeune de
// moins de 24 mois) dont le gain récent est dessous est signalée au troupeau
function CibleCroissance({ gmqCible, poidsAbattage }) {
  const [cible, setCible] = useState(texte(gmqCible));
  const [poids, setPoids] = useState(texte(poidsAbattage));
  const { appeler, enCours, erreur } = useApi();
  return (
    <div className="carte" style={{ marginBottom: 14 }}>
      <TitreSection>Croissance — gain et poids visés</TitreSection>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Les bouvillons et les jeunes de moins de 24 mois dont le gain récent (entre leurs dernières pesées) est sous cette cible sont signalés dans le troupeau.
      </p>
      <Champ label="Gain moyen quotidien visé (kg/jour)">
        <div style={{ display: "flex", gap: 6, maxWidth: 260 }}>
          <input inputMode="decimal" value={cible} onChange={(e) => setCible(e.target.value)} style={champStyle} />
          {nombre(cible) !== gmqCible && (
            <button onClick={() => appeler("/api/elevage/parametres", "PATCH", { gmqCible: cible })} disabled={enCours} style={{ ...boutonLien, color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", marginBottom: 8 }}>Enregistrer</button>
          )}
        </div>
      </Champ>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 8px" }}>
        Le poids visé sert à prévoir, dans le troupeau, la date où chaque bouvillon sera prêt pour l'abattage au rythme de son gain.
      </p>
      <Champ label="Poids vif visé à l'abattage (kg)">
        <div style={{ display: "flex", gap: 6, maxWidth: 260 }}>
          <input inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} style={champStyle} />
          {nombre(poids) !== poidsAbattage && (
            <button onClick={() => appeler("/api/elevage/parametres", "PATCH", { poidsAbattage: poids })} disabled={enCours} style={{ ...boutonLien, color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", marginBottom: 8 }}>Enregistrer</button>
          )}
        </div>
      </Champ>
      <Erreur texte={erreur} />
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
