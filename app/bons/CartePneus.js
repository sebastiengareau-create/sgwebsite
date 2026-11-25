"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { argent } from "@/lib/format";
import { STATUTS_JEU, SEUILS_PNEUS_DEFAUT, libelleJeu, saisonAVenir, normaliserJeu, evaluerJeu, resumeEquipement, placesLibres, cleEmplacement } from "@/lib/pneusCalculs";
import { Icone, TEINTES, Pastille } from "../components/StyleSection";
import ChampsJeu, { champsDuJeu, SaisieUsures } from "../pneus/ChampsJeu";
import ChoixEmplacement from "../pneus/ChoixEmplacement";
import { PastilleEtat, EncadreEtat } from "../pneus/EtatJeu";

// Carte « Pneus entreposés » du bon (module Entreposage de pneus,
// lib/pneus.js) : les jeux du véhicule, et le changement de saison — le jeu
// entreposé est posé, celui qui sort du véhicule entre à l'entrepôt (à
// l'emplacement libéré), avec la tâche et le prix de l'entreposage ajoutés
// au bon. L'état de chaque jeu, et pour celui à poser, son équipement (clé
// antivol, serrage) et les conseils de pose. modifiable : bon pas encore
// facturé ; comptoir : accès « Opérations ».
export default function CartePneus({ bonId, clientId, vehiculeId, jeux, prixSaison, plan, seuils = SEUILS_PNEUS_DEFAUT, occupes = [], modifiable, comptoir }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState(null);
  const entrepose = jeux.filter((j) => j.statut === "ENTREPOSE");
  const poses = jeux.filter((j) => j.statut === "POSE");
  const peutChanger = modifiable && comptoir;
  const lienNouveau = `/pneus/nouveau?client=${clientId}${vehiculeId ? `&vehicule=${vehiculeId}` : ""}&bon=${bonId}`;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: TEINTES.bleu.fond, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="pneu" taille={20} couleur={TEINTES.bleu.couleur} />
        </span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>Pneus entreposés</div>
        <Link href={lienNouveau} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 999, textDecoration: "none", whiteSpace: "nowrap" }}>+ Inscrire un jeu</Link>
      </div>

      {jeux.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun jeu de pneus inscrit pour ce véhicule.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {jeux.map((j) => {
            const s = STATUTS_JEU[j.statut];
            const equipement = j.statut === "ENTREPOSE" ? resumeEquipement(j) : [];
            return (
              <Link key={j.id} href={`/pneus/${j.id}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", textDecoration: "none", color: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 12px", background: "var(--bg)" }}>
                <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 13.5 }}>
                  <b>{j.numero}</b> · {libelleJeu(j)}{j.marque ? ` · ${j.marque}` : ""}
                  {equipement.length > 0 && <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>🔧 {equipement.join(" · ")}</span>}
                </span>
                <PastilleEtat etat={evaluerJeu(j, seuils)} bonAussi={false} />
                <Pastille couleur={s.couleur} fond={s.fond}>{j.statut === "ENTREPOSE" ? `Entrepôt ${j.emplacement}` : s.libelle}</Pastille>
              </Link>
            );
          })}
        </div>
      )}

      {peutChanger && !ouvert && (
        <button type="button" onClick={() => { setOuvert(true); setMessage(null); }} className="bouton-3d" style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
          {entrepose.length ? "Changement de saison" : "Entreposer les pneus qui sortent du véhicule"}
        </button>
      )}
      {ouvert && (
        <ChangementSaison
          bonId={bonId} entrepose={entrepose} poses={poses} prixSaison={prixSaison} plan={plan} seuils={seuils} occupes={occupes}
          onFermer={() => setOuvert(false)}
          onFait={(texte) => { setOuvert(false); setMessage(texte); router.refresh(); }}
        />
      )}
      {message && <p role="status" style={{ fontSize: 13, color: "var(--success)", margin: "10px 0 0" }}>{message}</p>}
    </div>
  );
}

// Saison opposée, pour proposer celle du jeu qui sort du véhicule
const OPPOSEE = { HIVER: "ETE", ETE: "HIVER" };

function ChangementSaison({ bonId, entrepose, poses, prixSaison, plan, seuils, occupes, onFermer, onFait }) {
  const aVenir = saisonAVenir();
  const sortantDefaut = entrepose.find((j) => j.saison === aVenir.saison) || entrepose[0] || null;
  const [sortirId, setSortirId] = useState(sortantDefaut?.id || "");
  const sortant = entrepose.find((j) => j.id === sortirId) || null;
  // Ce qui entre à l'entrepôt : un jeu posé déjà suivi, un nouveau, ou rien
  const [entrer, setEntrer] = useState(poses[0]?.id || "nouveau");
  const [nouveau, setNouveau] = useState(() => ({ ...champsDuJeu(null), saison: OPPOSEE[sortantDefaut?.saison] || "", dimension: sortantDefaut?.dimension || "" }));
  const [emplacement, setEmplacement] = useState(sortantDefaut?.emplacement || "");
  const [usures, setUsures] = useState([]);
  const [tache, setTache] = useState(true);
  const [facturer, setFacturer] = useState(!!prixSaison);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const entre = entrer !== "";
  const entrant = poses.find((j) => j.id === entrer) || null;
  // Places : celle qui se libère, puis les libres du plan ; la place du jeu
  // posé n'est plus prise
  const autresOccupees = sortant ? occupes.filter((o) => cleEmplacement(o) !== cleEmplacement(sortant.emplacement)) : occupes;
  const libres = placesLibres(plan, occupes, 6);
  const equipement = sortant ? resumeEquipement(sortant) : [];

  function choisirSortant(id) {
    setSortirId(id);
    const j = entrepose.find((x) => x.id === id);
    // Le jeu entrant prend l'emplacement libéré, si on ne l'a pas changé
    if (j && (!emplacement || entrepose.some((x) => x.emplacement === emplacement))) setEmplacement(j.emplacement || "");
    if (j && entrer === "nouveau" && !nouveau.saison) setNouveau((n) => ({ ...n, saison: OPPOSEE[j.saison] || "" }));
  }

  async function confirmer(e) {
    e.preventDefault();
    setErreur("");
    if (!sortirId && !entre) return setErreur("Choisis le jeu à poser ou celui à entreposer.");
    if (entre && !emplacement.trim()) return setErreur("Indique l'emplacement à l'entrepôt (ex. A-12).");
    if (entrer === "nouveau") {
      const { erreur: invalide } = normaliserJeu(nouveau);
      if (invalide) return setErreur(invalide);
    }
    setEnCours(true);
    const res = await fetch("/api/pneus/changement", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bonId, sortirId: sortirId || null,
        entrerId: entre && entrer !== "nouveau" ? entrer : null,
        nouveau: entrer === "nouveau" ? nouveau : null,
        emplacement, usures: entrer !== "nouveau" ? usures : undefined, tache, facturer: facturer && entre,
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setErreur(data?.erreur || "Rien n'a été changé : vérifie la connexion et réessaie.");
    const n = data.taches?.length || 0;
    onFait(`Changement fait${n ? ` : ${n} ligne${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} au bon` : ""}.`);
  }

  return (
    <form onSubmit={confirmer} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
      {entrepose.length > 0 && (
        <fieldset style={groupe}>
          <legend style={legende}>Sortir de l&apos;entrepôt et poser</legend>
          {entrepose.map((j) => (
            <label key={j.id} style={choix}>
              <input type="radio" name="sortir" checked={sortirId === j.id} onChange={() => choisirSortant(j.id)} />
              <span><b>{j.numero}</b> · {libelleJeu(j)} · entrepôt <b>{j.emplacement}</b></span>
            </label>
          ))}
          <label style={choix}><input type="radio" name="sortir" checked={!sortirId} onChange={() => setSortirId("")} /> <span>Rien à poser</span></label>
          {sortant && (equipement.length > 0 || evaluerJeu(sortant, seuils).conseils.length > 0 || ["REMPLACER", "SURVEILLER"].includes(evaluerJeu(sortant, seuils).code)) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {equipement.length > 0 && <div style={{ fontSize: 13, padding: "8px 10px", borderRadius: 10, background: "var(--surface-alt)" }}>🔧 À la pose : {equipement.join(" · ")}</div>}
              <EncadreEtat jeu={sortant} seuils={seuils} />
            </div>
          )}
        </fieldset>
      )}

      <fieldset style={groupe}>
        <legend style={legende}>Entreposer ce qui sort du véhicule</legend>
        {poses.map((j) => (
          <label key={j.id} style={choix}>
            <input type="radio" name="entrer" checked={entrer === j.id} onChange={() => { setEntrer(j.id); setUsures([]); }} />
            <span><b>{j.numero}</b> · {libelleJeu(j)}</span>
          </label>
        ))}
        <label style={choix}><input type="radio" name="entrer" checked={entrer === "nouveau"} onChange={() => setEntrer("nouveau")} /> <span>Un jeu pas encore inscrit</span></label>
        {sortirId && <label style={choix}><input type="radio" name="entrer" checked={entrer === ""} onChange={() => setEntrer("")} /> <span>Rien (le client repart avec)</span></label>}
      </fieldset>

      {entrer === "nouveau" && <ChampsJeu champs={nouveau} onChange={setNouveau} seuils={seuils} compact />}

      {entre && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ChoixEmplacement valeur={emplacement} onChange={setEmplacement} libres={libres} occupes={autresOccupees} libere={sortant?.emplacement || null} />
          {entrant && <SaisieUsures jeu={entrant} valeurs={usures} onChange={setUsures} seuils={seuils} />}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={choix}><input type="checkbox" checked={tache} onChange={(e) => setTache(e.target.checked)} /> <span>Ajouter la tâche « Changement de pneus » au bon</span></label>
        {prixSaison && entre && (
          <label style={choix}><input type="checkbox" checked={facturer} onChange={(e) => setFacturer(e.target.checked)} /> <span>Ajouter l&apos;entreposage au bon ({argent(prixSaison)}, une saison)</span></label>
        )}
      </div>

      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 12, borderRadius: 12, fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
          {enCours ? "Enregistrement…" : "Confirmer"}
        </button>
        <button type="button" onClick={onFermer} style={{ padding: "0 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
      </div>
      {!entrepose.length && !poses.length && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Les pneus posés aujourd&apos;hui peuvent aussi être inscrits (« + Inscrire un jeu », sur le véhicule) pour le prochain changement.</p>
      )}
    </form>
  );
}

const groupe = { border: "1px solid var(--border)", borderRadius: 12, padding: "8px 12px 10px", margin: 0, display: "flex", flexDirection: "column", gap: 6 };
const legende = { fontSize: 12.5, fontWeight: 800, padding: "0 4px" };
const choix = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, cursor: "pointer" };
