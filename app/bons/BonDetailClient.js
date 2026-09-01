"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUTS = {
  EN_ATTENTE: { label: "En attente", color: "#C9A227" },
  EN_COURS: { label: "En cours", color: "#4F82C0" },
  TERMINE: { label: "Facturé", color: "#6FA96B" },
};

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}
function versInputLocal(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}
function tempsEcoule(debutISO) {
  const s = Math.floor((Date.now() - new Date(debutISO).getTime()) / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

// Réduit la taille de l'image avant l'envoi (les photos de téléphone peuvent
// faire 8-12 Mo, ce qui bloquait l'envoi silencieusement).
function compresserImage(file, maxLargeur = 1280, qualite = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Image invalide."));
      img.onload = () => {
        const ratio = Math.min(1, maxLargeur / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", qualite));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function BonDetailClient({ bon, inventaire, mecaniciens, tauxHoraireClient, tpsTaux, tvqTaux, peutModifier, peutPoinconner, estGerant, moi }) {
  const router = useRouter();
  const [nouveauProbleme, setNouveauProbleme] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function supprimerBon() {
    if (!window.confirm(`Supprimer définitivement le bon #${bon.numero} ? Les pièces utilisées seront remises en stock. Cette action est irréversible.`)) return;
    setEnCours(true);
    const res = await fetch(`/api/bons/${bon.id}`, { method: "DELETE" });
    setEnCours(false);
    if (res.ok) {
      router.push("/secretaire");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    window.alert(data.erreur || "Erreur lors de la suppression.");
  }

  const [erreurFacture, setErreurFacture] = useState("");
  const [avertissementFacture, setAvertissementFacture] = useState("");
  const [envoiCourrielEnCours, setEnvoiCourrielEnCours] = useState(false);
  const [messageCourriel, setMessageCourriel] = useState(null);
  const [demanderCourriel, setDemanderCourriel] = useState(false);
  const [courrielManuel, setCourrielManuel] = useState("");

  async function envoyerCourriel(courrielChoisi) {
    setEnvoiCourrielEnCours(true);
    setMessageCourriel(null);
    const res = await fetch(`/api/bons/${bon.id}/envoyer-facture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courrielManuel: courrielChoisi || undefined }),
    });
    const data = await res.json();
    setEnvoiCourrielEnCours(false);
    if (!res.ok) {
      setMessageCourriel({ type: "erreur", texte: data.erreur || "Erreur lors de l'envoi." });
      return;
    }
    setMessageCourriel({ type: "succes", texte: `Facture envoyée à ${data.destinataire} ✓` });
    setDemanderCourriel(false);
    setCourrielManuel("");
  }

  function declencherEnvoiCourriel() {
    setMessageCourriel(null);
    if (bon.client.courriel) {
      envoyerCourriel();
    } else {
      setDemanderCourriel(true);
    }
  }

  async function creerFacture() {
    if (!window.confirm("Émettre la facture officielle pour ce bon ? Le montant sera figé même si le bon est modifié après.")) return;
    setErreurFacture("");
    setAvertissementFacture("");
    setEnCours(true);
    const res = await fetch(`/api/bons/${bon.id}/facturer`, { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurFacture(data.erreur || "Erreur lors de la facturation.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.avertissementComptable) {
      setAvertissementFacture(`Facture émise, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    }
    router.refresh();
  }

  async function changerStatutFacture(statut) {
    setAvertissementFacture("");
    setEnCours(true);
    const res = await fetch(`/api/factures/${bon.facture.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (data.avertissementComptable) {
      setAvertissementFacture(`Statut mis à jour, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    }
    router.refresh();
  }

  async function supprimerFacture() {
    if (!window.confirm("Supprimer complètement cette facture ? À utiliser seulement en période de test — en usage réel, préfère « Annuler » pour garder la trace. Cette action est irréversible.")) return;
    setEnCours(true);
    const res = await fetch(`/api/factures/${bon.facture.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  async function appel(url, options) {
    setEnCours(true);
    const res = await fetch(url, {
      method: options.method,
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    setEnCours(false);
    router.refresh();
    return res;
  }

  async function changerStatut(statut) {
    await appel(`/api/bons/${bon.id}`, { method: "PATCH", body: { statut } });
  }

  async function ajouterProbleme() {
    if (!nouveauProbleme.trim()) return;
    await appel(`/api/bons/${bon.id}/problemes`, { method: "POST", body: { description: nouveauProbleme.trim() } });
    setNouveauProbleme("");
  }

  async function supprimerProbleme(problemeId) {
    await appel(`/api/bons/${bon.id}/problemes/${problemeId}`, { method: "DELETE" });
  }

  const toutesEntreesTemps = bon.problemes.flatMap((pr) => pr.entreesTemps);
  const totalPieces = bon.problemes.reduce(
    (s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0),
    0
  );
  const totalHeuresTerminees = toutesEntreesTemps
    .filter((t) => t.fin)
    .reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
  const heuresEnCours = toutesEntreesTemps.some((t) => !t.fin);
  const totalMainOeuvre = totalHeuresTerminees * tauxHoraireClient;
  const sousTotalAvantEscompte = totalPieces + totalMainOeuvre;
  const [escompteInput, setEscompteInput] = useState(String(bon.escompteMontant || 0));
  const [escompteRaisonInput, setEscompteRaisonInput] = useState(bon.escompteRaison || "");
  const escompteApplique = Math.min(bon.escompteMontant || 0, sousTotalAvantEscompte);
  const totalFacture = sousTotalAvantEscompte - escompteApplique;
  const tpsEstime = totalFacture * (tpsTaux / 100);
  const tvqEstime = totalFacture * (tvqTaux / 100);
  const totalAvecTaxesEstime = totalFacture + tpsEstime + tvqEstime;

  async function sauvegarderEscompte() {
    setEnCours(true);
    await fetch(`/api/bons/${bon.id}/escompte`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montant: escompteInput, raison: escompteRaisonInput }),
    });
    setEnCours(false);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
          ← Retour
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link
            href={`/bons/${bon.id}/commande`}
            target="_blank"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", textDecoration: "none", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8 }}
          >
            🖨️ Imprimer bon de travail
          </Link>
          <Link
            href={`/bons/${bon.id}/imprimer`}
            target="_blank"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8 }}
          >
            🖨️ {bon.facture ? "Facture" : "Bon de commande"}
          </Link>
          {peutModifier && (
            <button
              onClick={supprimerBon}
              disabled={enCours}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
            >
              🗑️ Supprimer
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{bon.numero}</span>
        <StatusPill statut={bon.statut} />
      </div>
      <h1 style={{ fontSize: 20, margin: "4px 0" }}>{bon.client.nom}</h1>
      {(bon.client.adresse || bon.client.ville) && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {[bon.client.adresse, [bon.client.ville, bon.client.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
        </div>
      )}
      {bon.client.telephone && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{bon.client.telephone}</div>}

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
        Le statut évolue automatiquement : En attente → En cours dès qu'un poinçon démarre → Facturé quand la facture est émise.
      </div>

      <div style={{ marginTop: 16, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
        <Label>{bon.facture ? "💰 Facture" : "💰 Résumé de facturation (estimé)"}</Label>

        {bon.facture ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>#{bon.facture.numero}</span>
              <StatutFacturePill statut={bon.facture.statut} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>Main-d'œuvre ({fmtHeures(bon.facture.heuresFacturees)} × {bon.facture.tauxHoraireUtilise.toFixed(2)} $/h)</span>
              <span style={{ fontWeight: 600 }}>{bon.facture.totalMainOeuvre.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: "var(--text-muted)" }}>Pièces</span>
              <span style={{ fontWeight: 600 }}>{bon.facture.totalPieces.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>Sous-total</span>
              <span style={{ fontWeight: 600 }}>{(bon.facture.totalFacture + (bon.facture.escompteApplique || 0)).toFixed(2)} $</span>
            </div>
            {bon.facture.escompteApplique > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--danger)", marginBottom: 4 }}>
                <span>Escompte</span>
                <span>−{bon.facture.escompteApplique.toFixed(2)} $</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
              <span>TPS</span>
              <span>{bon.facture.tpsMontant.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              <span>TVQ</span>
              <span>{bon.facture.tvqMontant.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>Total (taxes incluses)</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{bon.facture.totalAvecTaxes.toFixed(2)} $</span>
            </div>

            {peutModifier && (
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={declencherEnvoiCourriel}
                  disabled={envoiCourrielEnCours}
                  className="bouton-3d-sombre"
                  style={{ width: "100%", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}
                >
                  {envoiCourrielEnCours ? "Envoi…" : "📧 Envoyer par courriel"}
                </button>
                {demanderCourriel && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <input
                      type="email" placeholder="courriel@client.com" value={courrielManuel}
                      onChange={(e) => setCourrielManuel(e.target.value)} autoFocus
                      style={{ flex: 1, padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
                    />
                    <button onClick={() => envoyerCourriel(courrielManuel)} disabled={!courrielManuel || envoiCourrielEnCours} className="bouton-3d" style={{ padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      Envoyer
                    </button>
                  </div>
                )}
                {messageCourriel && (
                  <p style={{ fontSize: 12, marginTop: 8, color: messageCourriel.type === "succes" ? "var(--success)" : "var(--danger)" }}>{messageCourriel.texte}</p>
                )}
              </div>
            )}
            {peutModifier && bon.facture.statut !== "ANNULEE" && (
              <div style={{ display: "flex", gap: 8 }}>
                {bon.facture.statut === "IMPAYEE" ? (
                  <button onClick={() => changerStatutFacture("PAYEE")} disabled={enCours} style={{ ...boutonAjout, flex: 1, background: "var(--success)", color: "#17150f", border: "none", fontWeight: 700 }}>
                    Marquer payée
                  </button>
                ) : (
                  <button onClick={() => changerStatutFacture("IMPAYEE")} disabled={enCours} style={{ ...boutonAjout, flex: 1 }}>
                    Marquer impayée
                  </button>
                )}
                <button onClick={() => changerStatutFacture("ANNULEE")} disabled={enCours} style={{ ...boutonAjout, color: "var(--danger)" }}>
                  Annuler
                </button>
              </div>
            )}
            {avertissementFacture && <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 8 }}>⚠️ {avertissementFacture}</p>}
            {estGerant && (
              <button
                onClick={supprimerFacture}
                disabled={enCours}
                style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px dashed var(--danger)", background: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer" }}
              >
                🗑️ Supprimer la facture (période de test)
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>Main-d'œuvre ({fmtHeures(totalHeuresTerminees)} × {tauxHoraireClient.toFixed(2)} $/h){heuresEnCours ? " *" : ""}</span>
              <span style={{ fontWeight: 600 }}>{totalMainOeuvre.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: "var(--text-muted)" }}>Pièces</span>
              <span style={{ fontWeight: 600 }}>{totalPieces.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>Sous-total</span>
              <span style={{ fontWeight: 600 }}>{sousTotalAvantEscompte.toFixed(2)} $</span>
            </div>

            {peutModifier && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Escompte $</span>
                <input
                  type="number" min={0} step="0.01" value={escompteInput}
                  onChange={(e) => setEscompteInput(e.target.value)}
                  style={{ width: 70, padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}
                />
                <input
                  placeholder="Raison (optionnel)" value={escompteRaisonInput}
                  onChange={(e) => setEscompteRaisonInput(e.target.value)}
                  style={{ flex: 1, padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}
                />
                <button onClick={sauvegarderEscompte} disabled={enCours} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>✓</button>
              </div>
            )}
            {escompteApplique > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>
                <span>Escompte{bon.escompteRaison ? ` (${bon.escompteRaison})` : ""}</span>
                <span>−{escompteApplique.toFixed(2)} $</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
              <span>TPS ({tpsTaux}%)</span>
              <span>{tpsEstime.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              <span>TVQ ({tvqTaux}%)</span>
              <span>{tvqEstime.toFixed(2)} $</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 700 }}>Total estimé (taxes incluses)</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{totalAvecTaxesEstime.toFixed(2)} $</span>
            </div>
            {heuresEnCours && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>* Un poinçon est encore actif — le total augmentera une fois arrêté.</p>}

            {peutModifier && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={creerFacture}
                  disabled={enCours}
                  style={{
                    width: "100%", padding: 10, borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer",
                    background: "var(--accent)", color: "#17150f",
                  }}
                >
                  📄 Émettre la facture officielle
                </button>
                <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>Le bon passera automatiquement au statut « Facturé ».</p>
                {erreurFacture && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreurFacture}</p>}
                {avertissementFacture && <p style={{ fontSize: 11, color: "var(--accent)", marginTop: 6 }}>⚠️ {avertissementFacture}</p>}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <Label>Tâches ({bon.problemes.length})</Label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {bon.problemes.map((pr, idx) => (
          <LigneTache
            key={pr.id}
            probleme={pr}
            index={idx}
            bonId={bon.id}
            inventaire={inventaire}
            mecaniciens={mecaniciens}
            peutModifier={peutModifier}
            peutPoinconner={peutPoinconner}
            moi={moi}
            peutSupprimer={peutModifier && bon.problemes.length > 1}
            onSupprimer={() => supprimerProbleme(pr.id)}
            onRafraichir={() => router.refresh()}
          />
        ))}
      </div>

      {peutModifier && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={nouveauProbleme}
            onChange={(e) => setNouveauProbleme(e.target.value)}
            placeholder="Ajouter une tâche…"
            style={champStyle}
          />
          <button onClick={ajouterProbleme} disabled={enCours} style={boutonAjout}>+</button>
        </div>
      )}
    </div>
  );
}

function LigneTache({ probleme, index, bonId, inventaire, mecaniciens, peutModifier, peutPoinconner, moi, peutSupprimer, onSupprimer, onRafraichir }) {
  const [pieceChoisie, setPieceChoisie] = useState("");
  const [qtePiece, setQtePiece] = useState(1);
  const [erreurPiece, setErreurPiece] = useState("");
  const [confirmationPiece, setConfirmationPiece] = useState("");
  const [erreurPhoto, setErreurPhoto] = useState("");
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [enCoursPoincon, setEnCoursPoincon] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [afficherTempsManuel, setAfficherTempsManuel] = useState(false);
  const [empChoisi, setEmpChoisi] = useState("");
  const [debutManuel, setDebutManuel] = useState("");
  const [finManuel, setFinManuel] = useState("");
  const [erreurTempsManuel, setErreurTempsManuel] = useState("");
  const [entreeEnEdition, setEntreeEnEdition] = useState(null); // id d'une entrée en cours de modification
  const [editDebut, setEditDebut] = useState("");
  const [editFin, setEditFin] = useState("");
  const [pieceEnEdition, setPieceEnEdition] = useState(null);
  const [editPrix, setEditPrix] = useState("");
  const [editQte, setEditQte] = useState("");

  const piecesDisponibles = inventaire.filter((p) => p.qte > 0);
  const totalLigne = probleme.pieces.reduce((s, l) => s + l.qte * l.prix, 0);

  // Temps par employé pour CETTE tâche précisément
  const parEmploye = {};
  for (const t of probleme.entreesTemps) {
    if (!parEmploye[t.employeId]) parEmploye[t.employeId] = { employe: t.employe, termine: 0, active: null };
    if (t.fin) parEmploye[t.employeId].termine += dureeHeures(t.debut, t.fin);
    else parEmploye[t.employeId].active = t;
  }
  const lignesTemps = Object.values(parEmploye);
  const monEntreeActive = probleme.entreesTemps.find((t) => t.employeId === moi && !t.fin);

  async function togglePoincon() {
    setEnCoursPoincon(true);
    await fetch(`/api/taches/${probleme.id}/poinconner`, { method: "POST" });
    setEnCoursPoincon(false);
    onRafraichir();
  }

  async function ajouterTempsManuel() {
    setErreurTempsManuel("");
    if (!empChoisi || !debutManuel || !finManuel) {
      setErreurTempsManuel("Choisis un employé, un début et une fin.");
      return;
    }
    setEnCours(true);
    const res = await fetch(`/api/taches/${probleme.id}/temps-manuel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId: empChoisi, debut: debutManuel, fin: finManuel }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurTempsManuel(data.erreur || "Erreur.");
      return;
    }
    setEmpChoisi(""); setDebutManuel(""); setFinManuel(""); setAfficherTempsManuel(false);
    onRafraichir();
  }

  async function sauvegarderEditionTemps(id) {
    setEnCours(true);
    await fetch(`/api/entrees-temps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debut: editDebut, fin: editFin }),
    });
    setEnCours(false);
    setEntreeEnEdition(null);
    onRafraichir();
  }

  async function supprimerEntreeTemps(id) {
    if (!window.confirm("Supprimer cette entrée de temps ?")) return;
    setEnCours(true);
    await fetch(`/api/entrees-temps/${id}`, { method: "DELETE" });
    setEnCours(false);
    onRafraichir();
  }

  async function sauvegarderEditionPiece(pieceUtiliseeId) {
    setEnCours(true);
    await fetch(`/api/bons/${bonId}/pieces/${pieceUtiliseeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prix: editPrix, qte: editQte }),
    });
    setEnCours(false);
    setPieceEnEdition(null);
    onRafraichir();
  }

  async function changerCategorie(categorieRevenu) {
    setEnCours(true);
    await fetch(`/api/bons/${bonId}/problemes/${probleme.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorieRevenu }),
    });
    setEnCours(false);
    onRafraichir();
  }

  async function ajouterPiece() {
    setErreurPiece("");
    setConfirmationPiece("");
    if (!pieceChoisie) return;
    setEnCours(true);
    const res = await fetch(`/api/bons/${bonId}/pieces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemeId: probleme.id, pieceId: pieceChoisie, qte: qtePiece }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurPiece(data.erreur || "Erreur lors de l'ajout.");
      return;
    }
    setPieceChoisie("");
    setQtePiece(1);
    setConfirmationPiece("Pièce ajoutée et déduite de l'inventaire ✓");
    onRafraichir();
    setTimeout(() => setConfirmationPiece(""), 2500);
  }

  async function retirerPiece(pieceUtiliseeId) {
    setEnCours(true);
    await fetch(`/api/bons/${bonId}/pieces/${pieceUtiliseeId}`, { method: "DELETE" });
    setEnCours(false);
    onRafraichir();
  }

  async function gererFichierPhoto(file) {
    setErreurPhoto("");
    setEnvoiPhoto(true);
    try {
      const dataUrl = await compresserImage(file);
      const res = await fetch(`/api/bons/${bonId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemeId: probleme.id, dataUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreurPhoto(data.erreur || `Le serveur a refusé la photo (code ${res.status}).`);
        return;
      }
      onRafraichir();
    } catch (e) {
      setErreurPhoto("Impossible de traiter cette photo : " + e.message);
    } finally {
      setEnvoiPhoto(false);
    }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 14 }}><strong style={{ color: "var(--text-muted)" }}>{index + 1}.</strong> {probleme.description}</span>
        {peutSupprimer && <button onClick={onSupprimer} style={boutonTexte}>✕</button>}
      </div>

      {peutModifier && (
        <select
          value={probleme.categorieRevenu || "MAIN_OEUVRE"}
          onChange={(e) => changerCategorie(e.target.value)}
          disabled={enCours}
          style={{ marginTop: 6, fontSize: 10.5, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-muted)" }}
        >
          <option value="MAIN_OEUVRE">🔧 Main-d'œuvre</option>
          <option value="ALIGNEMENT">📐 Alignement / équilibrage</option>
          <option value="REMORQUAGE">🚛 Remorquage</option>
          <option value="ENTREPOSAGE">🏬 Entreposage de pneus</option>
          <option value="AUTRE">➕ Autre revenu</option>
        </select>
      )}

      {/* Horodateur propre à cette tâche */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: lignesTemps.length > 0 ? 6 : 0 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>⏱ Temps sur cette tâche</span>
          {peutPoinconner && (
            <button
              onClick={togglePoincon}
              disabled={enCoursPoincon}
              style={{
                fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                background: monEntreeActive ? "#3a2620" : "var(--accent)",
                color: monEntreeActive ? "var(--danger)" : "#17150f",
              }}
            >
              {monEntreeActive ? "Arrêter mon poinçon" : "Démarrer mon poinçon"}
            </button>
          )}
        </div>
        {lignesTemps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {lignesTemps.map((l) => (
              <div key={l.employe.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>{l.employe.nom}</span>
                {l.active ? <LiveTimer debut={l.active.debut} /> : <span style={{ fontWeight: 600 }}>{fmtHeures(l.termine)}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Liste détaillée de chaque entrée (terminée), modifiable/supprimable par la secrétaire/gérant */}
        {peutModifier && probleme.entreesTemps.some((t) => t.fin) && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {probleme.entreesTemps.filter((t) => t.fin).map((t) => (
              <div key={t.id} style={{ background: "var(--bg)", borderRadius: 6, padding: "6px 8px" }}>
                {entreeEnEdition === t.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t.employe.nom}</span>
                    <input type="datetime-local" value={editDebut} onChange={(e) => setEditDebut(e.target.value)} style={champPetit} />
                    <input type="datetime-local" value={editFin} onChange={(e) => setEditFin(e.target.value)} style={champPetit} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => sauvegarderEditionTemps(t.id)} disabled={enCours} style={{ ...boutonTexte, color: "var(--accent)" }}>✓ Sauvegarder</button>
                      <button onClick={() => setEntreeEnEdition(null)} style={boutonTexte}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10.5 }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {t.employe.nom} · {new Date(t.debut).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })} → {new Date(t.fin).toLocaleTimeString("fr-CA", { timeStyle: "short" })} ({fmtHeures(dureeHeures(t.debut, t.fin))})
                    </span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { setEntreeEnEdition(t.id); setEditDebut(versInputLocal(t.debut)); setEditFin(versInputLocal(t.fin)); }} style={boutonTexte}>✏️</button>
                      <button onClick={() => supprimerEntreeTemps(t.id)} style={{ ...boutonTexte, color: "var(--danger)" }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Ajouter du temps manuellement — pour un employé qui a oublié de poinçonner */}
        {peutModifier && mecaniciens && mecaniciens.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {afficherTempsManuel ? (
              <div style={{ background: "var(--bg)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <select value={empChoisi} onChange={(e) => setEmpChoisi(e.target.value)} style={champPetit}>
                  <option value="">Choisir un employé…</option>
                  {mecaniciens.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
                <input type="datetime-local" value={debutManuel} onChange={(e) => setDebutManuel(e.target.value)} style={champPetit} />
                <input type="datetime-local" value={finManuel} onChange={(e) => setFinManuel(e.target.value)} style={champPetit} />
                {erreurTempsManuel && <p style={{ fontSize: 10.5, color: "var(--danger)" }}>{erreurTempsManuel}</p>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={ajouterTempsManuel} disabled={enCours} style={{ ...boutonTexte, color: "var(--accent)" }}>✓ Ajouter</button>
                  <button onClick={() => setAfficherTempsManuel(false)} style={boutonTexte}>Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAfficherTempsManuel(true)} style={{ ...boutonAjoutLigneTexte }}>
                + Attribuer du temps manuellement (employé oublié de poinçonner)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Photos */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{probleme.photos.length} photo(s)</span>
        <BoutonPhoto onFichier={gererFichierPhoto} enCours={envoiPhoto} />
      </div>
      {erreurPhoto && <p style={{ color: "var(--danger)", fontSize: 11, marginTop: 6 }}>{erreurPhoto}</p>}
      {probleme.photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
          {probleme.photos.map((p) => (
            <img key={p.id} src={p.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
          ))}
        </div>
      )}

      {/* Pièces de cette tâche précise */}
      {peutModifier && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Pièces pour cette tâche</span>
            {totalLigne > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{totalLigne.toFixed(2)} $</span>}
          </div>

          {probleme.pieces.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {probleme.pieces.map((l) => (
                <div key={l.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                  {pieceEnEdition === l.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 12 }}>{l.piece.nom}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="number" min={1} value={editQte} onChange={(e) => setEditQte(e.target.value)} placeholder="Qté" style={{ ...champPetit, width: 60 }} />
                        <input type="number" min={0} step="0.01" value={editPrix} onChange={(e) => setEditPrix(e.target.value)} placeholder="Prix" style={{ ...champPetit, flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => sauvegarderEditionPiece(l.id)} disabled={enCours} style={{ ...boutonTexte, color: "var(--accent)" }}>✓ Sauvegarder</button>
                        <button onClick={() => setPieceEnEdition(null)} style={boutonTexte}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13 }}>{l.piece.nom}</div>
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{l.qte} × {l.prix.toFixed(2)} $</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{(l.qte * l.prix).toFixed(2)} $</span>
                        {peutModifier && (
                          <button onClick={() => { setPieceEnEdition(l.id); setEditPrix(String(l.prix)); setEditQte(String(l.qte)); }} style={boutonTexte}>✏️</button>
                        )}
                        <button onClick={() => retirerPiece(l.id)} style={boutonTexte}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <select value={pieceChoisie} onChange={(e) => setPieceChoisie(e.target.value)} style={{ ...champStyle, fontSize: 12, padding: "7px 8px" }}>
              <option value="">Choisir une pièce…</option>
              {piecesDisponibles.map((p) => (
                <option key={p.id} value={p.id}>{p.nom} — {p.qte} en stock</option>
              ))}
            </select>
            <input
              type="number" min={1} value={qtePiece}
              onChange={(e) => setQtePiece(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ ...champStyle, width: 48, textAlign: "center", fontSize: 12, padding: "7px 4px" }}
            />
            <button onClick={ajouterPiece} disabled={!pieceChoisie || enCours} style={{ ...boutonAjout, padding: "0 12px" }}>+</button>
          </div>
          {erreurPiece && <p style={{ color: "var(--danger)", fontSize: 11, marginTop: 6 }}>{erreurPiece}</p>}
          {confirmationPiece && <p style={{ color: "var(--success)", fontSize: 11, marginTop: 6 }}>{confirmationPiece}</p>}
        </div>
      )}
    </div>
  );
}

function LiveTimer({ debut }) {
  const [t, setT] = useState(tempsEcoule(debut));
  useEffect(() => {
    const id = setInterval(() => setT(tempsEcoule(debut)), 1000);
    return () => clearInterval(id);
  }, [debut]);
  return <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>{t}</span>;
}

function StatutFacturePill({ statut }) {
  const couleurs = { IMPAYEE: "#C9A227", PAYEE: "#6FA96B", ANNULEE: "#C15B4A" };
  const labels = { IMPAYEE: "Impayée", PAYEE: "Payée", ANNULEE: "Annulée" };
  const c = couleurs[statut];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: `${c}22`, color: c }}>
      {labels[statut]}
    </span>
  );
}

function StatusPill({ statut }) {
  const s = STATUTS[statut];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: `${s.color}22`, color: s.color }}>
      {s.label}
    </span>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--text-muted)", marginBottom: 8 }}>{children}</div>;
}

function BoutonPhoto({ onFichier, enCours }) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        type="button"
        disabled={enCours}
        onClick={() => inputRef.current?.click()}
        style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", cursor: "pointer" }}
      >
        {enCours ? "Envoi…" : "📷 Photo"}
      </button>
      <input
        ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFichier(f); e.target.value = ""; }}
      />
    </>
  );
}

const champStyle = {
  flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13,
};

const boutonAjout = {
  padding: "0 16px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--accent)", fontSize: 16, cursor: "pointer",
};

const boutonTexte = {
  background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13,
};
const champPetit = {
  width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 12, boxSizing: "border-box",
};
const boutonAjoutLigneTexte = {
  background: "none", border: "1px dashed var(--border)", color: "var(--accent)", fontSize: 11,
  padding: "6px 10px", borderRadius: 8, cursor: "pointer", width: "100%",
};
