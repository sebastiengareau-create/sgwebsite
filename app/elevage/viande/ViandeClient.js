"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { TitreSection } from "../../components/ui";
import { CANAUX, stockLot, argent, kg, dateCourte } from "@/lib/elevageCalculs";
import {
  champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, Onglets, Statistique, NavElevage, Tableau, cellule, celluleDroite, useApi, aujourdhui,
} from "../ui";

const nombre = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")) || 0;

export default function ViandeClient({ coupes, ventes }) {
  const [venteCoupe, setVenteCoupe] = useState(null); // coupe ouverte dans le formulaire de vente

  const stock = coupes.map((c) => {
    const lots = c.lots.map((l) => ({ ...l, stock: stockLot(l) })).filter((l) => l.stock.paquets > 0);
    const paquets = lots.reduce((s, l) => s + l.stock.paquets, 0);
    const poids = lots.reduce((s, l) => s + l.stock.poids, 0);
    return { ...c, lotsEnStock: lots, paquets, poids };
  });
  const enStock = stock.filter((c) => c.paquets > 0);
  const totalPaquets = enStock.reduce((s, c) => s + c.paquets, 0);
  const totalPoids = enStock.reduce((s, c) => s + c.poids, 0);
  const valeurBoutique = enStock.reduce((s, c) => s + c.poids * c.prixBoutique, 0);

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🥩" titre="Viande" sousTitre="Paquets en stock par coupe et ventes en boutique ou en ligne. Chaque paquet vendu reste relié à sa bête." />
      <NavElevage actif="/elevage/viande" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Statistique valeur={totalPaquets} label="Paquets en stock" />
        <Statistique valeur={kg(totalPoids, 0)} label="Poids en stock" />
        <Statistique valeur={argent(valeurBoutique)} label="Valeur au prix boutique" />
      </div>

      {venteCoupe && <FormulaireVente coupe={stock.find((c) => c.id === venteCoupe)} onFin={() => setVenteCoupe(null)} />}

      <div className="carte" style={{ marginBottom: 14 }}>
        <TitreSection>Stock par coupe</TitreSection>
        {enStock.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Aucun paquet en stock. Les paquets entrent en stock à l'abattage d'une bête (sa fiche, dans le <Link href="/elevage" style={{ color: "var(--accent)" }}>troupeau</Link>).
          </p>
        ) : (
          <Tableau entetes={["Coupe", "Paquets", "Poids", "Boutique", "En ligne", "Provenance", ""]} alignDroite={[1, 2, 3, 4]}>
            {enStock.map((c) => (
              <tr key={c.id}>
                <td style={{ ...cellule, fontWeight: 700 }}>{c.nom}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{c.paquets}</td>
                <td style={celluleDroite}>{kg(c.poids)}</td>
                <td style={celluleDroite}>{c.prixBoutique > 0 ? `${argent(c.prixBoutique)}/kg` : "—"}</td>
                <td style={celluleDroite}>{!c.enLigne ? "non offerte" : c.prixEnLigne > 0 ? `${argent(c.prixEnLigne)}/kg` : "—"}</td>
                <td style={{ ...cellule, fontSize: 11.5, color: "var(--text-muted)" }}>
                  {c.lotsEnStock.map((l, i) => (
                    <span key={l.id}>{i > 0 && ", "}<Link href={`/elevage/${l.abattage.bete.id}`} style={{ color: "inherit" }}>{l.abattage.bete.numero}</Link> ({l.stock.paquets})</span>
                  ))}
                </td>
                <td style={cellule}>
                  <button onClick={() => setVenteCoupe(c.id)} className="bouton-3d" style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Vendre</button>
                </td>
              </tr>
            ))}
          </Tableau>
        )}
      </div>

      <Ventes ventes={ventes} />
    </div>
  );
}

function FormulaireVente({ coupe, onFin }) {
  const [champs, setChamps] = useState({ canal: "BOUTIQUE", nbPaquets: "1", poids: "", montant: "", date: aujourdhui(), note: "" });
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  if (!coupe) return null;

  const nb = Math.max(0, Math.floor(nombre(champs.nbPaquets)));
  // Poids proposé : poids moyen des paquets en stock (les plus anciens d'abord)
  const poidsMoyen = coupe.paquets > 0 ? coupe.poids / coupe.paquets : coupe.poidsPaquet;
  const poids = champs.poids.trim() ? nombre(champs.poids) : poidsMoyen * nb;
  const prix = champs.canal === "EN_LIGNE" ? coupe.prixEnLigne : coupe.prixBoutique;
  const montant = champs.montant.trim() ? nombre(champs.montant) : poids * prix;

  async function vendre() {
    if (await appeler("/api/elevage/ventes", "POST", { ...champs, coupeId: coupe.id })) onFin();
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 14, border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Vendre — {coupe.nom}</strong>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{coupe.paquets} en stock</span>
      </div>
      <Onglets options={CANAUX.map((c) => ({ code: c.code, label: `${c.icone} ${c.label}` }))} valeur={champs.canal} onChange={(canal) => setChamps((c) => ({ ...c, canal }))} />
      <div style={grille2}>
        <Champ label="Paquets"><input inputMode="numeric" value={champs.nbPaquets} onChange={maj("nbPaquets")} style={champStyle} /></Champ>
        <Champ label="Poids réel (kg)"><input inputMode="decimal" value={champs.poids} onChange={maj("poids")} placeholder={kg(poidsMoyen * nb, 2)} style={champStyle} /></Champ>
        <Champ label="Montant avant taxes ($)"><input inputMode="decimal" value={champs.montant} onChange={maj("montant")} placeholder={prix > 0 ? argent(poids * prix) : "à entrer"} style={champStyle} /></Champ>
        <Champ label="Date"><input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={champStyle} /></Champ>
      </div>
      <Champ label={champs.canal === "EN_LIGNE" ? "Commande en ligne (numéro, client…)" : "Note (client…)"}>
        <input value={champs.note} onChange={maj("note")} style={champStyle} />
      </Champ>
      {champs.canal === "EN_LIGNE" && !coupe.enLigne && <p style={{ fontSize: 12, color: "#C9A227", margin: "0 0 8px" }}>⚠️ Cette coupe n'est pas offerte en ligne (Coupes et rendements).</p>}
      <Erreur texte={erreur} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={vendre} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : `Vendre ${nb} paquet${nb > 1 ? "s" : ""} — ${argent(montant)}`}</button>
        <button onClick={onFin} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
      </div>
    </div>
  );
}

const PERIODES = [
  { code: "MOIS", label: "Ce mois-ci" },
  { code: "ANNEE", label: "Cette année" },
];

function Ventes({ ventes }) {
  const [periode, setPeriode] = useState("MOIS");
  const { appeler, erreur } = useApi();
  const mois = aujourdhui().slice(0, 7);
  const affichees = ventes.filter((v) => periode === "ANNEE" || dateCourte(v.date).startsWith(mois));
  const parCanal = CANAUX.map((c) => {
    const liste = affichees.filter((v) => v.canal === c.code);
    return { ...c, montant: liste.reduce((s, v) => s + v.montant, 0), paquets: liste.reduce((s, v) => s + v.nbPaquets, 0), poids: liste.reduce((s, v) => s + v.poids, 0) };
  });

  async function annuler(v) {
    if (window.confirm(`Annuler cette vente ? ${v.nbPaquets} paquet${v.nbPaquets > 1 ? "s" : ""} de ${v.lot.coupe.nom} reviennent en stock.`)) await appeler(`/api/elevage/ventes/${v.id}`, "DELETE");
  }

  return (
    <div className="carte" style={{ marginBottom: 20 }}>
      <TitreSection>Ventes</TitreSection>
      <Onglets options={PERIODES} valeur={periode} onChange={setPeriode} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {parCanal.map((c) => (
          <Statistique key={c.code} valeur={argent(c.montant)} label={`${c.icone} ${c.label} — ${c.paquets} paquets, ${kg(c.poids)}`} />
        ))}
      </div>
      <Erreur texte={erreur} />
      {affichees.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune vente pour cette période.</p>
      ) : (
        <Tableau entetes={["Date", "", "Coupe", "Paquets", "Poids", "Montant", "Bête", ""]} alignDroite={[3, 4, 5]}>
          {affichees.map((v) => (
            <tr key={v.id}>
              <td style={cellule}>{dateCourte(v.date)}</td>
              <td style={cellule} title={CANAUX.find((c) => c.code === v.canal)?.label}>{CANAUX.find((c) => c.code === v.canal)?.icone}</td>
              <td style={cellule}>{v.lot.coupe.nom}{v.note && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.note}</div>}</td>
              <td style={celluleDroite}>{v.nbPaquets}</td>
              <td style={celluleDroite}>{kg(v.poids, 2)}</td>
              <td style={celluleDroite}>{argent(v.montant)}</td>
              <td style={cellule}><Link href={`/elevage/${v.lot.abattage.bete.id}`} style={{ color: "var(--accent)" }}>{v.lot.abattage.bete.numero}</Link></td>
              <td style={cellule}><button onClick={() => annuler(v)} style={{ ...boutonLien, color: "var(--danger)" }}>✕</button></td>
            </tr>
          ))}
        </Tableau>
      )}
    </div>
  );
}
