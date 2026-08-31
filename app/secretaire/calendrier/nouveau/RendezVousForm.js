"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { dateAujourdhuiQuebec } from "@/lib/temps";

export default function RendezVousForm({ clientsExistants }) {
  const router = useRouter();
  const [clientSelectionne, setClientSelectionne] = useState(null);
  const [rechercheClient, setRechercheClient] = useState("");
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const boiteRef = useRef(null);

  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [vehiculeInfo, setVehiculeInfo] = useState("");
  const [date, setDate] = useState(dateAujourdhuiQuebec());
  const [heure, setHeure] = useState("09:00");
  const [dureeMinutes, setDureeMinutes] = useState("60");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    function surClicExterieur(e) {
      if (boiteRef.current && !boiteRef.current.contains(e.target)) setAfficherSuggestions(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const suggestions = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return [];
    return clientsExistants.filter((c) => c.nom.toLowerCase().includes(q)).slice(0, 6);
  }, [rechercheClient, clientsExistants]);

  function choisirClient(c) {
    setClientSelectionne(c);
    setRechercheClient(c.nom);
    setClientTelephone(c.telephone || "");
    setAfficherSuggestions(false);
  }
  function changerClientPourNouveau() {
    setClientSelectionne(null);
    setRechercheClient("");
    setClientNom("");
    setClientTelephone("");
  }

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    const nomFinal = clientSelectionne ? clientSelectionne.nom : clientNom;
    if (!nomFinal.trim() || !motif.trim()) {
      setErreur("Indique le client et le motif du rendez-vous.");
      return;
    }

    setEnCours(true);
    const res = await fetch("/api/rendezvous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientSelectionne?.id,
        clientNom: nomFinal, clientTelephone, vehiculeInfo,
        date: `${date}T${heure}:00`,
        dureeMinutes, motif,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    router.push(`/secretaire/calendrier?date=${date}`);
  }

  return (
    <form onSubmit={creer} className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Nouveau rendez-vous</h1>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Client</div>
      {clientSelectionne ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: 10, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{clientSelectionne.nom}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{clientSelectionne.telephone || "Client existant"}</div>
          </div>
          <button type="button" onClick={changerClientPourNouveau} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
            Changer
          </button>
        </div>
      ) : (
        <div ref={boiteRef} style={{ position: "relative" }}>
          <input
            required
            value={rechercheClient}
            onChange={(e) => { setRechercheClient(e.target.value); setClientNom(e.target.value); setAfficherSuggestions(true); }}
            onFocus={() => setAfficherSuggestions(true)}
            placeholder="Nom du client — recherche ou nouveau"
            style={champInput}
          />
          {afficherSuggestions && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 10, marginTop: -4, overflow: "hidden" }}>
              {suggestions.map((c) => (
                <button key={c.id} type="button" onClick={() => choisirClient(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
                  <div style={{ fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.telephone}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!clientSelectionne && (
        <input placeholder="Téléphone" value={clientTelephone} onChange={(e) => setClientTelephone(e.target.value)} style={champInput} />
      )}
      <input placeholder="Véhicule (ex : Honda Civic 2019)" value={vehiculeInfo} onChange={(e) => setVehiculeInfo(e.target.value)} style={champInput} />

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14, marginBottom: 4 }}>Rendez-vous</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} style={{ ...champInput, flex: 1 }} />
        <input type="time" required value={heure} onChange={(e) => setHeure(e.target.value)} style={{ ...champInput, width: 110 }} />
      </div>
      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Durée</label>
      <select value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} style={champInput}>
        <option value="30">30 minutes</option>
        <option value="60">1 heure</option>
        <option value="90">1h30</option>
        <option value="120">2 heures</option>
        <option value="180">3 heures</option>
      </select>
      <input required placeholder="Motif (ex : Changement d'huile)" value={motif} onChange={(e) => setMotif(e.target.value)} style={champInput} />

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{erreur}</p>}

      <button type="submit" disabled={enCours} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}>
        {enCours ? "Création…" : "Créer le rendez-vous"}
      </button>
    </form>
  );
}

const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
