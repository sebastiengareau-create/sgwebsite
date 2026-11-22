"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { libelleVehicule } from "@/lib/vehicules";
import { STATUTS_JEU, JANTES, TYPES_MOUVEMENT, FORMATS_ETIQUETTES_PNEUS, libelleJeu, libelleJeuMinuscule, normaliserJeu } from "@/lib/pneusCalculs";
import { Pastille } from "../../components/StyleSection";
import ChampsJeu, { champsDuJeu } from "../ChampsJeu";

const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const CLE_FORMAT = "pneus_format_etiquettes";

export default function JeuClient({ jeuInitial, autres }) {
  const router = useRouter();
  const [jeu, setJeu] = useState(jeuInitial);
  const [geste, setGeste] = useState(null); // "entreposer" | "deplacer" | "remettre" | null
  const [emplacement, setEmplacement] = useState("");
  const [usure, setUsure] = useState("");
  const [note, setNote] = useState("");
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState(() => champsDuJeu(jeuInitial));
  const [vehiculeId, setVehiculeId] = useState(jeuInitial.vehiculeId || "");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  // Fiche relue du serveur (router.refresh, ex. historique après un geste)
  const [lu, setLu] = useState(jeuInitial);
  if (jeuInitial !== lu) {
    setLu(jeuInitial);
    setJeu(jeuInitial);
  }
  const statut = STATUTS_JEU[jeu.statut];

  async function appel(url, options) {
    setEnCours(true);
    setMessage(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) {
      setMessage({ texte: data?.erreur || "Rien n'a été enregistré : vérifie la connexion et réessaie.", erreur: true });
      return null;
    }
    return data;
  }

  async function faire(action) {
    const data = await appel(`/api/pneus/${jeu.id}/geste`, { method: "POST", body: JSON.stringify({ action, emplacement, usure, note }) });
    if (!data) return;
    setGeste(null);
    setEmplacement("");
    setUsure("");
    setNote("");
    setMessage({ texte: { sortir: "Sorti de l'entrepôt : posé sur le véhicule.", entreposer: `Entreposé à ${data.emplacement}.`, deplacer: `Déplacé à ${data.emplacement}.`, remettre: "Remis au client." }[action] });
    router.refresh(); // historique
    setJeu((j) => ({ ...j, ...data }));
  }

  async function enregistrerFiche(e) {
    e.preventDefault();
    const { erreur } = normaliserJeu(champs);
    if (erreur) return setMessage({ texte: erreur, erreur: true });
    const { emplacement: _, ...sansEmplacement } = champs;
    const data = await appel(`/api/pneus/${jeu.id}`, { method: "PATCH", body: JSON.stringify({ ...sansEmplacement, vehiculeId: vehiculeId || null }) });
    if (!data) return;
    setJeu((j) => ({ ...j, ...data, vehicule: jeu.client.vehicules.find((v) => v.id === data.vehiculeId) || null }));
    setEdition(false);
    setMessage({ texte: "Fiche enregistrée." });
  }

  async function supprimer() {
    const data = await appel(`/api/pneus/${jeu.id}`, { method: "DELETE" });
    if (!data) return;
    router.push("/pneus");
    router.refresh();
  }

  return (
    <div className="conteneur-page" style={{ paddingBottom: 40 }}>
      <Link href="/pneus" style={{ display: "inline-block", color: "var(--text-muted)", fontSize: 12.5, textDecoration: "none", marginBottom: 10 }}>← Entreposage de pneus</Link>

      {/* Où est le jeu */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{jeu.numero}</h1>
          <Pastille couleur={statut.couleur} fond={statut.fond}>{statut.libelle}</Pastille>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{libelleJeu(jeu)}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {[jeu.quantite + " pneu" + (jeu.quantite > 1 ? "s" : ""), JANTES[jeu.jantes], [jeu.marque, jeu.modele].filter(Boolean).join(" "), jeu.anneeFabrication && `fabriqués en ${jeu.anneeFabrication}`].filter(Boolean).join(" · ")}
        </div>
        {jeu.usure && <div style={{ fontSize: 13, marginTop: 2 }}>Usure : {jeu.usure} (/32 po)</div>}
        {jeu.note && <div style={{ fontSize: 13, marginTop: 2 }}>Note : {jeu.note}</div>}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
          <div><b>{jeu.client.nom}</b>{jeu.client.telephone ? <span style={{ color: "var(--text-muted)" }}> · {jeu.client.telephone}</span> : null}</div>
          <div style={{ color: "var(--text-muted)" }}>{jeu.vehicule ? `${libelleVehicule(jeu.vehicule)}${jeu.vehicule.plaque ? ` · ${jeu.vehicule.plaque}` : ""}` : "Véhicule non précisé"}</div>
        </div>
        {jeu.statut === "ENTREPOSE" && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "var(--bleu-fond)", display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Emplacement</span>
            <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{jeu.emplacement}</span>
          </div>
        )}
        {autres.length > 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
            Aussi pour ce véhicule :{" "}
            {autres.map((a, i) => (
              <span key={a.id}>{i > 0 && ", "}<Link href={`/pneus/${a.id}`} style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>{a.numero}</Link> ({libelleJeuMinuscule(a)}, {a.statut === "ENTREPOSE" ? `entrepôt ${a.emplacement}` : "sur le véhicule"})</span>
            ))}
          </div>
        )}
      </div>

      {/* Gestes */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {jeu.statut === "ENTREPOSE" && <button type="button" disabled={enCours} onClick={() => faire("sortir")} className="bouton-3d" style={boutonPlein}>Sortir et poser sur le véhicule</button>}
        {jeu.statut !== "ENTREPOSE" && <button type="button" onClick={() => setGeste(geste === "entreposer" ? null : "entreposer")} className="bouton-3d" style={boutonPlein}>Entreposer</button>}
        {jeu.statut === "ENTREPOSE" && <button type="button" onClick={() => setGeste(geste === "deplacer" ? null : "deplacer")} style={boutonContour}>Changer d&apos;emplacement</button>}
        {jeu.statut !== "REMIS" && <button type="button" onClick={() => setGeste(geste === "remettre" ? null : "remettre")} style={boutonContour}>Remettre au client</button>}
      </div>

      {geste && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {(geste === "entreposer" || geste === "deplacer") && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ flex: "0 1 140px" }}>
                <span style={etiquette}>{geste === "deplacer" ? "Nouvel emplacement" : "Emplacement"}</span>
                <input value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="A-12" className="champ" autoFocus style={{ fontSize: 15, textTransform: "uppercase" }} />
              </label>
              {geste === "entreposer" && (
                <label style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <span style={etiquette}>Usure par pneu (/32 po)</span>
                  <input value={usure} onChange={(e) => setUsure(e.target.value)} placeholder={jeu.usure || "8, 8, 7, 7"} className="champ" style={{ fontSize: 15 }} />
                </label>
              )}
            </div>
          )}
          <label>
            <span style={etiquette}>Note (facultative)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={geste === "remettre" ? "ex. Repris par le client, ou jeté (usés)" : ""} className="champ" style={{ fontSize: 15 }} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={enCours} onClick={() => faire(geste)} className="bouton-3d" style={boutonPlein}>
              {{ entreposer: "Entreposer", deplacer: "Déplacer", remettre: "Confirmer la remise" }[geste]}
            </button>
            <button type="button" onClick={() => setGeste(null)} style={boutonContour}>Annuler</button>
          </div>
        </div>
      )}

      {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 13.5, color: message.erreur ? "var(--danger)" : "var(--success)", margin: "0 0 12px" }}>{message.texte}</p>}

      <Etiquettes jeu={jeu} />

      {/* Fiche */}
      <section style={panneau}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: edition ? 10 : 0 }}>
          <h2 style={titre}>Fiche du jeu</h2>
          {!edition && <button type="button" onClick={() => setEdition(true)} style={boutonContour}>Modifier</button>}
        </div>
        {edition && (
          <form onSubmit={enregistrerFiche} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label>
              <span style={etiquette}>Véhicule</span>
              <select value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)} className="champ" style={{ fontSize: 15 }}>
                {jeu.client.vehicules.map((v) => <option key={v.id} value={v.id}>{libelleVehicule(v)}{v.plaque ? ` · ${v.plaque}` : ""}</option>)}
                <option value="">Non précisé</option>
              </select>
            </label>
            <ChampsJeu champs={champs} onChange={setChamps} emplacement={false} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={enCours} className="bouton-3d" style={boutonPlein}>Enregistrer</button>
              <button type="button" onClick={() => { setEdition(false); setChamps(champsDuJeu(jeu)); }} style={boutonContour}>Annuler</button>
            </div>
          </form>
        )}
      </section>

      {/* Historique */}
      <section style={panneau}>
        <h2 style={{ ...titre, marginBottom: 8 }}>Historique</h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {jeu.mouvements.map((m, i) => (
            <div key={m.id} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <b>{TYPES_MOUVEMENT[m.type] || m.type}{m.emplacement && m.type !== "SORTIE" && m.type !== "REMISE" ? ` · ${m.emplacement}` : ""}</b>
                <span style={{ color: "var(--text-muted)" }}>{DATE_HEURE.format(new Date(m.date))}</span>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                {[m.usure && `usure ${m.usure}`, m.bon && <Link key="bon" href={`/bons/${m.bon.id}`} style={{ color: "var(--accent-ombre)", fontWeight: 700 }}>bon #{m.bon.numero}</Link>, m.employeNom, m.note]
                  .filter(Boolean).map((x, k) => <span key={k}>{k > 0 && " · "}{x}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {confirmerSuppression ? (
        <div style={{ border: "1px solid var(--danger)", borderRadius: 12, padding: 12 }}>
          <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>Supprimer {jeu.numero} et son historique ? À faire seulement pour un jeu inscrit par erreur : un jeu rendu au client se marque « Remis ».</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={supprimer} disabled={enCours} style={{ ...boutonContour, color: "var(--danger)", borderColor: "var(--danger)" }}>Oui, supprimer</button>
            <button type="button" onClick={() => setConfirmerSuppression(false)} style={boutonContour}>Annuler</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmerSuppression(true)} style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer" }}>
          Supprimer ce jeu (inscrit par erreur)
        </button>
      )}
    </div>
  );
}

// Étiquettes à code QR : une par pneu, ouvertes en PDF dans un nouvel onglet
function Etiquettes({ jeu }) {
  const [format, setFormat] = useState(() => {
    try { return localStorage.getItem(CLE_FORMAT) || FORMATS_ETIQUETTES_PNEUS[0].code; } catch { return FORMATS_ETIQUETTES_PNEUS[0].code; }
  });
  const [copies, setCopies] = useState(String(jeu.quantite));
  const [depart, setDepart] = useState("1");
  const [erreur, setErreur] = useState("");
  const parFeuille = FORMATS_ETIQUETTES_PNEUS.find((f) => f.code === format)?.parFeuille || 1;

  async function imprimer() {
    setErreur("");
    try { localStorage.setItem(CLE_FORMAT, format); } catch { /* préférence non gardée */ }
    // Onglet ouvert au clic : ouvert après la réponse, il serait bloqué
    const onglet = window.open("", "_blank");
    const res = await fetch("/api/pneus/etiquettes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jeuId: jeu.id, copies, format, depart: parFeuille > 1 ? Math.min(parFeuille, Math.max(1, parseInt(depart) || 1)) : 1, origine: window.location.origin }),
    }).catch(() => null);
    if (!res?.ok) {
      onglet?.close();
      const data = await res?.json().catch(() => ({}));
      return setErreur(data?.erreur || "Les étiquettes n'ont pas pu être créées.");
    }
    const url = URL.createObjectURL(await res.blob());
    if (onglet) onglet.location.href = url;
    else { const lien = document.createElement("a"); lien.href = url; lien.download = `etiquettes-${jeu.numero}.pdf`; lien.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <section style={panneau}>
      <h2 style={{ ...titre, marginBottom: 4 }}>Étiquettes</h2>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>Une par pneu, avec un code QR : la caméra du téléphone ouvre cette fiche.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ flex: "1 1 220px", minWidth: 0 }}>
          <span style={etiquette}>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="champ" style={{ fontSize: 14 }}>
            {FORMATS_ETIQUETTES_PNEUS.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
          </select>
        </label>
        <label style={{ flex: "0 1 80px" }}>
          <span style={etiquette}>Copies</span>
          <input value={copies} onChange={(e) => setCopies(e.target.value)} inputMode="numeric" className="champ" style={{ fontSize: 14 }} />
        </label>
        {parFeuille > 1 && (
          <label style={{ flex: "0 1 110px" }}>
            <span style={etiquette}>Commencer à la</span>
            <input value={depart} onChange={(e) => setDepart(e.target.value)} inputMode="numeric" className="champ" style={{ fontSize: 14 }} />
          </label>
        )}
        <button type="button" onClick={imprimer} style={boutonContour}>🖨️ Imprimer</button>
      </div>
      {erreur && <p role="alert" style={{ fontSize: 12.5, color: "var(--danger)", margin: "6px 0 0" }}>{erreur}</p>}
    </section>
  );
}

const panneau = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 12 };
const titre = { fontSize: 15, fontWeight: 800, margin: 0 };
const etiquette = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };
const boutonPlein = { padding: "10px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer" };
const boutonContour = { padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };
