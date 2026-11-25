"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScanElevage from "../ScanElevage";
import BandeauSection from "../../components/BandeauSection";
import { TitreSection } from "../../components/ui";
import { CANAUX, stockLot, argent, kg, dateCourte, dateLisible, joursAvant } from "@/lib/elevageCalculs";
import VentesParMois from "./VentesParMois";
import {
  champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, Onglets, Statistique, NavElevage, Tableau, cellule, celluleDroite, useApi, aujourdhui, DeuxColonnes,
} from "../ui";
import ChampArgent from "@/app/components/ChampArgent";

// Une coupe « dort » si elle a des paquets au congélateur depuis au moins ce
// nombre de jours et qu'aucun ne s'est vendu depuis autant de jours
const JOURS_DORT = 30;

const paquets = (n) => `${n} paquet${n > 1 ? "s" : ""}`;
const nombre = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")) || 0;

export default function ViandeClient({ coupes, ventes, lotScanne, scanInconnu }) {
  const router = useRouter();
  const [venteCoupe, setVenteCoupe] = useState(null); // coupe ouverte dans le formulaire de vente
  // Paquet scanné : vendu dans son lot, présenté comme une coupe au formulaire
  const stockScanne = lotScanne && stockLot(lotScanne);
  const paquetScanne = lotScanne && { ...lotScanne.coupe, paquets: stockScanne.paquets, poids: stockScanne.poids, lotId: lotScanne.id, bete: lotScanne.abattage.bete };
  const finScan = () => router.replace("/elevage/viande");

  const stock = coupes.map((c) => {
    const lots = c.lots.map((l) => ({ ...l, stock: stockLot(l) })).filter((l) => l.stock.paquets > 0);
    const paquets = lots.reduce((s, l) => s + l.stock.paquets, 0);
    const poids = lots.reduce((s, l) => s + l.stock.poids, 0);
    // Écoulement : part déjà vendue des paquets reçus des bêtes encore en stock
    const recus = lots.reduce((s, l) => s + l.nbPaquets, 0);
    // Depuis combien de jours le plus vieux paquet est au congélateur, et
    // depuis combien de jours la coupe ne s'est pas vendue (null : jamais)
    const joursStock = lots.length ? -joursAvant(lots[0].abattage.date) : 0;
    const dates = c.lots.flatMap((l) => l.ventes.map((v) => dateCourte(v.date))).sort();
    const joursSansVente = dates.length ? -joursAvant(dates[dates.length - 1]) : null;
    const dort = joursStock >= JOURS_DORT && (joursSansVente === null || joursSansVente >= JOURS_DORT);
    return { ...c, lotsEnStock: lots, paquets, poids, recus, ecoule: recus > 0 ? (recus - paquets) / recus : 0, joursStock, joursSansVente, dort };
  });
  const enStock = stock.filter((c) => c.paquets > 0);
  const totalPaquets = enStock.reduce((s, c) => s + c.paquets, 0);
  const totalPoids = enStock.reduce((s, c) => s + c.poids, 0);
  const valeurBoutique = enStock.reduce((s, c) => s + c.poids * c.prixBoutique, 0);
  const mois = aujourdhui().slice(0, 7);
  const ventesMois = ventes.filter((v) => dateCourte(v.date).startsWith(mois));
  const somme = (liste, champ) => liste.reduce((t, v) => t + v[champ], 0);
  const dormantes = enStock.filter((c) => c.dort).length;

  return (
    <div className="conteneur-page" style={{ maxWidth: 1100 }}>
      <BandeauSection icone="🥩" titre="Viande" sousTitre="Paquets en stock par coupe et ventes en boutique ou en ligne. Chaque paquet vendu reste relié à sa bête." />
      <NavElevage actif="/elevage/viande" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Statistique valeur={totalPaquets} label="Paquets en stock" teinte="var(--bleu)" note={`${kg(totalPoids, 0)} au congélateur`} />
        <Statistique valeur={argent(valeurBoutique)} label="Valeur du stock" teinte="var(--accent)" note="au prix boutique" />
        <Statistique valeur={argent(somme(ventesMois, "montant"))} label="Ventes ce mois-ci" teinte="var(--success)" note={paquets(somme(ventesMois, "nbPaquets"))} />
        <Statistique valeur={argent(somme(ventes, "montant"))} label="Ventes des 12 derniers mois" teinte="var(--success)" note={paquets(somme(ventes, "nbPaquets"))} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <ScanElevage libelle="Vendre un paquet en scannant son étiquette" />
      </div>
      {scanInconnu && <p style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", margin: "0 0 12px" }}>Cette étiquette ne correspond à aucun paquet (abattage annulé ?).</p>}
      {paquetScanne && (paquetScanne.paquets > 0 ? (
        <FormulaireVente key={paquetScanne.lotId} coupe={paquetScanne} onFin={finScan} />
      ) : (
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", margin: "0 0 12px" }}>
          Tous les paquets de {paquetScanne.nom} de la bête {paquetScanne.bete.numero} sont déjà vendus — vérifie le stock ou les ventes ci-dessous.
        </p>
      ))}

      {venteCoupe && !paquetScanne && <FormulaireVente coupe={stock.find((c) => c.id === venteCoupe)} onFin={() => setVenteCoupe(null)} />}

      <div className="carte" style={{ marginBottom: 14 }}>
        <TitreSection>Stock par coupe</TitreSection>
        {enStock.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Aucun paquet en stock. Les paquets entrent en stock à l'abattage d'une bête (sa fiche, dans le <Link href="/elevage" style={{ color: "var(--accent)" }}>troupeau</Link>).
          </p>
        ) : (
          <>
            {dormantes > 0 && (
              <p style={{ fontSize: 13, margin: "0 0 10px", padding: "9px 12px", borderRadius: 12, background: "var(--avertissement-fond)" }}>
                <strong>{dormantes} coupe{dormantes > 1 ? "s" : ""} {dormantes > 1 ? "dorment" : "dort"} au congélateur</strong> : aucune vente depuis au moins {JOURS_DORT} jours. Une promotion ou un ajustement de prix peut aider à l'écouler.
              </p>
            )}
            {/* Rangées en grille (.ligne-coupe, app/globals.css) : colonnes sur un écran large, petite carte sur un téléphone */}
            <div className="ligne-coupe entete">
              <span style={{ gridArea: "nom" }}>Coupe</span><span className="stock" style={{ gridArea: "stock" }}>En stock</span><span style={{ gridArea: "ecoule" }}>Écoulé</span>
              <span className="prix" style={{ gridArea: "prix" }}>Prix au kg</span><span className="valeur" style={{ gridArea: "valeur" }}>Valeur</span><span className="gel" style={{ gridArea: "gel" }}>Au congélateur</span>
              <span style={{ gridArea: "action", visibility: "hidden", fontSize: 12, padding: "0 10px" }}>Vendre</span>
            </div>
            {enStock.map((c) => (
              <div key={c.id} className="ligne-coupe">
                <div style={{ gridArea: "nom", minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.nom}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                    {c.lotsEnStock.map((l, i) => (
                      <span key={l.id}>{i > 0 && ", "}<Link href={`/elevage/${l.abattage.bete.id}`} style={{ color: "inherit" }}>{l.abattage.bete.numero}</Link> ({l.stock.paquets})</span>
                    ))}
                  </div>
                </div>
                <div className="stock" style={{ gridArea: "stock" }}>
                  <strong>{c.paquets} paquet{c.paquets > 1 ? "s" : ""}</strong> <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>· {kg(c.poids)}</span>
                </div>
                <div style={{ gridArea: "ecoule" }}>
                  <div style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{Math.round(c.ecoule * 100)} % vendu <span style={{ color: "var(--text-muted)" }}>({c.recus - c.paquets} sur {c.recus})</span></div>
                  <div role="progressbar" aria-label={`Part vendue de ${c.nom}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.ecoule * 100)} style={{ height: 6, borderRadius: 3, background: "var(--surface-alt)", overflow: "hidden", marginTop: 4 }}>
                    <div style={{ width: `${c.ecoule * 100}%`, height: "100%", borderRadius: 3, background: "var(--accent)" }} />
                  </div>
                </div>
                <div className="prix" style={{ gridArea: "prix" }}>
                  <div>{c.prixBoutique > 0 ? `${argent(c.prixBoutique)}/kg` : "prix à fixer"}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{!c.enLigne ? "pas en ligne" : c.prixEnLigne > 0 ? `en ligne ${argent(c.prixEnLigne)}` : "en ligne —"}</div>
                </div>
                <div className="valeur" style={{ gridArea: "valeur", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{c.prixBoutique > 0 ? argent(c.poids * c.prixBoutique) : "—"}</div>
                <div className="gel" style={{ gridArea: "gel" }}>
                  <div>depuis {c.joursStock} j</div>
                  <div style={{ fontSize: 11.5, fontWeight: c.dort ? 700 : 400, color: c.dort ? "var(--avertissement)" : "var(--text-muted)" }}>
                    {c.joursSansVente === null ? "jamais vendue" : c.joursSansVente <= 0 ? "vendue aujourd'hui" : `dernière vente il y a ${c.joursSansVente} j`}
                  </div>
                </div>
                <div style={{ gridArea: "action", justifySelf: "end" }}>
                  <button onClick={() => setVenteCoupe(c.id)} className="bouton-3d" style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>Vendre</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <Ventes ventes={ventes} coupes={coupes} />
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
    if (await appeler("/api/elevage/ventes", "POST", { ...champs, coupeId: coupe.id, lotId: coupe.lotId })) onFin();
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 14, border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Vendre — {coupe.nom}{coupe.bete && ` · bête ${coupe.bete.numero}`}</strong>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{coupe.paquets} en stock{coupe.bete && " de cette bête"}</span>
      </div>
      <Onglets options={CANAUX.map((c) => ({ code: c.code, label: `${c.icone} ${c.label}` }))} valeur={champs.canal} onChange={(canal) => setChamps((c) => ({ ...c, canal }))} />
      <div style={grille2}>
        <Champ label="Paquets"><input inputMode="numeric" value={champs.nbPaquets} onChange={maj("nbPaquets")} style={champStyle} /></Champ>
        <Champ label="Poids réel (kg)"><input inputMode="decimal" value={champs.poids} onChange={maj("poids")} placeholder={kg(poidsMoyen * nb, 2)} style={champStyle} /></Champ>
        <Champ label="Montant avant taxes ($)"><ChampArgent negatif={false} value={champs.montant} onChange={maj("montant")} placeholder={prix > 0 ? argent(poids * prix) : "à entrer"} style={champStyle} /></Champ>
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
  { code: "ANNEE", label: "12 derniers mois" },
];
const NB_VENTES = 12; // ventes montrées avant « Voir toutes les ventes »

function Ventes({ ventes, coupes }) {
  const [periode, setPeriode] = useState("ANNEE");
  const [tout, setTout] = useState(false);
  const { appeler, erreur } = useApi();
  const mois = aujourdhui().slice(0, 7);
  const affichees = ventes.filter((v) => periode === "ANNEE" || dateCourte(v.date).startsWith(mois));
  const total = affichees.reduce((s, v) => s + v.montant, 0);
  const parCanal = CANAUX.map((c) => {
    const liste = affichees.filter((v) => v.canal === c.code);
    return { ...c, montant: liste.reduce((s, v) => s + v.montant, 0), paquets: liste.reduce((s, v) => s + v.nbPaquets, 0), poids: liste.reduce((s, v) => s + v.poids, 0) };
  });
  // Ce qui se vend, par coupe : la plus payante d'abord
  const parCoupe = coupes.map((c) => {
    const liste = affichees.filter((v) => v.lot.coupe.nom === c.nom);
    const montant = liste.reduce((s, v) => s + v.montant, 0);
    const poids = liste.reduce((s, v) => s + v.poids, 0);
    return { id: c.id, nom: c.nom, prixBoutique: c.prixBoutique, montant, poids, paquets: liste.reduce((s, v) => s + v.nbPaquets, 0), prixMoyen: poids > 0 ? montant / poids : 0 };
  }).filter((c) => c.paquets > 0).sort((x, y) => y.montant - x.montant);
  // Les 12 derniers mois, du plus ancien au plus récent
  const [annee, moisCourant] = mois.split("-").map(Number);
  const serie = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(annee, moisCourant - 12 + i, 1));
    const cle = d.toISOString().slice(0, 7);
    const duMois = ventes.filter((v) => dateCourte(v.date).startsWith(cle));
    return { cle, ...Object.fromEntries(CANAUX.map((c) => [c.code, duMois.filter((v) => v.canal === c.code).reduce((s, v) => s + v.montant, 0)])) };
  });

  async function annuler(v) {
    if (window.confirm(`Annuler cette vente ? ${v.nbPaquets} paquet${v.nbPaquets > 1 ? "s" : ""} de ${v.lot.coupe.nom} reviennent en stock.`)) await appeler(`/api/elevage/ventes/${v.id}`, "DELETE");
  }

  return (
    <div className="carte" style={{ marginBottom: 20 }}>
      <TitreSection>Ventes par mois</TitreSection>
      {ventes.length > 0 ? <VentesParMois mois={serie} /> : <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px" }}>Aucune vente depuis 12 mois.</p>}

      <Onglets options={PERIODES} valeur={periode} onChange={(p) => { setPeriode(p); setTout(false); }} />
      <Erreur texte={erreur} />
      {affichees.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune vente pour cette période.</p>
      ) : (
        <DeuxColonnes>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {parCanal.map((c) => (
                <Statistique key={c.code} valeur={argent(c.montant)} label={`${c.icone} ${c.label}`} note={`${paquets(c.paquets)} · ${kg(c.poids)}`} teinte={c.code === "EN_LIGNE" ? "var(--serie-2)" : "var(--serie-1)"} />
              ))}
            </div>
            <div className="titre-section">Ce qui se vend</div>
            <Tableau entetes={["Coupe", "Ventes", "Prix obtenu"]} alignDroite={[1, 2]}>
              {parCoupe.map((c) => (
                <tr key={c.id}>
                  <td style={cellule}>
                    <div style={{ fontWeight: 700 }}>{c.nom}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{c.paquets} paquet{c.paquets > 1 ? "s" : ""} · {kg(c.poids)}</div>
                    <div role="progressbar" aria-label={`Part des ventes de ${c.nom}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((c.montant / total) * 100)} style={{ height: 6, borderRadius: 3, background: "var(--surface-alt)", overflow: "hidden", marginTop: 4 }}>
                      <div style={{ width: `${(c.montant / total) * 100}%`, height: "100%", borderRadius: 3, background: "var(--accent)" }} />
                    </div>
                  </td>
                  <td style={celluleDroite}><strong>{argent(c.montant)}</strong><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{Math.round((c.montant / total) * 100)} % des ventes</div></td>
                  <td style={celluleDroite}>{argent(c.prixMoyen)}/kg{c.prixBoutique > 0 && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>boutique {argent(c.prixBoutique)}</div>}</td>
                </tr>
              ))}
            </Tableau>
          </div>
          <div>
            <div className="titre-section">Dernières ventes</div>
            {(tout ? affichees : affichees.slice(0, NB_VENTES)).map((v, i) => {
              const canal = CANAUX.find((c) => c.code === v.canal);
              return (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ overflowWrap: "anywhere" }}>{v.nbPaquets} × {v.lot.coupe.nom}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                      {dateLisible(v.date)} · {canal?.icone} {canal?.label} · {kg(v.poids, 2)} · <Link href={`/elevage/${v.lot.abattage.bete.id}`} style={{ color: "var(--accent-ombre)" }}>{v.lot.abattage.bete.numero}</Link>{v.note && ` — ${v.note}`}
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>{argent(v.montant)}</strong>
                    <button onClick={() => annuler(v)} title="Annuler cette vente" aria-label="Annuler cette vente" style={{ ...boutonLien, color: "var(--danger)", padding: "4px 6px" }}>✕</button>
                  </span>
                </div>
              );
            })}
            {affichees.length > NB_VENTES && (
              <button type="button" onClick={() => setTout((v) => !v)} style={{ ...boutonLien, color: "var(--accent-ombre)", fontWeight: 700, fontSize: 13, padding: "10px 0 0" }}>
                {tout ? "Montrer moins" : `Voir les ${affichees.length} ventes`}
              </button>
            )}
          </div>
        </DeuxColonnes>
      )}
    </div>
  );
}
