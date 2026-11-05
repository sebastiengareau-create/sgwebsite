"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection, LigneInfo } from "../../components/ui";
import { ChampsBete, FICHE_VIDE } from "../TroupeauClient";
import {
  SEXES, GENETIQUES, STATUTS_BETE, CATEGORIES_FRAIS, CANAUX, libelle, age, dateCourte, argent, kg,
  dernierePesee, gainMoyenQuotidien, peseesAvecGain, estimerDecoupe, totauxDecoupe, carcasseDepuisVif, stockLot, coutBete, revenusBete,
} from "@/lib/elevageCalculs";
import {
  champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, Tableau, TableEstimation, cellule, celluleDroite, useApi, aujourdhui,
} from "../ui";

const nombre = (v) => Number(String(v ?? "").replace(",", ".").replace(/\s/g, "")) || 0;
const decimal = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", ",");

export default function BeteClient({ bete, femelles, coupes, rendementCarcasse }) {
  const statut = STATUTS_BETE.find((s) => s.code === bete.statut);
  return (
    <div className="conteneur-page">
      <Link href="/elevage" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au troupeau</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, margin: "10px 0 14px" }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>🐂 {bete.numero}{bete.nom && ` — ${bete.nom}`}</h1>
        <span style={{ fontSize: 12, fontWeight: 700, color: statut?.couleur }}>{statut?.label}{bete.dateSortie && ` le ${dateCourte(bete.dateSortie)}`}</span>
      </div>

      <Fiche bete={bete} femelles={femelles} />
      <Rentabilite bete={bete} />
      {bete.abattage ? <Decoupe bete={bete} /> : bete.statut === "ACTIVE" && <EstimationEtAbattage bete={bete} coupes={coupes} rendementCarcasse={rendementCarcasse} />}
      <Pesees bete={bete} />
      <Frais bete={bete} />
      {bete.veaux.length > 0 && <Veaux veaux={bete.veaux} />}
      {!bete.abattage && <Sortie bete={bete} />}
    </div>
  );
}

function Section({ titre, children, droite }) {
  return (
    <div className="carte" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <TitreSection>{titre}</TitreSection>
        {droite}
      </div>
      {children}
    </div>
  );
}

// ---------- Fiche ----------

function Fiche({ bete, femelles }) {
  const [edition, setEdition] = useState(false);
  const [fiche, setFiche] = useState(() => Object.fromEntries(Object.keys(FICHE_VIDE).map((k) => [k, k.startsWith("date") ? dateCourte(bete[k]) : bete[k] == null ? "" : String(bete[k])])));
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function enregistrer() {
    if (await appeler(`/api/elevage/betes/${bete.id}`, "PATCH", fiche)) setEdition(false);
  }

  const bouton = <button onClick={() => setEdition((v) => !v)} style={{ ...boutonLien, color: "var(--accent)" }}>{edition ? "Annuler" : "Modifier"}</button>;
  if (edition) {
    return (
      <Section titre="Fiche" droite={bouton}>
        <ChampsBete fiche={fiche} maj={maj} femelles={femelles} />
        <Erreur texte={erreur} />
        <button onClick={enregistrer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Enregistrer"}</button>
      </Section>
    );
  }
  return (
    <Section titre="Fiche" droite={bouton}>
      <LigneInfo label="Sexe" valeur={libelle(SEXES, bete.sexe)} />
      <LigneInfo label="Boucle d'oreille" valeur={bete.identifiant} />
      <LigneInfo label="Naissance" valeur={bete.dateNaissance && `${dateCourte(bete.dateNaissance)} (${age(bete.dateNaissance, bete.dateSortie || new Date())})`} />
      <LigneInfo label="Génétique" valeur={[bete.genetique && libelle(GENETIQUES, bete.genetique).split(" (")[0], bete.pourcentageWagyu != null && `${bete.pourcentageWagyu} % wagyu`].filter(Boolean).join(" · ")} />
      <LigneInfo label="Mère" valeur={bete.mere && <Link href={`/elevage/${bete.mere.id}`} style={{ color: "var(--accent)" }}>{bete.mere.numero}{bete.mere.nom ? ` — ${bete.mere.nom}` : ""}</Link>} />
      <LigneInfo label="Père" valeur={bete.pere} />
      <LigneInfo label="Origine" valeur={bete.origine === "ACHETEE" ? ["Achetée", bete.dateAcquisition && `le ${dateCourte(bete.dateAcquisition)}`, bete.provenance && `de ${bete.provenance}`, `pour ${argent(bete.coutAcquisition)}`].filter(Boolean).join(" ") : "Née ici"} />
      {bete.notes && <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{bete.notes}</p>}
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
    <Section titre="Coût de revient et ventes">
      {bete.coutAcquisition > 0 && <LigneInfo label="Achat de la bête" valeur={argent(bete.coutAcquisition)} />}
      {fraisParCategorie.map((c) => <LigneInfo key={c.code} label={c.label} valeur={argent(c.total)} />)}
      {bete.abattage && <LigneInfo label="Abattage et découpe" valeur={argent(bete.abattage.fraisAbattage)} />}
      <div className="ligne-info" style={{ fontWeight: 700 }}><span>Coût de revient</span><span>{argent(cout)}</span></div>
      {bete.abattage && cout > 0 && bete.abattage.poidsCarcasse > 0 && (
        <LigneInfo label="Coût par kg de carcasse" valeur={argent(cout / bete.abattage.poidsCarcasse)} />
      )}
      {bete.statut === "VENDUE" && <LigneInfo label="Vente sur pied" valeur={argent(bete.prixVente)} />}
      {bete.abattage && parCanal.map((c) => <LigneInfo key={c.code} label={`${c.icone} Ventes ${c.label.toLowerCase()}`} valeur={argent(c.total)} />)}
      {(revenus > 0 || bete.abattage) && (
        <div className="ligne-info" style={{ fontWeight: 700, color: revenus - cout >= 0 ? "var(--success)" : "var(--danger)" }}>
          <span>{valeurStock > 0 ? "Résultat à ce jour" : "Profit"}</span><span>{argent(revenus - cout)}</span>
        </div>
      )}
      {valeurStock > 0 && (
        <>
          <LigneInfo label="Viande en stock (prix boutique)" valeur={argent(valeurStock)} />
          <div className="ligne-info" style={{ fontWeight: 700, color: revenus + valeurStock - cout >= 0 ? "var(--success)" : "var(--danger)" }}>
            <span>Profit prévu (tout vendu en boutique)</span><span>{argent(revenus + valeurStock - cout)}</span>
          </div>
        </>
      )}
    </Section>
  );
}

// ---------- Avant l'abattage : estimation, puis abattage ----------

function EstimationEtAbattage({ bete, coupes, rendementCarcasse }) {
  const [abattre, setAbattre] = useState(false);
  const pesee = dernierePesee(bete.pesees);
  const carcasse = pesee ? carcasseDepuisVif(pesee.poids, rendementCarcasse) : 0;
  const lignes = estimerDecoupe(carcasse, coupes);
  const totaux = totauxDecoupe(lignes);

  return (
    <Section titre={abattre ? "Abattage et découpe" : "Si elle était abattue aujourd'hui"} droite={<button onClick={() => setAbattre((v) => !v)} style={{ ...boutonLien, color: "var(--accent)" }}>{abattre ? "Annuler" : "🔪 Abattage et découpe"}</button>}>
      {abattre ? (
        <FormulaireAbattage bete={bete} coupes={coupes} poidsVifInitial={pesee?.poids} carcasseInitiale={carcasse} />
      ) : !pesee ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Ajoute une pesée pour estimer la viande que donnera cette bête.</p>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 8px" }}>
            {kg(pesee.poids, 0)} vif (pesée du {dateCourte(pesee.date)}) × {rendementCarcasse} % = <strong style={{ color: "var(--text)" }}>{kg(carcasse, 0)} de carcasse</strong>, découpée selon les <Link href="/elevage/coupes" style={{ color: "var(--accent)" }}>rendements</Link> :
          </p>
          <TableEstimation lignes={lignes} />
          <p style={{ fontSize: 12.5, margin: "8px 0 0" }}>
            <strong>{totaux.paquets} paquets</strong> · {kg(totaux.poidsPaquets)} de viande{totaux.valeurBoutique > 0 && <> · <strong>{argent(totaux.valeurBoutique)}</strong> au prix boutique</>}
          </p>
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
      <p style={{ fontSize: 12.5, margin: "8px 0" }}><strong>{totalRecu} paquets</strong> · {kg(poidsRecu)}</p>
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
    <Section titre="Abattage et découpe">
      <LigneInfo label="Date" valeur={`${dateCourte(a.date)}${a.abattoir ? ` — ${a.abattoir}` : ""}`} />
      {a.poidsVif && <LigneInfo label="Poids vif" valeur={kg(a.poidsVif)} />}
      <LigneInfo label="Carcasse froide" valeur={`${kg(a.poidsCarcasse)}${a.poidsVif ? ` (rendement ${decimal((a.poidsCarcasse / a.poidsVif) * 100)} %)` : ""}`} />
      {a.bms && <LigneInfo label="Persillage" valeur={`BMS ${a.bms}`} />}
      <LigneInfo label="Viande en paquets" valeur={`${kg(totaux.poids)} (${decimal((totaux.poids / a.poidsCarcasse) * 100)} % de la carcasse)`} />
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
                <td style={cellule}><button onClick={() => setEdition(l.id)} style={{ ...boutonLien, color: "var(--accent)" }}>Corriger</button></td>
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

      {ventes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <TitreSection>Ventes de sa viande</TitreSection>
          {ventes.map((v) => (
            <div key={v.id} className="ligne-info">
              <span>{dateCourte(v.date)} · {CANAUX.find((c) => c.code === v.canal)?.icone} {v.nbPaquets} × {v.coupe} ({kg(v.poids, 2)}){v.note && ` — ${v.note}`}</span>
              <span>{argent(v.montant)}</span>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>Les ventes s'entrent dans <Link href="/elevage/viande" style={{ color: "var(--accent)" }}>Élevage → Viande</Link> : les paquets les plus anciens partent en premier.</p>
      <Erreur texte={erreur} />
      {ventes.length === 0 && <button onClick={annuler} disabled={enCours} style={{ ...boutonLien, color: "var(--danger)", marginTop: 10 }}>Annuler l'abattage</button>}
    </Section>
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

function Pesees({ bete }) {
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
    <Section titre="Pesées" droite={gmq != null && <span style={{ fontSize: 12, fontWeight: 700 }}>Gain moyen {decimal(gmq, 2)} kg/jour</span>}>
      {bete.statut === "ACTIVE" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: 6, alignItems: "start" }}>
          <input type="date" max="9999-12-31" value={champs.date} onChange={(e) => setChamps((c) => ({ ...c, date: e.target.value }))} style={champStyle} />
          <input inputMode="decimal" value={champs.poids} onChange={(e) => setChamps((c) => ({ ...c, poids: e.target.value }))} placeholder="Poids (kg)" style={champStyle} />
          <input value={champs.note} onChange={(e) => setChamps((c) => ({ ...c, note: e.target.value }))} placeholder="Note (sevrage, finition…)" style={champStyle} />
          <button onClick={ajouter} disabled={enCours} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>+</button>
        </div>
      )}
      <Erreur texte={erreur} />
      {liste.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune pesée.</p>
      ) : (
        <Tableau entetes={["Date", "Âge", "Poids", "Gain/jour", "Note", ""]} alignDroite={[2, 3]}>
          {liste.map((p) => (
            <tr key={p.id}>
              <td style={cellule}>{dateCourte(p.date)}</td>
              <td style={{ ...cellule, color: "var(--text-muted)" }}>{age(bete.dateNaissance, p.date)}</td>
              <td style={celluleDroite}>{kg(p.poids)}</td>
              <td style={celluleDroite}>{p.gain == null ? "—" : `${decimal(p.gain, 2)} kg`}</td>
              <td style={{ ...cellule, color: "var(--text-muted)" }}>{p.note}</td>
              <td style={cellule}><button onClick={() => retirer(p.id)} style={{ ...boutonLien, color: "var(--danger)" }}>✕</button></td>
            </tr>
          ))}
        </Tableau>
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
    <Section titre="Frais de la bête" droite={<span style={{ fontSize: 12, fontWeight: 700 }}>{argent(total)}</span>}>
      <div style={grille2}>
        <input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={champStyle} />
        <select value={champs.categorie} onChange={maj("categorie")} style={champStyle}>
          {CATEGORIES_FRAIS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input value={champs.description} onChange={maj("description")} placeholder="Description" style={champStyle} />
        <div style={{ display: "flex", gap: 6 }}>
          <input inputMode="decimal" value={champs.montant} onChange={maj("montant")} placeholder="Montant ($)" style={champStyle} />
          <button onClick={ajouter} disabled={enCours} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, height: 35 }}>+</button>
        </div>
      </div>
      <Erreur texte={erreur} />
      {bete.frais.map((f) => (
        <div key={f.id} className="ligne-info">
          <span>{dateCourte(f.date)} · {libelle(CATEGORIES_FRAIS, f.categorie)}{f.description && ` — ${f.description}`}</span>
          <span>{argent(f.montant)} <button onClick={() => retirer(f.id)} style={{ ...boutonLien, color: "var(--danger)", marginLeft: 6 }}>✕</button></span>
        </div>
      ))}
    </Section>
  );
}

function Veaux({ veaux }) {
  return (
    <Section titre={`Ses veaux (${veaux.length})`}>
      {veaux.map((v) => (
        <div key={v.id} className="ligne-info">
          <Link href={`/elevage/${v.id}`} style={{ color: "var(--accent)" }}>{v.numero}{v.nom ? ` — ${v.nom}` : ""}</Link>
          <span>{libelle(SEXES, v.sexe).split(" (")[0]}{v.dateNaissance && ` · né le ${dateCourte(v.dateNaissance)}`} · {libelle(STATUTS_BETE, v.statut)}</span>
        </div>
      ))}
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
          <div className="carte carte-m">
            <div style={grille2}>
              <Champ label="Date"><input type="date" max="9999-12-31" value={champs.dateSortie} onChange={(e) => setChamps((c) => ({ ...c, dateSortie: e.target.value }))} style={champStyle} /></Champ>
              {choix === "VENDUE" && <Champ label="Prix de vente (avant taxes)"><input inputMode="decimal" value={champs.prixVente} onChange={(e) => setChamps((c) => ({ ...c, prixVente: e.target.value }))} style={champStyle} /></Champ>}
            </div>
            <Erreur texte={erreur} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => confirmer(choix)} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{choix === "VENDUE" ? "Confirmer la vente sur pied" : "Confirmer la mort"}</button>
              <button onClick={() => setChoix(null)} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <button onClick={() => setChoix("VENDUE")} style={{ ...boutonLien, color: "var(--text-muted)" }}>Vendue sur pied…</button>
            <button onClick={() => setChoix("MORTE")} style={{ ...boutonLien, color: "var(--text-muted)" }}>Morte…</button>
            <button onClick={supprimer} style={{ ...boutonLien, color: "var(--danger)", marginLeft: "auto" }}>Supprimer la fiche</button>
          </div>
        )
      ) : (
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => confirmer("ACTIVE")} disabled={enCours} style={{ ...boutonLien, color: "var(--accent)" }}>↩ Remettre au troupeau</button>
          <button onClick={supprimer} style={{ ...boutonLien, color: "var(--danger)", marginLeft: "auto" }}>Supprimer la fiche</button>
        </div>
      )}
      {!choix && <Erreur texte={erreur} />}
    </div>
  );
}
