"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { TitreSection } from "../../components/ui";
import { BoutonPlein, BoutonContour, Pastille } from "../../components/StyleSection";
import { dateCourte, joursAvant, nomBete } from "@/lib/elevageCalculs";
import { EVENEMENTS, DELAI_DECLARATION, formaterBoucle, emplacement } from "@/lib/registreElevage";
import { boutonPrincipal, boutonLien, Erreur, Onglets, Statistique, NavElevage, useApi, aujourdhui } from "../ui";
import { ChampsDeplacement, DEPLACEMENT_VIDE } from "../[id]/Identification";

const FILTRES = [
  { code: "A_DECLARER", label: "À déclarer" },
  { code: "TOUT", label: "Tout le journal" },
];

export default function RegistreClient({ betes, evenements, lieux }) {
  const anneeCourante = aujourdhui().slice(0, 4);
  const annees = [...new Set([anneeCourante, ...evenements.map((e) => dateCourte(e.date).slice(0, 4))])].sort().reverse();
  const [filtre, setFiltre] = useState("A_DECLARER");
  const [annee, setAnnee] = useState(anneeCourante);
  const [deplacement, setDeplacement] = useState(false);
  const { appeler, enCours, erreur } = useApi();

  const aDeclarer = evenements.filter((e) => e.aDeclarer && !e.declareLe);
  const enRetard = aDeclarer.filter((e) => -joursAvant(e.date) > DELAI_DECLARATION);
  const actives = betes.filter((b) => b.statut === "ACTIVE");
  const sansBoucle = actives.filter((b) => !b.identifiant);
  // « À déclarer » : toutes les années ; le journal complet : l'année choisie
  const affiches = filtre === "A_DECLARER" ? aDeclarer : evenements.filter((e) => dateCourte(e.date).startsWith(annee));

  const declarer = (cles, declare) => appeler("/api/elevage/registre/declarations", "POST", { cles, declare });
  async function toutDeclarer() {
    if (window.confirm(`Marquer ces ${aDeclarer.length} événements comme déclarés à ATQ ?`)) await declarer(aDeclarer.map((e) => e.cle), true);
  }

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📒" titre="Registre" sousTitre="Identification des bêtes et journal de leurs déplacements, à déclarer à Agri-Traçabilité Québec." />
      <NavElevage actif="/elevage/registre" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={deplacement ? null : "epingle"} onClick={() => setDeplacement((v) => !v)}>{deplacement ? "Annuler" : "Déplacer des bêtes"}</BoutonPlein>
        <BoutonContour icone="document" href={`/api/elevage/registre/csv?annee=${annee}`} target="_blank">Exporter {annee} (CSV)</BoutonContour>
      </div>
      {deplacement && <DeplacementGroupe betes={actives} lieux={lieux} onFin={() => setDeplacement(false)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Statistique valeur={aDeclarer.length} label="Événements à déclarer" teinte="var(--accent)" />
        <Statistique valeur={enRetard.length} label={`À déclarer depuis plus de ${DELAI_DECLARATION} jours`} teinte="var(--danger)" />
        <Statistique valeur={sansBoucle.length} label="Bêtes sans boucle inscrite" teinte="var(--bleu)" />
      </div>

      {sansBoucle.length > 0 && (
        <div className="carte" style={{ marginBottom: 14 }}>
          <TitreSection>Boucle à inscrire</TitreSection>
          <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.7 }}>
            {sansBoucle.map((b, i) => <span key={b.id}>{i > 0 && " · "}<Link href={`/elevage/${b.id}`} style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>{nomBete(b)}</Link></span>)}
          </p>
        </div>
      )}

      <div className="carte" style={{ marginBottom: 20 }}>
        <TitreSection>Journal</TitreSection>
        <Onglets options={FILTRES} valeur={filtre} onChange={setFiltre} />
        {filtre === "TOUT" && (
          <select value={annee} onChange={(e) => setAnnee(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 10 }}>
            {annees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {filtre === "A_DECLARER" && aDeclarer.length > 1 && (
          <div style={{ marginBottom: 6 }}><button onClick={toutDeclarer} disabled={enCours} style={{ ...boutonLien, fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>Tout marquer comme déclaré</button></div>
        )}
        <Erreur texte={erreur} />
        {affiches.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{filtre === "A_DECLARER" ? "Rien à déclarer : tout est à jour." : "Aucun événement cette année-là."}</p>
        ) : (
          affiches.map((e, i) => {
            const depuis = -joursAvant(e.date);
            return (
              <div key={e.cle} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
                    {EVENEMENTS[e.type]} · <Link href={`/elevage/${e.bete.id}`} style={{ color: "var(--accent-ombre)" }}>{nomBete(e.bete)}</Link>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                    {[dateCourte(e.date), e.bete.identifiant ? `boucle ${formaterBoucle(e.bete.identifiant)}` : "sans boucle", e.detail, e.transporteur].filter(Boolean).join(" · ")}
                  </div>
                  {e.aDeclarer && (
                    <div style={{ marginTop: 5 }}>
                      {e.declareLe
                        ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Déclaré le {dateCourte(e.declareLe)}</Pastille>
                        : depuis > DELAI_DECLARATION
                          ? <Pastille couleur="var(--danger)" fond="var(--danger-fond)">À déclarer depuis {depuis} j</Pastille>
                          : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">À déclarer</Pastille>}
                    </div>
                  )}
                </div>
                {e.aDeclarer && (
                  <button onClick={() => declarer([e.cle], !e.declareLe)} disabled={enCours} style={{ ...boutonLien, flexShrink: 0, fontSize: 13, fontWeight: 700, color: e.declareLe ? "var(--text-muted)" : "var(--accent-ombre)", padding: "2px 0" }}>
                    {e.declareLe ? "Annuler" : "Marquer déclaré"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Déplace un groupe d'un coup : les bêtes sont cochées, rangées par emplacement
function DeplacementGroupe({ betes, lieux, onFin }) {
  const [champs, setChamps] = useState({ date: aujourdhui(), ...DEPLACEMENT_VIDE });
  const [choisies, setChoisies] = useState(() => new Set());
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const lieuDe = (b) => { const ou = emplacement(b.deplacements); return ou ? `${ou.horsFerme ? "Hors ferme — " : ""}${ou.lieu}` : "Emplacement inconnu"; };
  const groupes = [...new Set(betes.map(lieuDe))].sort().map((lieu) => ({ lieu, betes: betes.filter((b) => lieuDe(b) === lieu) }));
  const basculer = (ids, coche) => setChoisies((s) => { const n = new Set(s); ids.forEach((id) => (coche ? n.add(id) : n.delete(id))); return n; });

  async function deplacer() {
    if (await appeler("/api/elevage/deplacements", "POST", { ...champs, beteIds: [...choisies] })) onFin();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <ChampsDeplacement champs={champs} maj={maj} lieux={lieux} />
      {groupes.map((g) => {
        const tout = g.betes.every((b) => choisies.has(b.id));
        return (
          <div key={g.lieu} style={{ marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}>
              <input type="checkbox" checked={tout} onChange={(e) => basculer(g.betes.map((b) => b.id), e.target.checked)} />
              📍 {g.lieu} ({g.betes.length})
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "2px 10px", paddingLeft: 22 }}>
              {g.betes.map((b) => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", padding: "5px 0", minWidth: 0 }}>
                  <input type="checkbox" checked={choisies.has(b.id)} onChange={(e) => basculer([b.id], e.target.checked)} />
                  <span style={{ overflowWrap: "anywhere" }}>{nomBete(b)}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {betes.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucune bête au troupeau.</p>}
      <Erreur texte={erreur} />
      <button onClick={deplacer} disabled={enCours || choisies.size === 0} className="bouton-3d" style={boutonPrincipal}>
        {enCours ? "…" : choisies.size === 0 ? "Coche les bêtes à déplacer" : `Déplacer ${choisies.size} bête${choisies.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
