"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../components/BandeauSection";
import { correspondRecherche } from "@/lib/recherche";
import { nombre } from "@/lib/format";
import { Icone, BoutonPlein, Pastille } from "../components/StyleSection";
import {
  SEXES, GENETIQUES, STATUTS_BETE, libelle, age, dernierePesee, gainMoyenQuotidien, coutBete, revenusBete,
  carcasseDepuisVif, argent, kg, dateLisible, TYPES_SOIN, retraitEnCours, rappelsAFaire, joursAvant, velagePrevu, saillieEnCours, sousLaCible, nomBete,
} from "@/lib/elevageCalculs";
import ScanElevage from "./ScanElevage";
import { formaterBoucle, emplacement } from "@/lib/registreElevage";
import { champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, Onglets, Statistique, NavElevage, useApi } from "./ui";

const FILTRES = [
  { code: "ACTIVE", label: "Au troupeau" },
  { code: "ABATTUE", label: "Abattues" },
  { code: "SORTIES", label: "Vendues / mortes" },
  { code: "TOUTES", label: "Toutes" },
];

export default function TroupeauClient({ betes, rendementCarcasse, gmqCible }) {
  const router = useRouter();
  const [filtre, setFiltre] = useState("ACTIVE");
  const [recherche, setRecherche] = useState("");
  const [formulaire, setFormulaire] = useState(false);

  const q = recherche.trim().toLowerCase();
  const affichees = betes.filter((b) => {
    if (filtre === "SORTIES" ? !["VENDUE", "MORTE"].includes(b.statut) : filtre !== "TOUTES" && b.statut !== filtre) return false;
    return !q || correspondRecherche(q, b.numero, b.nom, b.identifiant, formaterBoucle(b.identifiant), b.mere?.numero, b.mere?.nom, emplacement(b.deplacements)?.lieu);
  });

  const actives = betes.filter((b) => b.statut === "ACTIVE");
  const poidsVif = actives.reduce((s, b) => s + (dernierePesee(b.pesees)?.poids || 0), 0);
  const investi = actives.reduce((s, b) => s + coutBete(b), 0);
  const femelles = betes.filter((b) => b.sexe === "FEMELLE" && b.statut === "ACTIVE");
  const taureaux = betes.filter((b) => b.sexe === "TAUREAU");

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🐂" titre="Élevage" sousTitre="Le troupeau de la naissance à la table : pesées, coûts, abattage, découpe et vente de la viande." />
      <NavElevage actif="/elevage" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>
          {formulaire ? "Annuler" : "Nouvelle bête"}
        </BoutonPlein>
        <ScanElevage />
      </div>
      {formulaire && <NouvelleBete femelles={femelles} taureaux={taureaux} onCree={(id) => router.push(`/elevage/${id}`)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Statistique valeur={actives.length} label="Bêtes au troupeau" teinte="var(--success)" />
        <Statistique valeur={kg(poidsVif, 0)} label="Poids vif (dernières pesées)" teinte="var(--bleu)" />
        <Statistique valeur={kg(carcasseDepuisVif(poidsVif, rendementCarcasse), 0)} label={`Carcasse estimée (${rendementCarcasse} %)`} teinte="var(--accent)" />
        <Statistique valeur={argent(investi)} label="Coût investi au troupeau" teinte="var(--danger)" />
      </div>

      <ASuivre betes={actives} gmqCible={gmqCible} />

      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
        </span>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, nom, boucle, mère, enclos…" style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12, background: "var(--surface)" }} />
      </div>
      <Onglets options={FILTRES} valeur={filtre} onChange={setFiltre} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((b) => <CarteBete key={b.id} bete={b} gmqCible={gmqCible} />)}
        {affichees.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune bête dans cette liste.</p>}
      </div>
    </div>
  );
}

function CarteBete({ bete: b, gmqCible }) {
  const statut = STATUTS_BETE.find((s) => s.code === b.statut);
  const pesee = dernierePesee(b.pesees);
  const gmq = gainMoyenQuotidien(b.pesees);
  const cout = coutBete(b);
  const revenus = revenusBete(b);
  const retrait = b.statut === "ACTIVE" ? retraitEnCours(b.soins) : null;
  const lente = sousLaCible(b, gmqCible);
  const ou = emplacement(b.deplacements);
  const gestation = b.statut === "ACTIVE" ? (b.saillies || []).find(saillieEnCours) : null;
  return (
    <Link href={`/elevage/${b.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: statut?.couleur || "var(--border)" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{b.numero}{b.nom && <span style={{ fontWeight: 600 }}> — {b.nom}</span>}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {libelle(SEXES, b.sexe).split(" (")[0]}
            {b.genetique && ` · ${libelle(GENETIQUES, b.genetique).split(" (")[0]}`}
            {b.pourcentageWagyu != null && ` ${b.pourcentageWagyu} %`}
            {b.dateNaissance && ` · ${age(b.dateNaissance, b.dateSortie || new Date())}`}
            {b.identifiant && ` · 🏷️ ${formaterBoucle(b.identifiant)}`}
            {ou && b.statut === "ACTIVE" && ` · 📍 ${ou.horsFerme ? "hors ferme — " : ""}${ou.lieu}`}
            {b.mere && ` · mère ${b.mere.numero}${b.mere.nom ? ` (${b.mere.nom})` : ""}`}
          </div>
          {statut && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Pastille couleur={statut.couleur} fond={`${statut.couleur}22`}>{statut.label}</Pastille>
              {retrait && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">En retrait jusqu'au {dateLisible(retrait.fin)}</Pastille>}
              {gestation && <Pastille couleur="var(--bleu)" fond="var(--bleu-fond)">Vêlage prévu le {dateLisible(velagePrevu(gestation.date))}</Pastille>}
              {lente && <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">Croissance sous la cible</Pastille>}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12.5 }}>
          {b.abattage ? (
            <div style={{ fontSize: 15, fontWeight: 800 }}>{kg(b.abattage.poidsCarcasse, 0)}<span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>carcasse{b.abattage.bms && ` · BMS ${b.abattage.bms}`}</span></div>
          ) : (
            pesee && <div style={{ fontSize: 15, fontWeight: 800 }}>{kg(pesee.poids, 0)}<span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>le {dateLisible(pesee.date)}</span></div>
          )}
          {gmq != null && !b.abattage && <div style={{ color: "var(--text-muted)" }}>{nombre(gmq)} kg/jour</div>}
          <div style={{ color: "var(--text-muted)" }}>Coût {argent(cout)}</div>
          {revenus > 0 && <div style={{ fontWeight: 700, color: revenus - cout >= 0 ? "var(--success)" : "var(--danger)" }}>Ventes {argent(revenus)}</div>}
        </div>
      </div>
    </Link>
  );
}

// À suivre au troupeau : rappels de soins en retard ou dus d'ici 30 jours,
// délais de retrait en cours, vêlages attendus, et bêtes en croissance dont
// le gain récent est sous la cible
const HORIZON_RAPPELS = 30;

function ASuivre({ betes, gmqCible }) {
  const lignes = [
    ...betes.flatMap((b) => rappelsAFaire(b.soins).map((s) => ({ ...s, jours: joursAvant(s.rappelLe) })).filter((r) => r.jours <= HORIZON_RAPPELS).map((r) => ({
      cle: `rappel-${r.id}`, bete: b, ordre: r.jours, urgent: r.jours < 0,
      texte: `${libelle(TYPES_SOIN, r.type).split(" (")[0]}${r.produit ? ` — ${r.produit}` : ""}`,
      echeance: r.jours < 0 ? `en retard de ${-r.jours} j` : r.jours === 0 ? "aujourd'hui" : `dans ${r.jours} j`,
    }))),
    ...betes.flatMap((b) => (b.saillies || []).filter(saillieEnCours).map((s) => {
      const jours = joursAvant(velagePrevu(s.date));
      return {
        cle: `velage-${s.id}`, bete: b, ordre: jours, urgent: jours < 0,
        texte: `vêlage ${s.statut === "GESTANTE" ? "prévu" : "possible (gestation à confirmer)"}`,
        echeance: jours < 0 ? `dépassé de ${-jours} j` : `le ${dateLisible(velagePrevu(s.date))}`,
      };
    })),
    ...betes.map((b) => ({ b, retrait: retraitEnCours(b.soins) })).filter((x) => x.retrait).map(({ b, retrait }) => ({
      cle: `retrait-${b.id}`, bete: b, ordre: joursAvant(retrait.fin), urgent: true,
      texte: `en retrait${retrait.soin.produit ? ` (${retrait.soin.produit})` : ""}`, echeance: `jusqu'au ${dateLisible(retrait.fin)}`,
    })),
    ...betes.map((b) => ({ b, lente: sousLaCible(b, gmqCible) })).filter((x) => x.lente).map(({ b, lente }) => ({
      cle: `gain-${b.id}`, bete: b, ordre: 9999, urgent: false,
      texte: "croissance sous la cible", echeance: `${nombre(lente.gmq)} kg/jour (cible ${nombre(gmqCible)})`,
    })),
  ].sort((x, y) => x.ordre - y.ordre);
  if (lignes.length === 0) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>📋 À suivre</div>
      {lignes.map((l, i) => (
        <Link key={l.cle} href={`/elevage/${l.bete.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 2px", fontSize: 13.5, textDecoration: "none", color: "var(--text)", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{nomBete(l.bete)}</strong> · {l.texte}</span>
          <span style={{ flexShrink: 0, fontWeight: 700, textAlign: "right", color: l.urgent ? "var(--danger)" : "var(--text-muted)" }}>{l.echeance}</span>
        </Link>
      ))}
    </div>
  );
}

export const FICHE_VIDE = {
  nom: "", identifiant: "", sexe: "", genetique: "FULLBLOOD", pourcentageWagyu: "100", dateNaissance: "",
  origine: "NEE_ICI", dateAcquisition: "", provenance: "", coutAcquisition: "", mereId: "", pereId: "", pere: "", notes: "",
};

function NouvelleBete({ femelles, taureaux, onCree }) {
  const [fiche, setFiche] = useState({ ...FICHE_VIDE, poidsInitial: "" });
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function creer() {
    const data = await appeler("/api/elevage/betes", "POST", fiche);
    if (data) onCree(data.id);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <ChampsBete fiche={fiche} maj={maj} femelles={femelles} taureaux={taureaux} />
      <Champ label={fiche.origine === "ACHETEE" ? "Poids à l'arrivée (kg, facultatif)" : "Poids à la naissance (kg, facultatif)"}>
        <input inputMode="decimal" value={fiche.poidsInitial} onChange={maj("poidsInitial")} style={champStyle} />
      </Champ>
      <Erreur texte={erreur} />
      <button onClick={creer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Ajouter au troupeau"}</button>
    </div>
  );
}

// Champs de la fiche d'une bête — partagés avec la fiche détaillée
export function ChampsBete({ fiche, maj, femelles, taureaux = [] }) {
  return (
    <>
      <div style={grille2}>
        <Champ label="Sexe">
          <select value={fiche.sexe} onChange={maj("sexe")} style={champStyle}>
            <option value="">—</option>
            {SEXES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </Champ>
        <Champ label="Nom (facultatif)">
          <input value={fiche.nom} onChange={maj("nom")} style={champStyle} />
        </Champ>
        <Champ label="Boucle d'oreille ATQ (15 chiffres)">
          <input inputMode="numeric" placeholder="124 000 …" value={fiche.identifiant} onChange={maj("identifiant")} style={champStyle} />
        </Champ>
        <Champ label="Date de naissance">
          <input type="date" max="9999-12-31" value={fiche.dateNaissance} onChange={maj("dateNaissance")} style={champStyle} />
        </Champ>
        <Champ label="Génétique">
          <select value={fiche.genetique} onChange={maj("genetique")} style={champStyle}>
            <option value="">—</option>
            {GENETIQUES.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </select>
        </Champ>
        <Champ label="% wagyu">
          <input inputMode="decimal" value={fiche.pourcentageWagyu} onChange={maj("pourcentageWagyu")} style={champStyle} />
        </Champ>
        <Champ label="Mère">
          <select value={fiche.mereId} onChange={maj("mereId")} style={champStyle}>
            <option value="">— (inconnue ou hors troupeau)</option>
            {femelles.map((f) => <option key={f.id} value={f.id}>{f.numero}{f.nom ? ` — ${f.nom}` : ""}</option>)}
          </select>
        </Champ>
        <Champ label="Père (taureau du troupeau)">
          <select value={fiche.pereId} onChange={maj("pereId")} style={champStyle}>
            <option value="">— (de l'extérieur ou semence)</option>
            {taureaux.map((t) => <option key={t.id} value={t.id}>{t.numero}{t.nom ? ` — ${t.nom}` : ""}</option>)}
          </select>
        </Champ>
        {!fiche.pereId && (
          <Champ label="Père de l'extérieur ou semence">
            <input value={fiche.pere} onChange={maj("pere")} style={champStyle} />
          </Champ>
        )}
      </div>
      <label style={labelStyle}>Origine</label>
      <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 8 }}>
        {[["NEE_ICI", "Née ici"], ["ACHETEE", "Achetée"]].map(([code, texte]) => (
          <label key={code} style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={fiche.origine === code} onChange={() => maj("origine")({ target: { value: code } })} />
            {texte}
          </label>
        ))}
      </div>
      {fiche.origine === "ACHETEE" && (
        <div style={grille2}>
          <Champ label="Date d'achat">
            <input type="date" max="9999-12-31" value={fiche.dateAcquisition} onChange={maj("dateAcquisition")} style={champStyle} />
          </Champ>
          <Champ label="Coût d'achat (avant taxes)">
            <input inputMode="decimal" value={fiche.coutAcquisition} onChange={maj("coutAcquisition")} placeholder="0,00" style={champStyle} />
          </Champ>
          <Champ label="Achetée de">
            <input value={fiche.provenance} onChange={maj("provenance")} placeholder="Éleveur, encan…" style={champStyle} />
          </Champ>
        </div>
      )}
      <Champ label="Notes">
        <textarea value={fiche.notes} onChange={maj("notes")} rows={2} style={{ ...champStyle, resize: "vertical" }} />
      </Champ>
    </>
  );
}
