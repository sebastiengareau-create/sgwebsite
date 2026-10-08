"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STATUTS_ENVOI, STATUTS_ACTIFS, LIBELLES_SMS } from "@/lib/statutsEnvoi";
import { dateCourteQuebec, heureQuebec } from "@/lib/regroupementDates";

function texteVehicule(v) {
  return v ? [v.annee, v.marque, v.modele].filter(Boolean).join(" ") : "";
}

export default function EnvoisClient({ bons, employes, envois, smsActif, bonInitial }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [bonId, setBonId] = useState(bons.some((b) => b.id === bonInitial) ? bonInitial : "");
  const [choisis, setChoisis] = useState([]);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultats, setResultats] = useState(null);

  const q = recherche.trim().toLowerCase();
  const bonsFiltres = bons.filter((b) => !q || [b.numero, b.client.nom].some((c) => c?.toLowerCase().includes(q)));
  const bon = bons.find((b) => b.id === bonId);

  function basculer(id) {
    setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  async function envoyer() {
    setErreur("");
    setResultats(null);
    setEnvoi(true);
    const res = await fetch("/api/envois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonId, employeIds: choisis, message }),
    });
    const data = await res.json().catch(() => ({}));
    setEnvoi(false);
    if (!res.ok) {
      setErreur(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    setResultats(data.resultats);
    setChoisis([]);
    setMessage("");
    router.refresh();
  }

  const actifs = envois.filter((e) => STATUTS_ACTIFS.includes(e.statut));
  const fermes = envois.filter((e) => !STATUTS_ACTIFS.includes(e.statut));

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <div className="carte">
        <div className="titre-section">📲 Envoyer un bon à des employés</div>
        {!smsActif && (
          <p style={{ fontSize: 12, color: "#C9A227", margin: "0 0 10px" }}>
            ⚠️ Les SMS ne sont pas configurés (Administrateur → SMS (Twilio)) : la tâche apparaîtra dans « Mes tâches » de l'employé, mais il ne sera pas averti par texto.
          </p>
        )}

        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>1. Bon</label>
        <input
          className="champ champ-espace"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="🔍 Filtrer par numéro ou client…"
          style={{ marginTop: 4 }}
        />
        <select className="champ champ-espace" value={bonId} onChange={(e) => setBonId(e.target.value)}>
          <option value="">— Choisir un bon non facturé —</option>
          {bonsFiltres.map((b) => (
            <option key={b.id} value={b.id}>
              #{b.numero} — {b.client.nom}{texteVehicule(b.vehicule) ? ` — ${texteVehicule(b.vehicule)}` : ""}
            </option>
          ))}
        </select>
        {bon && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, paddingLeft: 4 }}>
            {[bon.client.adresse, bon.client.ville].filter(Boolean).join(", ") && <div>📍 {[bon.client.adresse, bon.client.ville].filter(Boolean).join(", ")}</div>}
            {bon.datePrevue && <div>🕒 Prévu le {dateCourteQuebec(bon.datePrevue)} à {heureQuebec(bon.datePrevue)}</div>}
            {bon.problemes.length > 0 && (
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {bon.problemes.map((p, i) => <li key={i}>{p.description}</li>)}
              </ul>
            )}
          </div>
        )}

        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>2. Employé(s) {choisis.length > 0 && `— ${choisis.length} choisi(s)`}</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6, margin: "4px 0 12px" }}>
          {employes.map((e) => {
            const coche = choisis.includes(e.id);
            return (
              <label
                key={e.id}
                style={{
                  display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${coche ? "var(--accent)" : "var(--border)"}`, background: "var(--bg)",
                }}
              >
                <input type="checkbox" checked={coche} onChange={() => basculer(e.id)} style={{ marginTop: 2 }} />
                <span>
                  <span style={{ fontSize: 13, fontWeight: 600, display: "block" }}>{e.nom}</span>
                  <span style={{ fontSize: 11, color: e.telephone ? "var(--text-muted)" : "#C9A227" }}>
                    {e.telephone ? `📱 ${e.telephone}` : "⚠️ Aucun cellulaire au dossier"}
                    {e.assignation ? ` · ${e.assignation}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>3. Note (facultative, incluse dans le SMS)</label>
        <textarea
          className="champ champ-espace"
          rows={2}
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="ex. Client disponible après 13 h, apporter le cric hydraulique"
          style={{ marginTop: 4, resize: "vertical" }}
        />

        <button
          className="bouton-3d"
          onClick={envoyer}
          disabled={envoi || !bonId || choisis.length === 0}
          style={{ padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, opacity: !bonId || choisis.length === 0 ? 0.5 : 1 }}
        >
          {envoi ? "Envoi…" : `📲 Envoyer${choisis.length > 1 ? ` aux ${choisis.length} employés` : ""}`}
        </button>
        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
        {resultats && (
          <ul style={{ fontSize: 12, marginTop: 10, paddingLeft: 18 }}>
            {resultats.map((r, i) => (
              <li key={i} style={{ color: r.smsStatut === "ENVOYE" ? "var(--text)" : "#C9A227" }}>
                {r.employe} : {r.dejaEnvoye ? "avait déjà ce bon — " : "envoyé — "}{LIBELLES_SMS[r.smsStatut]}{r.smsErreur ? ` (${r.smsErreur})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="carte">
        <div className="titre-section">En cours ({actifs.length})</div>
        {actifs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun bon envoyé en attente.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>{actifs.map((e) => <LigneEnvoi key={e.id} envoi={e} />)}</div>
        )}
      </div>

      {fermes.length > 0 && (
        <div className="carte">
          <div className="titre-section">Fermés — 7 derniers jours ({fermes.length})</div>
          <div style={{ display: "grid", gap: 8 }}>{fermes.map((e) => <LigneEnvoi key={e.id} envoi={e} />)}</div>
        </div>
      )}
    </div>
  );
}

function LigneEnvoi({ envoi }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [info, setInfo] = useState("");
  const statut = STATUTS_ENVOI[envoi.statut];
  const actif = STATUTS_ACTIFS.includes(envoi.statut);

  async function action(url, options, confirmation) {
    if (confirmation && !confirm(confirmation)) return;
    setOccupe(true);
    setInfo("");
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    setOccupe(false);
    if (!res.ok) {
      setInfo(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    if (data.smsStatut) setInfo(LIBELLES_SMS[data.smsStatut] + (data.smsErreur ? ` (${data.smsErreur})` : ""));
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center", background: "var(--bg)", border: "1px solid var(--border)", borderLeft: `3px solid ${statut.color}`, borderRadius: 8, padding: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {envoi.employe.nom}
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statut.color }}>● {statut.label}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <Link href={`/bons/${envoi.bon.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>Bon #{envoi.bon.numero}</Link> — {envoi.bon.client.nom}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Envoyé le {dateCourteQuebec(envoi.envoyeLe)} à {heureQuebec(envoi.envoyeLe)}{envoi.envoyePar ? ` par ${envoi.envoyePar}` : ""}
          {" · "}
          <span style={{ color: envoi.smsStatut === "ENVOYE" ? "var(--text-muted)" : "#C9A227" }} title={envoi.smsErreur || ""}>{LIBELLES_SMS[envoi.smsStatut]}</span>
          {envoi.termineLe && ` · fermé à ${heureQuebec(envoi.termineLe)}`}
        </div>
        {envoi.message && <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>« {envoi.message} »</div>}
        {info && <div style={{ fontSize: 11, color: "#C9A227" }}>{info}</div>}
      </div>
      {actif && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="bouton-3d-sombre"
            disabled={occupe}
            onClick={() => action(`/api/envois/${envoi.id}/sms`, { method: "POST" })}
            style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8 }}
          >
            🔁 Renvoyer le SMS
          </button>
          <button
            className="bouton-3d-sombre"
            disabled={occupe}
            onClick={() => action(`/api/envois/${envoi.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "ANNULE" }) }, `Annuler l'envoi du bon #${envoi.bon.numero} à ${envoi.employe.nom} ?`)}
            style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, color: "var(--danger)" }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
