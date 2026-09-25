"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SelecteurDatePrevue from "../../components/SelecteurDatePrevue";
import { valeurDateHeureLocale } from "@/lib/regroupementDates";

export default function NouveauBon({ clientsExistants }) {
  const router = useRouter();
  const [clientSelectionne, setClientSelectionne] = useState(null);
  const [rechercheClient, setRechercheClient] = useState("");
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const boiteRechercheRef = useRef(null);

  useEffect(() => {
    function surClicExterieur(e) {
      if (boiteRechercheRef.current && !boiteRechercheRef.current.contains(e.target)) {
        setAfficherSuggestions(false);
      }
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, []);

  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientVille, setClientVille] = useState("");
  const [clientCodePostal, setClientCodePostal] = useState("");

  const [problemes, setProblemes] = useState([""]);
  const [datePrevue, setDatePrevue] = useState(() => valeurDateHeureLocale(new Date()));
  const [ajouterAuCalendrier, setAjouterAuCalendrier] = useState(true);
  const [dureeMinutes, setDureeMinutes] = useState("60");
  const [horsDisponibilite, setHorsDisponibilite] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const suggestions = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return [];
    return clientsExistants.filter((c) => c.nom.toLowerCase().includes(q)).slice(0, 6);
  }, [rechercheClient, clientsExistants]);

  function choisirClient(c) {
    setClientSelectionne(c);
    setRechercheClient(c.nom);
    setAfficherSuggestions(false);
  }

  function changerClientPourNouveau() {
    setClientSelectionne(null);
    setRechercheClient("");
    setClientNom("");
    setClientTelephone("");
    setClientAdresse("");
    setClientVille("");
    setClientCodePostal("");
  }

  function changerProbleme(index, valeur) {
    setProblemes((prev) => prev.map((p, i) => (i === index ? valeur : p)));
  }
  function ajouterLigneProbleme() {
    setProblemes((prev) => [...prev, ""]);
  }
  function supprimerLigneProbleme(index) {
    setProblemes((prev) => prev.filter((_, i) => i !== index));
  }

  async function creer(e, forcer = false) {
    e?.preventDefault();
    setErreur("");
    setHorsDisponibilite(false);

    const lignesValides = problemes.map((p) => p.trim()).filter(Boolean);
    if (lignesValides.length === 0) {
      setErreur("Ajoute au moins une ligne de problème.");
      return;
    }
    if (!clientSelectionne && !clientNom.trim()) {
      setErreur("Indique le nom du client, ou choisis-en un existant.");
      return;
    }

    setEnCours(true);
    const res = await fetch("/api/bons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientSelectionne?.id,
        clientNom, clientTelephone, clientAdresse, clientVille, clientCodePostal,
        problemes: lignesValides,
        datePrevue, ajouterAuCalendrier, dureeMinutes, forcer,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      setHorsDisponibilite(!!data.horsDisponibilite);
      return;
    }
    const { id } = await res.json();
    router.push(`/bons/${id}`);
  }

  return (
    <form onSubmit={creer} className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Nouveau bon de travail</h1>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 4, marginBottom: 4 }}>Client</div>

      {clientSelectionne ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: 10, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{clientSelectionne.nom}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {[clientSelectionne.telephone, clientSelectionne.ville].filter(Boolean).join(" · ") || "Client existant"}
              {clientSelectionne.garantieProlongee && <> · 🛡️ Garantie #{clientSelectionne.garantieProlongee}</>}
            </div>
          </div>
          <button type="button" onClick={changerClientPourNouveau} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
            Changer
          </button>
        </div>
      ) : (
        <div ref={boiteRechercheRef} style={{ position: "relative" }}>
          <label style={labelStyle}>Nom du client</label>
          <input
            required
            value={rechercheClient}
            onChange={(e) => { setRechercheClient(e.target.value); setClientNom(e.target.value); setAfficherSuggestions(true); }}
            onFocus={() => setAfficherSuggestions(true)}
            placeholder="Tape pour rechercher un client existant ou en créer un nouveau"
            style={champInput}
          />
          {afficherSuggestions && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 10, marginTop: -4, overflow: "hidden" }}>
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choisirClient(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {[c.telephone, c.ville].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!clientSelectionne && (
        <>
          <Champ label="Téléphone" value={clientTelephone} onChange={setClientTelephone} />
          <Champ label="Adresse" value={clientAdresse} onChange={setClientAdresse} />
          <div style={{ display: "flex", gap: 8 }}>
            <Champ label="Ville" value={clientVille} onChange={setClientVille} style={{ flex: 1 }} />
            <Champ label="Code postal" value={clientCodePostal} onChange={(v) => setClientCodePostal(v.toUpperCase())} style={{ width: 110 }} />
          </div>
        </>
      )}

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 14, marginBottom: 4 }}>Problèmes signalés</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
        {problemes.map((valeur, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", width: 14 }}>{i + 1}.</span>
            <input
              required={i === 0}
              value={valeur}
              onChange={(e) => changerProbleme(i, e.target.value)}
              placeholder={i === 0 ? "Ex : Bruit de freinage à l'avant" : "Ajouter un autre problème…"}
              style={{ ...champInput, marginBottom: 0, flex: 1 }}
            />
            {problemes.length > 1 && (
              <button type="button" onClick={() => supprimerLigneProbleme(i)} style={boutonTexte}>✕</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={ajouterLigneProbleme} style={boutonAjoutLigne}>
        + Ajouter une autre ligne de problème
      </button>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 18, marginBottom: 6 }}>Date prévue</div>
      <SelecteurDatePrevue valeur={datePrevue} onChange={setDatePrevue} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={ajouterAuCalendrier} onChange={(e) => setAjouterAuCalendrier(e.target.checked)} />
          📅 Inscrire au calendrier
        </label>
        {ajouterAuCalendrier && (
          <select value={dureeMinutes} onChange={(e) => setDureeMinutes(e.target.value)} style={{ ...champInput, width: "auto", marginBottom: 0 }}>
            <option value="30">30 min</option>
            <option value="60">1 heure</option>
            <option value="90">1h30</option>
            <option value="120">2 heures</option>
            <option value="180">3 heures</option>
            <option value="240">4 heures</option>
            <option value="480">Journée (8 h)</option>
          </select>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10, marginTop: 10 }}>{erreur}</p>}
      {horsDisponibilite && (
        <button type="button" onClick={() => creer(null, true)} disabled={enCours} style={{ width: "100%", marginBottom: 6, padding: 10, borderRadius: 8, border: "1px solid var(--danger)", background: "none", color: "var(--danger)", fontWeight: 700, cursor: "pointer" }}>
          Créer et inscrire au calendrier quand même
        </button>
      )}

      <button
        type="submit" disabled={enCours}
        style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer", marginTop: 10 }}
      >
        {enCours ? "Création…" : "Créer le bon de travail"}
      </button>
    </form>
  );
}

function Champ({ label, value, onChange, requis, type = "text", style }) {
  return (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} required={requis} value={value}
        onChange={(e) => onChange(e.target.value)}
        style={champInput}
      />
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 6, boxSizing: "border-box",
};
const boutonTexte = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 };
const boutonAjoutLigne = {
  background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 12,
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", width: "100%",
};
