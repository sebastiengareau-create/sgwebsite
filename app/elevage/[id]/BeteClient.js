"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../components/StyleSection";
import { ChampsBete, FICHE_VIDE } from "../TroupeauClient";
import {
  SEXES, GENETIQUES, STATUTS_BETE, CATEGORIES_FRAIS, CANAUX, libelle, age, dateCourte, argent, kg,
  dernierePesee, gainMoyenQuotidien, peseesAvecGain, estimerDecoupe, totauxDecoupe, carcasseDepuisVif, stockLot, coutBete, revenusBete,
  TYPES_SOIN, finRetrait, retraitEnCours, rappelsAFaire, joursAvant, gmqRecent, enCroissance, nomBete,
} from "@/lib/elevageCalculs";
import EtiquettesElevage from "../EtiquettesElevage";
import {
  champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, Tableau, TableEstimation, cellule, celluleDroite, useApi, aujourdhui,
  Section, LienPanneau, BoutonRetirer,
} from "../ui";
import { Lignee, Reproduction } from "./Reproduction";
import CourbePoids from "./CourbePoids";
import Identification from "./Identification";
import { formaterBoucle } from "@/lib/registreElevage";

const nombre = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")) || 0;
const decimal = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", ",");

export default function BeteClient({ bete, registre, coupes, rendementCarcasse, gmqCible, lieux }) {
  const femelles = registre.filter((b) => b.sexe === "FEMELLE" && b.id !== bete.id);
  const taureaux = registre.filter((b) => b.sexe === "TAUREAU" && b.id !== bete.id);
  const veaux = bete.sexe === "FEMELLE" ? bete.veaux : bete.veauxPere;
  const statut = STATUTS_BETE.find((s) => s.code === bete.statut);
  const couleur = statut?.couleur || "var(--accent)";
  const pesee = dernierePesee(bete.pesees);
  const gmq = gainMoyenQuotidien(bete.pesees);
  const cout = coutBete(bete);
  const revenus = revenusBete(bete);
  const aResultat = revenus > 0 || !!bete.abattage;
  const retrait = bete.statut === "ACTIVE" ? retraitEnCours(bete.soins) : null;
  return (
    <div className="conteneur-page">
      <Link href="/elevage" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au troupeau</Link>

      {/* Carte de la bête */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleur }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleur, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🐂</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>{bete.numero}{bete.nom && ` — ${bete.nom}`}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {[libelle(SEXES, bete.sexe).split(" (")[0], bete.dateNaissance && age(bete.dateNaissance, bete.dateSortie || new Date()), bete.identifiant && `boucle ${formaterBoucle(bete.identifiant)}`].filter(Boolean).join(" · ")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Pastille couleur={couleur} fond="var(--surface-alt)">{statut?.label}{bete.dateSortie && ` le ${dateCourte(bete.dateSortie)}`}</Pastille>
              {bete.pourcentageWagyu != null && <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>{bete.pourcentageWagyu} % wagyu</Pastille>}
              {bete.abattage?.bms && <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>BMS {bete.abattage.bms}</Pastille>}
              {retrait && <Pastille couleur={TEINTES.rouge.couleur} fond={TEINTES.rouge.fond}>En retrait jusqu'au {dateCourte(retrait.fin)}</Pastille>}
            </div>
          </div>
        </div>
      </div>

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre
          titre="Dernier poids" montant={pesee ? kg(pesee.poids, 0) : "—"} teinte="var(--bleu)"
          note={pesee ? `Pesée du ${dateCourte(pesee.date)}${gmq != null ? ` · ${decimal(gmq, 2)} kg/jour` : ""}` : "Aucune pesée"}
        />
        <CarteChiffre titre="Coût de revient" montant={argent(cout)} teinte="var(--accent)" note={`${bete.frais.length} frais${bete.coutAcquisition > 0 ? " + achat" : ""}`} />
        {aResultat ? (
          <CarteChiffre
            titre="Résultat à ce jour" montant={argent(revenus - cout)}
            couleur={revenus - cout >= 0 ? "var(--success)" : "var(--danger)"} teinte={revenus - cout >= 0 ? "var(--success)" : "var(--danger)"}
            note={`Ventes ${argent(revenus)}`}
          />
        ) : (
          <CarteChiffre titre="Âge" montant={bete.dateNaissance ? age(bete.dateNaissance, bete.dateSortie || new Date()) : "—"} teinte="var(--success)" note={bete.dateNaissance ? `Née le ${dateCourte(bete.dateNaissance)}` : "Date de naissance inconnue"} />
        )}
      </div>

      <Fiche bete={bete} femelles={femelles} taureaux={taureaux} />
      <Identification bete={bete} lieux={lieux} />
      <Lignee bete={bete} registre={registre} />
      <Rentabilite bete={bete} />
      {bete.abattage ? <Decoupe bete={bete} /> : bete.statut === "ACTIVE" && <EstimationEtAbattage bete={bete} coupes={coupes} rendementCarcasse={rendementCarcasse} retrait={retrait} />}
      {bete.sexe === "FEMELLE" && <Reproduction bete={bete} registre={registre} taureaux={taureaux.filter((t) => t.statut === "ACTIVE")} />}
      <Pesees bete={bete} gmqCible={gmqCible} />
      <Soins bete={bete} />
      <Frais bete={bete} />
      {veaux.length > 0 && <Veaux veaux={veaux} />}
      {!bete.abattage && <Sortie bete={bete} />}
    </div>
  );
}

// Encadré de total (coût de revient, profit)
function Encadre({ label, valeur, couleur = "var(--accent-ombre)", fond = "rgba(232,163,61,0.16)" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: fond, marginTop: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: couleur }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: couleur === "var(--accent-ombre)" ? "var(--text)" : couleur }}>{valeur}</span>
    </div>
  );
}

// ---------- Fiche ----------

function Fiche({ bete, femelles, taureaux }) {
  const [edition, setEdition] = useState(false);
  const [etiquette, setEtiquette] = useState(false);
  const [fiche, setFiche] = useState(() => Object.fromEntries(Object.keys(FICHE_VIDE).map((k) => [k, k.startsWith("date") ? dateCourte(bete[k]) : bete[k] == null ? "" : String(bete[k])])));
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function enregistrer() {
    if (await appeler(`/api/elevage/betes/${bete.id}`, "PATCH", fiche)) setEdition(false);
  }

  const bouton = <LienPanneau onClick={() => setEdition((v) => !v)}>{edition ? "Annuler" : "Modifier"}</LienPanneau>;
  if (edition) {
    return (
      <Section titre="Fiche" icone="crayon" droite={bouton}>
        <ChampsBete fiche={fiche} maj={maj} femelles={femelles} taureaux={taureaux} />
        <Erreur texte={erreur} />
        <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Enregistrer"}</button>
      </Section>
    );
  }
  return (
    <Section titre="Fiche" icone="presse" droite={bouton}>
      <LigneDetail premiere label="Sexe" valeur={libelle(SEXES, bete.sexe)} />
      <LigneDetail label="Boucle d'oreille" valeur={formaterBoucle(bete.identifiant) || null} />
      <LigneDetail label="Naissance" valeur={bete.dateNaissance && `${dateCourte(bete.dateNaissance)} (${age(bete.dateNaissance, bete.dateSortie || new Date())})`} />
      <LigneDetail label="Génétique" valeur={[bete.genetique && libelle(GENETIQUES, bete.genetique).split(" (")[0], bete.pourcentageWagyu != null && `${bete.pourcentageWagyu} % wagyu`].filter(Boolean).join(" · ")} />
      <LigneDetail label="Mère" valeur={bete.mere && <Link href={`/elevage/${bete.mere.id}`} style={{ color: "var(--accent-ombre)" }}>{bete.mere.numero}{bete.mere.nom ? ` — ${bete.mere.nom}` : ""}</Link>} />
      <LigneDetail label="Père" valeur={bete.pereBete ? <Link href={`/elevage/${bete.pereBete.id}`} style={{ color: "var(--accent-ombre)" }}>{nomBete(bete.pereBete)}</Link> : bete.pere} />
      <LigneDetail label="Origine" valeur={bete.origine === "ACHETEE" ? ["Achetée", bete.dateAcquisition && `le ${dateCourte(bete.dateAcquisition)}`, bete.provenance && `de ${bete.provenance}`, `pour ${argent(bete.coutAcquisition)}`].filter(Boolean).join(" ") : "Née ici"} />
      {bete.notes && <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap", margin: "8px 0 0", padding: "10px 12px", borderRadius: 12, background: "var(--bg)" }}>{bete.notes}</p>}
      {etiquette ? (
        <EtiquettesElevage type="bete" beteId={bete.id} onFermer={() => setEtiquette(false)} />
      ) : (
        <div style={{ marginTop: 12 }}><BoutonAction icone="etiquette" onClick={() => setEtiquette(true)} style={{ width: "100%" }}>Imprimer l'étiquette de la bête (code QR)</BoutonAction></div>
      )}
    </Section>
  );
}

// ---------- Coût de revient et ventes ----------

function Rentabilite({ bete }) {
  const fraisParCategorie = CATEGORIES_FRAIS.map((c) => ({ ...c, total: bete.frais.filter((f) => f.categorie === c.code).reduce((s, f) => s + f.montant, 0) })).filter((c) => c.total > 0);
  const cout = coutBete(bete);
  const revenus = revenusBete(bete);
  const lots = bete.abattage?.lots || [];
  const parCanal = CANAUX.map((c) => ({ ...c, total: lots.reduce((s, l) => s + l.ventes.filter((v) => v.canal === c.code).reduce((t, v) => t + v.montant, 0), 0) }));
  const valeurStock = lots.reduce((s, l) => s + stockLot(l).poids * (l.coupe.prixBoutique || 0), 0);
  return (
    <Section titre="Coût de revient et ventes" icone="calculatrice" teinte={TEINTES.vert}>
      {(() => {
        const lignes = [
          bete.coutAcquisition > 0 && { cle: "achat", label: "Achat de la bête", valeur: argent(bete.coutAcquisition) },
          ...fraisParCategorie.map((c) => ({ cle: c.code, label: c.label, valeur: argent(c.total) })),
          bete.abattage && { cle: "abattage", label: "Abattage et découpe", valeur: argent(bete.abattage.fraisAbattage) },
        ].filter(Boolean);
        return lignes.map((l, i) => <LigneDetail key={l.cle} premiere={i === 0} label={l.label} valeur={l.valeur} />);
      })()}
      <Encadre label="Coût de revient" valeur={argent(cout)} />
      {bete.abattage && cout > 0 && bete.abattage.poidsCarcasse > 0 && (
        <LigneDetail premiere label="Coût par kg de carcasse" valeur={argent(cout / bete.abattage.poidsCarcasse)} />
      )}
      {bete.statut === "VENDUE" && <LigneDetail label="Vente sur pied" valeur={argent(bete.prixVente)} />}
      {bete.abattage && parCanal.map((c) => <LigneDetail key={c.code} label={`${c.icone} Ventes ${c.label.toLowerCase()}`} valeur={argent(c.total)} />)}
      {(revenus > 0 || bete.abattage) && (
        <Encadre
          label={valeurStock > 0 ? "Résultat à ce jour" : "Profit"} valeur={argent(revenus - cout)}
          couleur={revenus - cout >= 0 ? "var(--success)" : "var(--danger)"} fond={revenus - cout >= 0 ? "var(--success-fond)" : "var(--danger-fond)"}
        />
      )}
      {valeurStock > 0 && (
        <>
          <LigneDetail premiere label="Viande en stock (prix boutique)" valeur={argent(valeurStock)} />
          <Encadre
            label="Profit prévu (tout vendu en boutique)" valeur={argent(revenus + valeurStock - cout)}
            couleur={revenus + valeurStock - cout >= 0 ? "var(--success)" : "var(--danger)"} fond={revenus + valeurStock - cout >= 0 ? "var(--success-fond)" : "var(--danger-fond)"}
          />
        </>
      )}
    </Section>
  );
}

// ---------- Avant l'abattage : estimation, puis abattage ----------

function EstimationEtAbattage({ bete, coupes, rendementCarcasse, retrait }) {
  const [abattre, setAbattre] = useState(false);
  const pesee = dernierePesee(bete.pesees);
  const carcasse = pesee ? carcasseDepuisVif(pesee.poids, rendementCarcasse) : 0;
  const lignes = estimerDecoupe(carcasse, coupes);
  const totaux = totauxDecoupe(lignes);

  return (
    <Section
      titre={abattre ? "Abattage et découpe" : "Si elle était abattue aujourd'hui"} icone={abattre ? "outils" : "balance"} teinte={abattre ? TEINTES.rouge : TEINTES.ambre}
      droite={<LienPanneau onClick={() => setAbattre((v) => !v)} couleur={abattre ? "var(--text-muted)" : "var(--danger)"}>{abattre ? "Annuler" : "Abattage…"}</LienPanneau>}
    >
      {retrait && (
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", background: "var(--danger-fond)", borderRadius: 12, padding: "10px 12px", margin: "0 0 12px" }}>
          ⚠️ Délai de retrait en cours{retrait.soin.produit ? ` (${retrait.soin.produit})` : ""} : pas d'abattage avant le {dateCourte(retrait.fin)}.
        </p>
      )}
      {abattre ? (
        <FormulaireAbattage bete={bete} coupes={coupes} poidsVifInitial={pesee?.poids} carcasseInitiale={carcasse} />
      ) : !pesee ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Ajoute une pesée pour estimer la viande que donnera cette bête.</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
            {kg(pesee.poids, 0)} vif (pesée du {dateCourte(pesee.date)}) × {rendementCarcasse} % = <strong style={{ color: "var(--text)" }}>{kg(carcasse, 0)} de carcasse</strong>, découpée selon les <Link href="/elevage/coupes" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>rendements</Link> :
          </p>
          <TableEstimation lignes={lignes} />
          <Encadre label={`${totaux.paquets} paquets · ${kg(totaux.poidsPaquets)} de viande`} valeur={totaux.valeurBoutique > 0 ? argent(totaux.valeurBoutique) : "—"} />
        </>
      )}
    </Section>
  );
}

function FormulaireAbattage({ bete, coupes, poidsVifInitial, carcasseInitiale }) {
  const [champs, setChamps] = useState({
    date: aujourdhui(), abattoir: "", poidsVif: poidsVifInitial ? String(poidsVifInitial).replace(".", ",") : "",
    poidsCarcasse: carcasseInitiale ? decimal(carcasseInitiale, 0) : "", bms: "", fraisAbattage: "", notes: "",
  });
  // Paquets réellement reçus, par coupe — tant qu'une ligne n'est pas
  // modifiée à la main, elle suit l'estimation (poids de carcasse)
  const [recus, setRecus] = useState({});
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const estimation = estimerDecoupe(nombre(champs.poidsCarcasse), coupes);
  const ligne = (l) => recus[l.coupeId] || { nbPaquets: String(l.paquets), poidsTotal: decimal(l.poidsPaquets, 2) };
  const majRecu = (l, champ) => (e) => setRecus((r) => ({ ...r, [l.coupeId]: { ...ligne(l), [champ]: e.target.value } }));

  async function enregistrer() {
    const lots = estimation.map((l) => ({ coupeId: l.coupeId, paquetsEstimes: l.paquets, ...ligne(l) }));
    if (!window.confirm(`Enregistrer l'abattage de ${bete.numero} ? Elle sortira du troupeau et ses paquets entreront en stock.`)) return;
    await appeler(`/api/elevage/betes/${bete.id}/abattage`, "POST", { ...champs, lots });
  }

  const totalRecu = estimation.reduce((s, l) => s + nombre(ligne(l).nbPaquets), 0);
  const poidsRecu = estimation.reduce((s, l) => s + nombre(ligne(l).poidsTotal), 0);
  return (
    <>
      <div style={grille2}>
        <Champ label="Date d'abattage"><input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={champStyle} /></Champ>
        <Champ label="Abattoir"><input value={champs.abattoir} onChange={maj("abattoir")} style={champStyle} /></Champ>
        <Champ label="Poids vif (kg)"><input inputMode="decimal" value={champs.poidsVif} onChange={maj("poidsVif")} style={champStyle} /></Champ>
        <Champ label="Carcasse froide (kg)"><input inputMode="decimal" value={champs.poidsCarcasse} onChange={maj("poidsCarcasse")} style={champStyle} /></Champ>
        <Champ label="Persillage BMS (1 à 12)"><input inputMode="numeric" value={champs.bms} onChange={maj("bms")} style={champStyle} /></Champ>
        <Champ label="Frais abattage + découpe ($)"><input inputMode="decimal" value={champs.fraisAbattage} onChange={maj("fraisAbattage")} placeholder="0,00" style={champStyle} /></Champ>
      </div>
      {nombre(champs.poidsVif) > 0 && nombre(champs.poidsCarcasse) > 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Rendement carcasse : {decimal((nombre(champs.poidsCarcasse) / nombre(champs.poidsVif)) * 100)} %</p>
      )}
      <p style={{ fontSize: 12.5, margin: "4px 0 8px" }}>
        Paquets reçus du boucher — proposés selon les rendements, à corriger avec son compte réel :
      </p>
      <Tableau entetes={["Coupe", "Estimé", "Paquets reçus", "Poids total (kg)"]} alignDroite={[1]}>
        {estimation.map((l) => (
          <tr key={l.coupeId}>
            <td style={cellule}>{l.nom}</td>
            <td style={celluleDroite}>{l.paquets}</td>
            <td style={cellule}><input inputMode="numeric" value={ligne(l).nbPaquets} onChange={majRecu(l, "nbPaquets")} style={{ ...champStyle, marginBottom: 0, width: 70 }} /></td>
            <td style={cellule}><input inputMode="decimal" value={ligne(l).poidsTotal} onChange={majRecu(l, "poidsTotal")} style={{ ...champStyle, marginBottom: 0, width: 90 }} /></td>
          </tr>
        ))}
      </Tableau>
      <Encadre label="Total reçu" valeur={`${totalRecu} paquets · ${kg(poidsRecu)}`} />
      <div style={{ height: 10 }} />
      <Champ label="Notes"><textarea value={champs.notes} onChange={maj("notes")} rows={2} style={{ ...champStyle, resize: "vertical" }} /></Champ>
      <Erreur texte={erreur} />
      <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Enregistrer l'abattage et mettre les paquets en stock"}</button>
    </>
  );
}

// ---------- Après l'abattage : découpe, stock, ventes ----------

function Decoupe({ bete }) {
  const a = bete.abattage;
  const { appeler, enCours, erreur } = useApi();
  const [edition, setEdition] = useState(null); // id du lot corrigé
  const [etiquettes, setEtiquettes] = useState(false);
  const totaux = a.lots.reduce((t, l) => {
    const s = stockLot(l);
    return { recus: t.recus + l.nbPaquets, estimes: t.estimes + l.paquetsEstimes, stock: t.stock + s.paquets, poids: t.poids + l.poidsTotal };
  }, { recus: 0, estimes: 0, stock: 0, poids: 0 });
  const ventes = a.lots.flatMap((l) => l.ventes.map((v) => ({ ...v, coupe: l.coupe.nom }))).sort((x, y) => new Date(y.date) - new Date(x.date));

  async function annuler() {
    if (!window.confirm("Annuler l'abattage ? Ses paquets sortent du stock et la bête revient au troupeau.")) return;
    await appeler(`/api/elevage/betes/${bete.id}/abattage`, "DELETE");
  }

  return (
    <Section titre="Abattage et découpe" icone="outils" teinte={TEINTES.rouge}>
      <LigneDetail premiere label="Date" valeur={`${dateCourte(a.date)}${a.abattoir ? ` — ${a.abattoir}` : ""}`} />
      {a.poidsVif && <LigneDetail label="Poids vif" valeur={kg(a.poidsVif)} />}
      <LigneDetail label="Carcasse froide" valeur={`${kg(a.poidsCarcasse)}${a.poidsVif ? ` (rendement ${decimal((a.poidsCarcasse / a.poidsVif) * 100)} %)` : ""}`} />
      {a.bms && <LigneDetail label="Persillage" valeur={`BMS ${a.bms}`} />}
      <LigneDetail label="Viande en paquets" valeur={`${kg(totaux.poids)} (${decimal((totaux.poids / a.poidsCarcasse) * 100)} % de la carcasse)`} />
      {a.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{a.notes}</p>}

      <div style={{ marginTop: 10 }}>
        <Tableau entetes={["Coupe", "Estimé", "Reçus", "Poids", "Vendus", "En stock", ""]} alignDroite={[1, 2, 3, 4, 5]}>
          {a.lots.map((l) => {
            const s = stockLot(l);
            return edition === l.id ? (
              <CorrectionLot key={l.id} lot={l} onFin={() => setEdition(null)} />
            ) : (
              <tr key={l.id}>
                <td style={cellule}>{l.coupe.nom}</td>
                <td style={{ ...celluleDroite, color: "var(--text-muted)" }}>{l.paquetsEstimes}</td>
                <td style={celluleDroite}>{l.nbPaquets}</td>
                <td style={celluleDroite}>{kg(l.poidsTotal, 2)}</td>
                <td style={celluleDroite}>{s.vendus}</td>
                <td style={{ ...celluleDroite, fontWeight: 700 }}>{s.paquets}</td>
                <td style={cellule}><button onClick={() => setEdition(l.id)} style={{ ...boutonLien, color: "var(--accent-ombre)", fontWeight: 700, fontSize: 13 }}>Corriger</button></td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...cellule, fontWeight: 700 }}>Total</td>
            <td style={{ ...celluleDroite, color: "var(--text-muted)" }}>{totaux.estimes}</td>
            <td style={{ ...celluleDroite, fontWeight: 700 }}>{totaux.recus}</td>
            <td style={celluleDroite}>{kg(totaux.poids)}</td>
            <td style={celluleDroite}>{totaux.recus - totaux.stock}</td>
            <td style={{ ...celluleDroite, fontWeight: 700 }}>{totaux.stock}</td>
            <td style={cellule} />
          </tr>
        </Tableau>
      </div>

      {etiquettes ? (
        <EtiquettesElevage type="viande" beteId={bete.id} recus={totaux.recus} enStock={totaux.stock} onFermer={() => setEtiquettes(false)} />
      ) : (
        <div style={{ marginTop: 12 }}><BoutonAction icone="etiquette" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={() => setEtiquettes(true)} style={{ width: "100%" }}>Imprimer les étiquettes des paquets</BoutonAction></div>
      )}

      {ventes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Ventes de sa viande</div>
          {ventes.map((v, i) => <LigneVente key={v.id} vente={v} premiere={i === 0} />)}
        </div>
      )}
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>Les ventes s'entrent dans <Link href="/elevage/viande" style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>Élevage → Viande</Link> : en scannant l'étiquette du paquet, ou par coupe (les paquets les plus anciens partent en premier).</p>
      <Erreur texte={erreur} />
      {ventes.length === 0 && <div style={{ marginTop: 12 }}><BoutonAction icone="echange" couleur="var(--danger)" onClick={annuler} disabled={enCours} style={{ width: "100%" }}>Annuler l'abattage</BoutonAction></div>}
    </Section>
  );
}

// Une vente sur deux lignes : coupe et montant, puis date, canal, poids et
// note en petit. Le texte passe à la ligne au lieu de pousser le montant hors
// de l'écran sur un téléphone.
function LigneVente({ vente: v, premiere }) {
  const canal = CANAUX.find((c) => c.code === v.canal);
  return (
    <div style={{ padding: "9px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{v.nbPaquets} × {v.coupe}</span>
        <span style={{ fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{argent(v.montant)}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, overflowWrap: "anywhere" }}>
        {dateCourte(v.date)} · {canal?.icone} {canal?.label} · {kg(v.poids, 2)}{v.note && ` — ${v.note}`}
      </div>
    </div>
  );
}

function CorrectionLot({ lot, onFin }) {
  const [champs, setChamps] = useState({ nbPaquets: String(lot.nbPaquets), poidsTotal: String(lot.poidsTotal).replace(".", ",") });
  const { appeler, enCours, erreur } = useApi();
  async function enregistrer() {
    if (await appeler(`/api/elevage/lots/${lot.id}`, "PATCH", champs)) onFin();
  }
  return (
    <tr>
      <td style={cellule}>{lot.coupe.nom}<Erreur texte={erreur} /></td>
      <td style={celluleDroite}>{lot.paquetsEstimes}</td>
      <td style={cellule}><input inputMode="numeric" value={champs.nbPaquets} onChange={(e) => setChamps((c) => ({ ...c, nbPaquets: e.target.value }))} style={{ ...champStyle, marginBottom: 0, width: 60 }} /></td>
      <td style={cellule}><input inputMode="decimal" value={champs.poidsTotal} onChange={(e) => setChamps((c) => ({ ...c, poidsTotal: e.target.value }))} style={{ ...champStyle, marginBottom: 0, width: 80 }} /></td>
      <td style={cellule} colSpan={3}>
        <button onClick={enregistrer} disabled={enCours} style={{ ...boutonLien, color: "var(--accent)", fontWeight: 700 }}>OK</button>{" "}
        <button onClick={onFin} style={{ ...boutonLien, color: "var(--text-muted)" }}>Annuler</button>
      </td>
    </tr>
  );
}

// ---------- Pesées ----------

function Pesees({ bete, gmqCible }) {
  const recent = gmqRecent(bete.pesees);
  const suivie = enCroissance(bete);
  const sousCible = suivie && recent && recent.gmq < gmqCible;
  const [champs, setChamps] = useState({ date: aujourdhui(), poids: "", note: "" });
  const { appeler, enCours, erreur } = useApi();
  const liste = peseesAvecGain(bete.pesees).reverse();
  const gmq = gainMoyenQuotidien(bete.pesees);

  async function ajouter() {
    if (await appeler(`/api/elevage/betes/${bete.id}/pesees`, "POST", champs)) setChamps((c) => ({ ...c, poids: "", note: "" }));
  }
  async function retirer(id) {
    if (window.confirm("Retirer cette pesée ?")) await appeler(`/api/elevage/betes/${bete.id}/pesees?peseeId=${id}`, "DELETE");
  }

  return (
    <Section
      titre="Pesées" icone="graphique" teinte={TEINTES.bleu}
      sousTitre={gmq != null ? `Gain moyen ${decimal(gmq, 2)} kg/jour` : undefined}
    >
      {bete.pesees.length >= 2 && <CourbePoids pesees={bete.pesees} dateNaissance={bete.dateNaissance} />}
      {recent && bete.statut === "ACTIVE" && (
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", padding: "9px 12px", borderRadius: 12, color: sousCible ? "var(--danger)" : "var(--text)", background: sousCible ? "var(--danger-fond)" : "var(--surface-alt)" }}>
          {sousCible ? "⚠️ " : ""}Gain récent : {decimal(recent.gmq, 2)} kg/jour depuis le {dateCourte(recent.depuis)}
          {suivie && ` — cible ${decimal(gmqCible, 2)} kg/jour`}
        </p>
      )}
      {bete.statut === "ACTIVE" && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input type="date" max="9999-12-31" value={champs.date} onChange={(e) => setChamps((c) => ({ ...c, date: e.target.value }))} style={{ ...champStyle, marginBottom: 0 }} />
            <input inputMode="decimal" value={champs.poids} onChange={(e) => setChamps((c) => ({ ...c, poids: e.target.value }))} placeholder="Poids (kg)" style={{ ...champStyle, marginBottom: 0 }} />
          </div>
          <input value={champs.note} onChange={(e) => setChamps((c) => ({ ...c, note: e.target.value }))} placeholder="Note (sevrage, finition…)" style={{ ...champStyle, marginTop: 8, marginBottom: 8 }} />
          <BoutonAction icone="plus" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={ajouter} disabled={enCours} style={{ width: "100%" }}>Ajouter la pesée</BoutonAction>
        </div>
      )}
      <Erreur texte={erreur} />
      {liste.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune pesée.</p>
      ) : (
        liste.map((p, i) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{dateCourte(p.date)}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{[age(bete.dateNaissance, p.date), p.note].filter(Boolean).join(" · ")}</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{kg(p.poids)}</span>
                <span style={{ display: "block", fontSize: 12, color: p.gain == null ? "var(--text-muted)" : p.gain >= 0 ? "var(--success)" : "var(--danger)" }}>{p.gain == null ? "—" : `${p.gain >= 0 ? "+" : ""}${decimal(p.gain, 2)} kg/jour`}</span>
              </span>
              <BoutonRetirer titre="Retirer la pesée" onClick={() => retirer(p.id)} />
            </span>
          </div>
        ))
      )}
    </Section>
  );
}

// ---------- Santé et soins ----------

const SOIN_VIDE = { type: "VACCIN", produit: "", dose: "", retraitJours: "", rappelLe: "", note: "" };

function Soins({ bete }) {
  const [champs, setChamps] = useState({ date: aujourdhui(), ...SOIN_VIDE });
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const active = bete.statut === "ACTIVE";
  const retrait = active ? retraitEnCours(bete.soins) : null;
  const rappels = active ? rappelsAFaire(bete.soins) : [];

  async function ajouter() {
    if (await appeler(`/api/elevage/betes/${bete.id}/soins`, "POST", champs)) setChamps((c) => ({ ...c, ...SOIN_VIDE, type: c.type }));
  }
  async function retirer(id) {
    if (window.confirm("Retirer ce soin du registre ?")) await appeler(`/api/elevage/betes/${bete.id}/soins?soinId=${id}`, "DELETE");
  }

  return (
    <Section
      titre="Santé et soins" icone="bouclier" teinte={TEINTES.vert}
      sousTitre={retrait ? `En retrait jusqu'au ${dateCourte(retrait.fin)}` : bete.soins.length > 0 ? `${bete.soins.length} soin${bete.soins.length > 1 ? "s" : ""} au registre` : undefined}
    >
      {rappels.map((r) => {
        const jours = joursAvant(r.rappelLe);
        return (
          <p key={r.id} style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", padding: "9px 12px", borderRadius: 12, color: jours < 0 ? "var(--danger)" : "var(--text)", background: jours < 0 ? "var(--danger-fond)" : "rgba(232,163,61,0.16)" }}>
            🔔 {libelle(TYPES_SOIN, r.type).split(" (")[0]}{r.produit ? ` — ${r.produit}` : ""} à refaire le {dateCourte(r.rappelLe)}
            {jours < 0 ? ` (en retard de ${-jours} j)` : jours === 0 ? " (aujourd'hui)" : ` (dans ${jours} j)`}
          </p>
        );
      })}
      {active && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={grille2}>
            <Champ label="Date"><input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={champStyle} /></Champ>
            <Champ label="Type de soin">
              <select value={champs.type} onChange={maj("type")} style={champStyle}>
                {TYPES_SOIN.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </Champ>
            <Champ label="Produit ou motif"><input value={champs.produit} onChange={maj("produit")} placeholder="Nom du vaccin, du médicament…" style={champStyle} /></Champ>
            <Champ label="Dose"><input value={champs.dose} onChange={maj("dose")} placeholder="5 ml sous-cutané" style={champStyle} /></Champ>
            <Champ label="Délai de retrait (jours)"><input inputMode="numeric" value={champs.retraitJours} onChange={maj("retraitJours")} placeholder="Aucun" style={champStyle} /></Champ>
            <Champ label="Rappel à prévoir le"><input type="date" max="9999-12-31" value={champs.rappelLe} onChange={maj("rappelLe")} style={champStyle} /></Champ>
          </div>
          <input value={champs.note} onChange={maj("note")} placeholder="Note (vétérinaire, numéro de lot du produit…)" style={champStyle} />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Le délai de retrait bloque l'abattage jusqu'à son échéance. Le coût du soin s'entre dans les frais de la bête.</p>
          <BoutonAction icone="plus" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={ajouter} disabled={enCours} style={{ width: "100%" }}>Ajouter au registre</BoutonAction>
        </div>
      )}
      <Erreur texte={erreur} />
      {bete.soins.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun soin au registre.</p>
      ) : (
        bete.soins.map((s, i) => {
          const fin = finRetrait(s);
          const enRetrait = active && fin && dateCourte(fin) > aujourdhui();
          return (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{libelle(TYPES_SOIN, s.type).split(" (")[0]}{s.produit && ` — ${s.produit}`}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                  {[dateCourte(s.date), s.dose, s.rappelLe && `rappel le ${dateCourte(s.rappelLe)}`, s.note, s.creePar && `par ${s.creePar}`].filter(Boolean).join(" · ")}
                </div>
                {fin && <div style={{ fontSize: 12, fontWeight: 700, color: enRetrait ? "var(--danger)" : "var(--text-muted)" }}>Retrait de {s.retraitJours} j — {enRetrait ? "jusqu'au" : "terminé le"} {dateCourte(fin)}</div>}
              </div>
              <BoutonRetirer titre="Retirer ce soin" onClick={() => retirer(s.id)} />
            </div>
          );
        })
      )}
    </Section>
  );
}

// ---------- Frais ----------

function Frais({ bete }) {
  const [champs, setChamps] = useState({ date: aujourdhui(), categorie: "ALIMENTATION", description: "", montant: "" });
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const total = bete.frais.reduce((s, f) => s + f.montant, 0);

  async function ajouter() {
    if (await appeler(`/api/elevage/betes/${bete.id}/frais`, "POST", champs)) setChamps((c) => ({ ...c, description: "", montant: "" }));
  }
  async function retirer(id) {
    if (window.confirm("Retirer ces frais ?")) await appeler(`/api/elevage/betes/${bete.id}/frais?fraisId=${id}`, "DELETE");
  }

  return (
    <Section
      titre="Frais de la bête" icone="banque" teinte={TEINTES.ambre}
      droite={<span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", paddingTop: 2 }}>{argent(total)}</span>}
    >
      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={{ ...champStyle, marginBottom: 0 }} />
          <select value={champs.categorie} onChange={maj("categorie")} style={{ ...champStyle, marginBottom: 0 }}>
            {CATEGORIES_FRAIS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <input value={champs.description} onChange={maj("description")} placeholder="Description" style={{ ...champStyle, marginBottom: 0 }} />
          <input inputMode="decimal" value={champs.montant} onChange={maj("montant")} placeholder="Montant ($)" style={{ ...champStyle, marginBottom: 0 }} />
        </div>
        <BoutonAction icone="plus" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={ajouter} disabled={enCours} style={{ width: "100%" }}>Ajouter les frais</BoutonAction>
      </div>
      <Erreur texte={erreur} />
      {bete.frais.map((f, i) => (
        <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{libelle(CATEGORIES_FRAIS, f.categorie)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{dateCourte(f.date)}{f.description && ` · ${f.description}`}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <strong style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{argent(f.montant)}</strong>
            <BoutonRetirer titre="Retirer ces frais" onClick={() => retirer(f.id)} />
          </span>
        </div>
      ))}
    </Section>
  );
}

function Veaux({ veaux }) {
  return (
    <Section titre="Ses veaux" icone="utilisateurs" teinte={TEINTES.vert} droite={<Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>{veaux.length}</Pastille>}>
      {veaux.map((v, i) => {
        const st = STATUTS_BETE.find((x) => x.code === v.statut);
        return (
          <Link key={v.id} href={`/elevage/${v.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{v.numero}{v.nom ? ` — ${v.nom}` : ""}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{libelle(SEXES, v.sexe).split(" (")[0]}{v.dateNaissance && ` · né le ${dateCourte(v.dateNaissance)}`}</div>
            </div>
            <Pastille couleur={st?.couleur || "var(--text-muted)"} fond="var(--surface-alt)">{st?.label || v.statut}</Pastille>
            <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
          </Link>
        );
      })}
    </Section>
  );
}

// ---------- Sortie du troupeau sans abattage ----------

function Sortie({ bete }) {
  const router = useRouter();
  const [choix, setChoix] = useState(null); // "VENDUE" | "MORTE"
  const [champs, setChamps] = useState({ dateSortie: aujourdhui(), prixVente: "" });
  const { appeler, enCours, erreur } = useApi();

  async function confirmer(statut) {
    if (await appeler(`/api/elevage/betes/${bete.id}`, "PATCH", { sortie: { statut, ...champs } })) setChoix(null);
  }
  async function supprimer() {
    if (!window.confirm(`Supprimer la fiche ${bete.numero}, ses pesées et ses frais ? Seulement pour une fiche entrée par erreur.`)) return;
    if (await appeler(`/api/elevage/betes/${bete.id}`, "DELETE")) router.push("/elevage");
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {bete.statut === "ACTIVE" ? (
        choix ? (
          <div style={stylePanneau}>
            <TitrePanneau icone={choix === "VENDUE" ? "banque" : "alerte"} teinte={choix === "VENDUE" ? TEINTES.bleu : TEINTES.rouge} titre={choix === "VENDUE" ? "Vente sur pied" : "Bête morte"} />
            <div style={grille2}>
              <Champ label="Date"><input type="date" max="9999-12-31" value={champs.dateSortie} onChange={(e) => setChamps((c) => ({ ...c, dateSortie: e.target.value }))} style={champStyle} /></Champ>
              {choix === "VENDUE" && <Champ label="Prix de vente (avant taxes)"><input inputMode="decimal" value={champs.prixVente} onChange={(e) => setChamps((c) => ({ ...c, prixVente: e.target.value }))} style={champStyle} /></Champ>}
            </div>
            <Erreur texte={erreur} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => confirmer(choix)} disabled={enCours} className="bouton-3d" style={{ ...boutonPrincipal, width: "auto" }}>{choix === "VENDUE" ? "Confirmer la vente" : "Confirmer la mort"}</button>
              <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setChoix(null)}>Annuler</BoutonAction>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <BoutonAction icone="banque" compact onClick={() => setChoix("VENDUE")}>Vendue sur pied</BoutonAction>
            <BoutonAction icone="alerte" compact couleur="var(--avertissement)" onClick={() => setChoix("MORTE")}>Morte</BoutonAction>
            <BoutonAction icone="poubelle" compact couleur="var(--danger)" onClick={supprimer}>Supprimer</BoutonAction>
          </div>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <BoutonAction icone="echange" couleur="var(--accent-ombre)" onClick={() => confirmer("ACTIVE")} disabled={enCours}>Remettre au troupeau</BoutonAction>
          <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer}>Supprimer la fiche</BoutonAction>
        </div>
      )}
      {!choix && <Erreur texte={erreur} />}
    </div>
  );
}
