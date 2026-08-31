"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function nouvelleTache() {
  return { id: Math.random().toString(36).slice(2), description: "", tempsEstime: "", pieces: [] };
}
function nouvellePiece() {
  return { id: Math.random().toString(36).slice(2), nom: "", prixEstime: "", qte: "1" };
}

export default function SoumissionForm({ clientsExistants, tauxHoraireClient, soumissionExistante }) {
  const router = useRouter();
  const clientDejaLie = soumissionExistante?.client
    ? clientsExistants.find((c) => c.id === soumissionExistante.client.id) || soumissionExistante.client
    : null;

  const [clientSelectionne, setClientSelectionne] = useState(clientDejaLie);
  const [rechercheClient, setRechercheClient] = useState(soumissionExistante?.clientNom || "");
  const [afficherSuggestions, setAfficherSuggestions] = useState(false);
  const boiteRef = useRef(null);

  const [clientNom, setClientNom] = useState(soumissionExistante?.clientNom || "");
  const [clientTelephone, setClientTelephone] = useState(soumissionExistante?.clientTelephone || "");
  const [taches, setTaches] = useState(
    soumissionExistante
      ? soumissionExistante.taches.map((t) => ({
          id: t.id,
          description: t.description,
          tempsEstime: String(t.tempsEstime),
          pieces: t.pieces.map((p) => ({ id: p.id, nom: p.nom, prixEstime: String(p.prixEstime), qte: String(p.qte) })),
        }))
      : [nouvelleTache()]
  );
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

  function majTache(id, champ, valeur) {
    setTaches((prev) => prev.map((t) => (t.id === id ? { ...t, [champ]: valeur } : t)));
  }
  function ajouterTache() {
    setTaches((prev) => [...prev, nouvelleTache()]);
  }
  function supprimerTache(id) {
    setTaches((prev) => prev.filter((t) => t.id !== id));
  }
  function ajouterPiece(tacheId) {
    setTaches((prev) => prev.map((t) => (t.id === tacheId ? { ...t, pieces: [...t.pieces, nouvellePiece()] } : t)));
  }
  function majPiece(tacheId, pieceId, champ, valeur) {
    setTaches((prev) => prev.map((t) =>
      t.id !== tacheId ? t : { ...t, pieces: t.pieces.map((p) => (p.id === pieceId ? { ...p, [champ]: valeur } : p)) }
    ));
  }
  function supprimerPiece(tacheId, pieceId) {
    setTaches((prev) => prev.map((t) =>
      t.id !== tacheId ? t : { ...t, pieces: t.pieces.filter((p) => p.id !== pieceId) }
    ));
  }

  const totalTemps = taches.reduce((s, t) => s + (Number(t.tempsEstime) || 0), 0);
  const totalMainOeuvre = totalTemps * tauxHoraireClient;
  const totalPieces = taches.reduce((s, t) => s + t.pieces.reduce((s2, p) => s2 + (Number(p.prixEstime) || 0) * (Number(p.qte) || 1), 0), 0);
  const totalEstime = totalMainOeuvre + totalPieces;

  async function creer(e) {
    e.preventDefault();
    setErreur("");

    const tachesValides = taches.filter((t) => t.description.trim());
    const nomFinal = clientSelectionne ? clientSelectionne.nom : clientNom;
    if (!nomFinal.trim() || tachesValides.length === 0) {
      setErreur("Indique le nom du client et au moins une tâche.");
      return;
    }

    setEnCours(true);
    const url = soumissionExistante ? `/api/soumissions/${soumissionExistante.id}` : "/api/soumissions";
    const method = soumissionExistante ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientSelectionne?.id,
        clientNom: nomFinal, clientTelephone,
        taches: tachesValides.map((t) => ({
          description: t.description,
          tempsEstime: t.tempsEstime,
          pieces: t.pieces.filter((p) => p.nom.trim()).map((p) => ({ nom: p.nom, prixEstime: p.prixEstime, qte: p.qte })),
        })),
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    const idFinal = soumissionExistante ? soumissionExistante.id : (await res.json()).id;
    router.push(`/secretaire/operations/soumissions/${idFinal}/imprimer`);
  }

  return (
    <form onSubmit={creer} className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{soumissionExistante ? "Modifier la soumission" : "Nouvelle soumission"}</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        {soumissionExistante ? `#${soumissionExistante.numero}` : "Un estimé à donner au client avant de commencer les travaux."}
      </p>

      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Client</div>

      {clientSelectionne ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{clientSelectionne.nom}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {clientSelectionne.telephone || "Client existant"}
              {clientSelectionne.garantieProlongee && <> · 🛡️ Garantie #{clientSelectionne.garantieProlongee}</>}
            </div>
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
                <button
                  key={c.id} type="button" onClick={() => choisirClient(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
                >
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
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginTop: 16, marginBottom: 8 }}>Tâches estimées</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {taches.map((t, idx) => (
          <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                placeholder={`Tâche ${idx + 1} — ex : Remplacement plaquettes de frein`}
                value={t.description}
                onChange={(e) => majTache(t.id, "description", e.target.value)}
                style={{ ...champInput, marginBottom: 0, flex: 1 }}
              />
              {taches.length > 1 && (
                <button type="button" onClick={() => supprimerTache(t.id)} style={boutonTexte}>✕</button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Temps estimé :</span>
              <input
                type="number" min={0} step="0.25"
                value={t.tempsEstime}
                onChange={(e) => majTache(t.id, "tempsEstime", e.target.value)}
                style={{ ...champInput, marginBottom: 0, width: 70, textAlign: "center" }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                h {t.tempsEstime ? `≈ ${(Number(t.tempsEstime) * tauxHoraireClient).toFixed(2)} $` : ""}
              </span>
            </div>

            {t.pieces.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                {t.pieces.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 6 }}>
                    <input placeholder="Pièce" value={p.nom} onChange={(e) => majPiece(t.id, p.id, "nom", e.target.value)} style={{ ...champInput, marginBottom: 0, flex: 1, fontSize: 12 }} />
                    <input type="number" min={1} placeholder="Qté" value={p.qte} onChange={(e) => majPiece(t.id, p.id, "qte", e.target.value)} style={{ ...champInput, marginBottom: 0, width: 50, fontSize: 12, textAlign: "center" }} />
                    <input type="number" min={0} step="0.01" placeholder="Prix $" value={p.prixEstime} onChange={(e) => majPiece(t.id, p.id, "prixEstime", e.target.value)} style={{ ...champInput, marginBottom: 0, width: 70, fontSize: 12 }} />
                    <button type="button" onClick={() => supprimerPiece(t.id, p.id)} style={boutonTexte}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => ajouterPiece(t.id)} style={{ ...boutonAjoutLigne, padding: "5px 8px", fontSize: 11 }}>
              + Ajouter une pièce estimée
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={ajouterTache} style={{ ...boutonAjoutLigne, marginTop: 10 }}>
        + Ajouter une autre tâche
      </button>

      <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Main-d'œuvre ({totalTemps}h × {tauxHoraireClient.toFixed(2)} $)</span>
          <span style={{ fontWeight: 600 }}>{totalMainOeuvre.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Pièces estimées</span>
          <span style={{ fontWeight: 600 }}>{totalPieces.toFixed(2)} $</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
          <span>Total estimé</span>
          <span style={{ color: "var(--accent)" }}>{totalEstime.toFixed(2)} $</span>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{erreur}</p>}

      <button
        type="submit" disabled={enCours}
        style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}
      >
        {enCours ? "Enregistrement…" : soumissionExistante ? "Sauvegarder les modifications" : "Créer la soumission"}
      </button>
    </form>
  );
}

const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonTexte = { background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 };
const boutonAjoutLigne = {
  background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 12,
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", width: "100%",
};
