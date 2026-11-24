"use client";

import { SAISONS, JANTES, ANTIVOL, SEUILS_PNEUS_DEFAUT, positionsPour, pneusDuJeu, libellePosition, lireDot, ageDot } from "@/lib/pneusCalculs";

// Champs d'un jeu de pneus (nouveau jeu, fiche, changement de saison sur le
// bon). champs : valeurs en texte ; onChange reçoit les champs modifiés.
// emplacement : élément à afficher pour l'emplacement à l'entrepôt (voir
// ChoixEmplacement), ou rien. compact : sans marque, modèle ni note
// (changement de saison). seuils : pour colorer l'usure de chaque pneu.
export default function ChampsJeu({ champs, onChange, emplacement = null, compact = false, seuils = SEUILS_PNEUS_DEFAUT }) {
  const changer = (cle) => (e) => onChange({ ...champs, [cle]: e.target.value });
  const avecDot = champs.pneus.some((p) => lireDot(p.dot));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div role="group" aria-label="Saison" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(SAISONS).map(([cle, s]) => (
          <button
            key={cle} type="button" aria-pressed={champs.saison === cle} onClick={() => onChange({ ...champs, saison: cle })}
            style={{
              flex: "1 1 90px", padding: "9px 8px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer",
              border: `1.5px solid ${champs.saison === cle ? "var(--accent)" : "var(--border)"}`,
              background: champs.saison === cle ? "rgba(232,163,61,0.14)" : "var(--surface)", color: "var(--text)",
            }}
          >
            {s.libelle}
          </button>
        ))}
      </div>
      <div style={rangee}>
        <Champ libelle="Dimension" largeur="1 1 140px"><input value={champs.dimension} onChange={changer("dimension")} placeholder="225/65R17" className="champ" style={{ ...grand, textTransform: "uppercase" }} /></Champ>
        <Champ libelle="Quantité" largeur="0 1 80px">
          <input value={champs.quantite} onChange={(e) => onChange({ ...champs, quantite: e.target.value, pneus: ajusterPneus(champs.pneus, e.target.value) })} inputMode="numeric" className="champ" style={grand} />
        </Champ>
        <Champ libelle="Jantes" largeur="1 1 170px">
          <select value={champs.jantes} onChange={changer("jantes")} className="champ" style={grand}>
            {Object.entries(JANTES).map(([cle, libelle]) => <option key={cle} value={cle}>{libelle}</option>)}
          </select>
        </Champ>
      </div>
      {!compact && (
        <div style={rangee}>
          <Champ libelle="Marque" largeur="1 1 140px"><input value={champs.marque} onChange={changer("marque")} placeholder="Michelin" className="champ" style={grand} /></Champ>
          <Champ libelle="Modèle" largeur="1 1 160px"><input value={champs.modele} onChange={changer("modele")} placeholder="X-Ice Snow" className="champ" style={grand} /></Champ>
        </div>
      )}

      <DetailPneus pneus={champs.pneus} onChange={(pneus) => onChange({ ...champs, pneus })} seuils={seuils} />
      {!avecDot && (
        <Champ libelle="Année de fabrication (si le code DOT n'est pas lisible)" largeur="0 0 auto">
          <input value={champs.anneeFabrication} onChange={changer("anneeFabrication")} inputMode="numeric" placeholder="2021" className="champ" style={{ ...grand, maxWidth: 140 }} />
        </Champ>
      )}

      {emplacement}

      <Equipement champs={champs} onChange={onChange} />

      {!compact && (
        <Champ libelle="Note">
          <input value={champs.note} onChange={changer("note")} placeholder="ex. Écrous chromés dans le sac" className="champ" style={grand} />
        </Champ>
      )}
    </div>
  );
}

// Couleur d'une usure (/32 po) selon les seuils de l'état d'un jeu
export function couleurUsure(usure, seuils = SEUILS_PNEUS_DEFAUT) {
  if (usure == null || usure === "" || Number.isNaN(Number(usure))) return null;
  const n = Number(String(usure).replace(",", "."));
  if (n <= seuils.usureRemplacer) return "var(--danger)";
  if (n <= seuils.usureSurveiller) return "var(--avertissement)";
  return "var(--success)";
}

// Pneu par pneu : usure, code DOT (âge calculé), pneu endommagé à remplacer
// et remarque — disposés comme sur le véhicule (gauche, droite)
function DetailPneus({ pneus, onChange, seuils }) {
  const changer = (i, cle, valeur) => onChange(pneus.map((p, k) => (k === i ? { ...p, [cle]: valeur } : p)));
  const premierDot = lireDot(pneus[0]?.dot);
  const sansDot = pneus.filter((p, i) => i > 0 && !String(p.dot || "").trim()).length;
  return (
    <fieldset style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "8px 10px 10px", margin: 0, minWidth: 0 }}>
      <legend style={{ fontSize: 12.5, fontWeight: 800, padding: "0 4px" }}>Pneu par pneu</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {pneus.map((p, i) => {
          const couleur = p.remplacer ? "var(--danger)" : couleurUsure(String(p.usure).replace(",", "."), seuils);
          const dot = lireDot(p.dot);
          const age = dot ? ageDot(dot) : null;
          return (
            <div key={i} style={{ border: "1px solid var(--border)", borderLeft: `4px solid ${couleur || "var(--border)"}`, borderRadius: 10, padding: "7px 8px 8px", background: "var(--bg)", minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{libellePosition(p.position)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <label style={{ flex: "1 1 0", minWidth: 0 }}>
                  <span style={petiteEtiquette}>Usure /32</span>
                  <input value={p.usure} onChange={(e) => changer(i, "usure", e.target.value)} inputMode="decimal" placeholder="8" className="champ" style={{ fontSize: 15, padding: "7px 8px" }} aria-label={`Usure du pneu ${libellePosition(p.position).toLowerCase()}, en 32es de pouce`} />
                </label>
                <label style={{ flex: "1.3 1 0", minWidth: 0 }}>
                  <span style={petiteEtiquette}>DOT{age != null ? ` · ${age} an${age > 1 ? "s" : ""}` : ""}</span>
                  <input value={p.dot} onChange={(e) => changer(i, "dot", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="2321" className="champ" style={{ fontSize: 15, padding: "7px 8px" }} aria-label={`Code DOT du pneu ${libellePosition(p.position).toLowerCase()} (4 derniers chiffres)`} />
                </label>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 6, cursor: "pointer", color: p.remplacer ? "var(--danger)" : "var(--text-muted)" }}>
                <input type="checkbox" checked={!!p.remplacer} onChange={(e) => changer(i, "remplacer", e.target.checked)} /> Endommagé, à remplacer
              </label>
              {(p.remplacer || p.note) && (
                <input value={p.note} onChange={(e) => changer(i, "note", e.target.value)} placeholder="ex. Hernie sur le flanc" className="champ" style={{ fontSize: 13, padding: "6px 8px", marginTop: 5 }} aria-label="Remarque sur ce pneu" />
              )}
            </div>
          );
        })}
      </div>
      {premierDot && sansDot > 0 && (
        <button type="button" onClick={() => onChange(pneus.map((p, i) => (i > 0 && !String(p.dot || "").trim() ? { ...p, dot: premierDot.code } : p)))} style={lienBouton}>
          Copier le DOT {premierDot.code} sur les {sansDot} autre{sansDot > 1 ? "s" : ""} pneu{sansDot > 1 ? "s" : ""}
        </button>
      )}
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 0" }}>Code DOT : les 4 derniers chiffres sur le flanc (semaine, puis année : 2321 = 23e semaine de 2021).</p>
    </fieldset>
  );
}

// Roues et équipement gardés avec le jeu, rappelés à la pose
function Equipement({ champs, onChange }) {
  const changer = (cle) => (e) => onChange({ ...champs, [cle]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const rempli = !!(champs.antivol || champs.capteurs || champs.enjoliveurs || champs.couple || champs.pression);
  return (
    <details open={rempli} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "8px 10px" }}>
      <summary style={{ fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Roues et équipement{rempli ? "" : " (clé antivol, capteurs, serrage…)"}</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        <Champ libelle="Boulons antivol">
          <select value={champs.antivol} onChange={changer("antivol")} className="champ" style={grand}>
            <option value="">Pas de boulons antivol</option>
            {Object.entries(ANTIVOL).map(([cle, libelle]) => <option key={cle} value={cle}>{libelle}</option>)}
          </select>
        </Champ>
        <label style={caseACocher}><input type="checkbox" checked={!!champs.capteurs} onChange={changer("capteurs")} /> Capteurs de pression (TPMS) sur les jantes</label>
        <label style={caseACocher}><input type="checkbox" checked={!!champs.enjoliveurs} onChange={changer("enjoliveurs")} /> Enjoliveurs ou chapeaux de roue avec le jeu</label>
        <div style={rangee}>
          <Champ libelle="Couple de serrage (lb-pi)" largeur="1 1 140px"><input value={champs.couple} onChange={changer("couple")} inputMode="numeric" placeholder="100" className="champ" style={grand} /></Champ>
          <Champ libelle="Pression (lb/po²)" largeur="1 1 140px"><input value={champs.pression} onChange={changer("pression")} inputMode="numeric" placeholder="35" className="champ" style={grand} /></Champ>
        </div>
      </div>
    </details>
  );
}

// Nouvelles mesures d'usure à l'entrée à l'entrepôt, une par pneu (vide :
// inchangée). valeurs : tableau de textes ; actuel : le jeu (positions et
// dernières mesures en indice)
export function SaisieUsures({ jeu, valeurs, onChange, seuils = SEUILS_PNEUS_DEFAUT }) {
  const detail = pneusDuJeu(jeu);
  return (
    <fieldset style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "6px 10px 10px", margin: 0, minWidth: 0 }}>
      <legend style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 4px" }}>Usure mesurée (/32 po) — vide : inchangée</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 110px), 1fr))", gap: 6 }}>
        {detail.map((p, i) => {
          const couleur = couleurUsure(String(valeurs[i] ?? "").replace(",", ".") || null, seuils);
          return (
            <label key={i} style={{ minWidth: 0 }}>
              <span style={petiteEtiquette}>{libellePosition(p.position)}</span>
              <input
                value={valeurs[i] ?? ""} onChange={(e) => onChange(detail.map((_, k) => (k === i ? e.target.value : valeurs[k] ?? "")))}
                inputMode="decimal" placeholder={p.usure != null ? String(p.usure).replace(".", ",") : "8"} className="champ"
                style={{ fontSize: 15, padding: "7px 8px", ...(couleur && { borderColor: couleur }) }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Champ({ libelle, largeur = "1 1 auto", children }) {
  return (
    <label style={{ flex: largeur, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{libelle}</span>
      {children}
    </label>
  );
}

const pneuVide = (position) => ({ position, usure: "", dot: "", remplacer: false, note: "" });

// Lignes du détail pour une nouvelle quantité : les valeurs gardées dans
// l'ordre, les positions refaites
function ajusterPneus(pneus, quantite) {
  const q = Math.round(Number(quantite));
  if (!(q >= 1 && q <= 12)) return pneus;
  return positionsPour(q).map((position, i) => ({ ...pneuVide(position), ...(pneus[i] || {}), position }));
}

// Champs d'un jeu en texte (formulaires), à partir d'un jeu enregistré
export function champsDuJeu(jeu) {
  const texte = (n) => (n == null ? "" : String(n).replace(".", ","));
  return {
    saison: jeu?.saison || "", dimension: jeu?.dimension || "", marque: jeu?.marque || "", modele: jeu?.modele || "",
    quantite: String(jeu?.quantite ?? 4), jantes: jeu?.jantes || "SANS", anneeFabrication: jeu?.anneeFabrication ? String(jeu.anneeFabrication) : "",
    pneus: pneusDuJeu(jeu || { quantite: 4 }).map((p) => ({ position: p.position, usure: texte(p.usure), dot: p.dot || "", remplacer: p.remplacer, note: p.note || "" })),
    antivol: jeu?.antivol || "", capteurs: !!jeu?.capteurs, enjoliveurs: !!jeu?.enjoliveurs, couple: texte(jeu?.couple), pression: texte(jeu?.pression),
    emplacement: jeu?.emplacement || "", note: jeu?.note || "",
  };
}

const rangee = { display: "flex", gap: 8, flexWrap: "wrap" };
const grand = { fontSize: 15 };
const petiteEtiquette = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const caseACocher = { display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" };
const lienBouton = { background: "none", border: "none", padding: 0, marginTop: 8, fontSize: 12.5, color: "var(--accent-ombre)", fontWeight: 700, cursor: "pointer", textAlign: "left" };
