"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { libelleVehicule } from "@/lib/vehicules";
import { normaliserJeu, placesLibres } from "@/lib/pneusCalculs";
import ChampsJeu, { champsDuJeu } from "../ChampsJeu";
import ChoixEmplacement from "../ChoixEmplacement";

export default function FormulaireJeu({ clients, clientInitial, vehiculeInitial, bonRetour, emplacementInitial = "", plan, seuils, occupes }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clientInitial);
  const [recherche, setRecherche] = useState("");
  const client = clients.find((c) => c.id === clientId) || null;
  const [vehiculeId, setVehiculeId] = useState(() => (client?.vehicules.some((v) => v.id === vehiculeInitial) ? vehiculeInitial : client?.vehicules[0]?.id || ""));
  const [statut, setStatut] = useState("ENTREPOSE");
  const [champs, setChamps] = useState(() => ({ ...champsDuJeu(null), emplacement: emplacementInitial }));
  const libres = placesLibres(plan, occupes, 6);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const mots = recherche.toLowerCase().split(/\s+/).filter(Boolean);
  const trouves = mots.length
    ? clients.filter((c) => mots.every((m) => [c.nom, c.telephone, c.numero, ...c.vehicules.map((v) => v.plaque)].filter(Boolean).join(" ").toLowerCase().includes(m))).slice(0, 8)
    : [];

  function choisirClient(c) {
    setClientId(c.id);
    setVehiculeId(c.vehicules[0]?.id || "");
    setRecherche("");
  }

  async function enregistrer(e) {
    e.preventDefault();
    setErreur("");
    if (!client) return setErreur("Choisis le client.");
    const { erreur: invalide } = normaliserJeu(champs);
    if (invalide) return setErreur(invalide);
    if (statut === "ENTREPOSE" && !champs.emplacement.trim()) return setErreur("Indique l'emplacement à l'entrepôt (ex. A-12).");
    setEnCours(true);
    const res = await fetch("/api/pneus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...champs, clientId, vehiculeId: vehiculeId || null, statut, bonId: bonRetour || null }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setEnCours(false);
      return setErreur(data?.erreur || "Rien n'a été enregistré : vérifie la connexion et réessaie.");
    }
    router.push(bonRetour ? `/bons/${bonRetour}` : `/pneus/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={enregistrer} className="conteneur-page" style={{ paddingBottom: 40 }}>
      <Link href={bonRetour ? `/bons/${bonRetour}` : "/pneus"} style={{ display: "inline-block", color: "var(--text-muted)", fontSize: 12.5, textDecoration: "none", marginBottom: 10 }}>
        ← {bonRetour ? "Retour au bon" : "Entreposage de pneus"}
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: "0 0 14px" }}>Nouveau jeu de pneus</h1>

      <section style={panneau}>
        <h2 style={titre}>Client et véhicule</h2>
        {client ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{client.nom}</span>
            {client.telephone && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{client.telephone}</span>}
            <button type="button" onClick={() => setClientId("")} style={lienBouton}>Changer</button>
          </div>
        ) : (
          <div style={{ marginBottom: 6 }}>
            <input
              value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ" autoFocus
              placeholder="Nom, téléphone ou plaque du client" aria-label="Chercher le client" style={{ fontSize: 15 }}
            />
            {trouves.length > 0 && (
              <div style={{ border: "1px solid var(--border)", borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                {trouves.map((c) => (
                  <button key={c.id} type="button" onClick={() => choisirClient(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "var(--bg)", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 14 }}>
                    <b>{c.nom}</b> <span style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{[c.telephone, c.vehicules.map((v) => v.plaque).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            )}
            {mots.length > 0 && trouves.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 0" }}>Aucun client trouvé. Créez-le d&apos;abord dans Clients.</p>}
          </div>
        )}
        {client && (
          <label style={{ display: "block" }}>
            <span style={etiquette}>Véhicule</span>
            <select value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)} className="champ" style={{ fontSize: 15 }}>
              {client.vehicules.map((v) => <option key={v.id} value={v.id}>{libelleVehicule(v)}{v.plaque ? ` · ${v.plaque}` : ""}</option>)}
              <option value="">Non précisé</option>
            </select>
          </label>
        )}
      </section>

      <section style={panneau}>
        <h2 style={titre}>Où sont les pneus ?</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["ENTREPOSE", "À l'entrepôt"], ["POSE", "Sur le véhicule"]].map(([cle, libelle]) => (
            <label key={cle} style={{ ...choix, borderColor: statut === cle ? "var(--accent)" : "var(--border)" }}>
              <input type="radio" name="statut" checked={statut === cle} onChange={() => setStatut(cle)} /> {libelle}
            </label>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
          « Sur le véhicule » : pour suivre aussi le jeu de l&apos;autre saison ; il entrera à l&apos;entrepôt au prochain changement de saison.
        </p>
      </section>

      <section style={panneau}>
        <h2 style={titre}>Les pneus</h2>
        <ChampsJeu
          champs={champs} onChange={setChamps} seuils={seuils}
          emplacement={statut === "ENTREPOSE" && (
            <ChoixEmplacement valeur={champs.emplacement} onChange={(emplacement) => setChamps((c) => ({ ...c, emplacement }))} libres={libres} occupes={occupes} />
          )}
        />
      </section>

      {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 14, borderRadius: 12, fontSize: 15.5, fontWeight: 800 }}>
        {enCours ? "Enregistrement…" : "Inscrire le jeu"}
      </button>
    </form>
  );
}

const panneau = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 12 };
const titre = { fontSize: 15, fontWeight: 800, margin: "0 0 10px" };
const etiquette = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };
const lienBouton = { background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--accent-ombre)", fontWeight: 700, cursor: "pointer" };
const choix = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--border)", cursor: "pointer" };
