"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QUESTION_BON_NON_FACTURE } from "@/lib/bonsNonFactures";
import { CLIENT } from "@/lib/client";
import { correspondRecherche } from "@/lib/recherche";
import SectionDepots from "../../../components/SectionDepots";
import BoutonEnvoiCourriel from "../../../components/BoutonEnvoiCourriel";
import { argent, nombre } from "@/lib/format";
import { Icone, BoutonPlein, Pastille } from "../../../components/StyleSection";

const STATUTS = {
  EN_ATTENTE: { label: "En attente", color: "#C9A227" },
  ACCEPTEE: { label: "Acceptée", color: "#6FA96B" },
  FACTUREE: { label: "Facturée", color: "#6FA96B" },
};
// Anciennes valeurs possibles sur des soumissions créées avant ce changement
const LIBELLE_STATUT = (s) => STATUTS[s]?.label || (s === "BROUILLON" || s === "ENVOYEE" ? "En attente" : s === "REFUSEE" ? "Refusée" : s);
const COULEUR_STATUT = (s) => STATUTS[s]?.color || (s === "REFUSEE" ? "#C15B4A" : "#9C978A");

// Pièces choisies dans l'inventaire (déduites du stock au transfert)
const aDesPiecesInventaire = (s) => s.taches.some((t) => t.pieces.some((p) => p.pieceId && p.qte > 0));

export default function SoumissionsListe({ soumissions, comptesTresorerie = [], tauxHoraireClient, tpsTaux, tvqTaux }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [enCoursId, setEnCoursId] = useState(null);
  const [erreurId, setErreurId] = useState(null);

  const filtrees = soumissions.filter((s) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return correspondRecherche(q, s.clientNom, s.numero);
  });

  async function accepter(s, confirmerBonNonFacture = false) {
    if (!confirmerBonNonFacture && !window.confirm(`Accepter la soumission #${s.numero} ? Ça va créer un vrai bon de commande avec ces tâches.${aDesPiecesInventaire(s) ? " Les pièces de l'inventaire passent sur le bon et sont déduites du stock." : ""}`)) return;
    setErreurId(null);
    setEnCoursId(s.id);
    const res = await fetch(`/api/soumissions/${s.id}/accepter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmerBonNonFacture }),
    });
    setEnCoursId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Le client a déjà un bon non facturé : continuer ou non
      if (data.bonNonFacture) {
        if (window.confirm(`${data.erreur}\n\n${QUESTION_BON_NON_FACTURE}`)) return accepter(s, true);
        return;
      }
      setErreurId({ id: s.id, message: data.erreur || "Erreur." });
      return;
    }
    const { bonId } = await res.json();
    router.push(`/bons/${bonId}`);
  }

  // Profil soumissionFacturerDirect : facture exactement la soumission
  async function facturer(s) {
    if (!window.confirm(`Facturer la soumission #${s.numero} ? La facture reprend exactement ce qui a été entré (heures × taux, pièces), plus les taxes.${aDesPiecesInventaire(s) ? " Les pièces de l'inventaire sont déduites du stock." : ""}`)) return;
    setErreurId(null);
    setEnCoursId(s.id);
    const res = await fetch(`/api/soumissions/${s.id}/facturer`, { method: "POST" });
    setEnCoursId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErreurId({ id: s.id, message: data.erreur || "Erreur." });
      return;
    }
    if (data.avertissementComptable) window.alert(data.avertissementComptable);
    router.push(`/bons/${data.bonId}`);
  }

  async function remettreEnAttente(s) {
    const detail = s.statut === "FACTUREE"
      ? " Le bon et sa facture annulée restent comme historique ; la soumission pourra être facturée de nouveau. Ses pièces de l'inventaire reviennent en stock."
      : s.bonId ? " Le bon créé à partir d'elle sera supprimé (seulement s'il n'a pas de temps poinçonné) et ses pièces reviendront en stock." : "";
    if (!window.confirm(`Remettre la soumission #${s.numero} en attente ?${detail}`)) return;
    setErreurId(null);
    setEnCoursId(s.id);
    const res = await fetch(`/api/soumissions/${s.id}/remettre-en-attente`, { method: "POST" });
    setEnCoursId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurId({ id: s.id, message: data.erreur || "Erreur." });
      return;
    }
    router.refresh();
  }

  async function supprimer(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Supprimer cette soumission ?")) return;
    await fetch(`/api/soumissions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="conteneur-page-large" style={{ padding: 16, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein href="/secretaire/operations/soumissions/nouvelle" icone="plus">Nouvelle soumission</BoutonPlein>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Estimés à donner avant de commencer les travaux.</span>
        <div style={{ position: "relative", flex: "1 1 100%", minWidth: 0 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Client ou numéro…"
            style={{ width: "100%", padding: "11px 12px 11px 40px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtrees.map((s) => {
          const totalTemps = s.taches.reduce((sum, t) => sum + t.tempsEstime, 0);
          const totalPieces = s.taches.reduce((sum, t) => sum + t.pieces.reduce((s2, p) => s2 + p.prixEstime * p.qte, 0), 0);
          const totalEstime = (totalTemps * tauxHoraireClient + totalPieces) * (1 + (tpsTaux + tvqTaux) / 100);
          const dejaTransformee = !!s.bonId;
          const facturee = s.statut === "FACTUREE";
          // Acceptée (avec ou sans bon), ou facturée puis annulée : peut revenir en attente
          const peutRemettreEnAttente = !s.factureEnVigueur && (dejaTransformee || s.statut !== "EN_ATTENTE");
          const couleur = COULEUR_STATUT(s.statut);

          return (
            <div key={s.id} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: couleur }} />
              <Link href={`/secretaire/operations/soumissions/${s.id}/modifier`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>Soumission #{s.numero}</span>
                  <Pastille couleur={couleur} fond={`${couleur}22`}>{LIBELLE_STATUT(s.statut)}</Pastille>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{s.clientNom}</div>
                {s.vehiculeInfo && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
                    <Icone nom="vehicule" taille={14} /> {s.vehiculeInfo}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {s.taches.length} tâche{s.taches.length > 1 ? "s" : ""} · {Number.isInteger(totalTemps) ? totalTemps : nombre(totalTemps, 1)} h estimée{totalTemps > 1 ? "s" : ""}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--accent-ombre)", fontVariantNumeric: "tabular-nums" }}>{argent(totalEstime)}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>estimé, taxes incluses</span>
                  </span>
                </div>
              </Link>

              {dejaTransformee || peutRemettreEnAttente ? (
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {dejaTransformee && (
                    <Link href={`/bons/${s.bonId}`} style={{ ...boutonSoumission, flex: "1 1 220px", color: "var(--success)", borderColor: "var(--success)" }}>
                      {facturee ? (s.factureEnVigueur ? "Facturée — voir la facture" : "Facture annulée — voir le bon") : "Transformée en bon de commande"}
                      <Icone nom="chevron" taille={16} />
                    </Link>
                  )}
                  {peutRemettreEnAttente && (
                    <button onClick={() => remettreEnAttente(s)} disabled={enCoursId === s.id} style={{ ...boutonSoumission, flex: "1 1 180px", color: "var(--text-muted)" }}>
                      ↩ Remettre en attente
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {CLIENT.soumissionFacturerDirect ? (
                    <button onClick={() => facturer(s)} disabled={enCoursId === s.id} style={{ ...boutonSoumission, ...boutonVert }}>
                      <Icone nom="crochet" taille={17} /> Facturer
                    </button>
                  ) : (
                    <button onClick={() => accepter(s)} disabled={enCoursId === s.id} style={{ ...boutonSoumission, ...boutonVert }}>
                      <Icone nom="crochet" taille={17} /> Accepter et créer le bon
                    </button>
                  )}
                  <Link href={`/secretaire/operations/soumissions/${s.id}/imprimer`} target="_blank" style={boutonSoumission}>
                    <Icone nom="imprimante" taille={17} couleur="var(--accent-ombre)" /> Imprimer
                  </Link>
                  <BoutonEnvoiCourriel url={`/api/soumissions/${s.id}/envoyer`} courrielDefaut={s.client?.courriel} libelle="📧 Envoyer" style={boutonSoumission} />
                  <button onClick={(e) => supprimer(s.id, e)} aria-label="Supprimer la soumission" style={{ ...boutonSoumission, color: "var(--danger)" }}>
                    <Icone nom="poubelle" taille={17} /> Supprimer
                  </button>
                </div>
              )}
              {erreurId?.id === s.id && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{erreurId.message}</p>}
              {/* Dépôts (lib/depots.js) : une fois la soumission transformée en
                  bon, ils le suivent — les suivants se prennent sur le bon */}
              <SectionDepots
                compact depots={s.depots} totalEstime={dejaTransformee ? null : totalEstime} comptesTresorerie={comptesTresorerie}
                cible={{ soumissionId: s.id }} peutEncaisser={!dejaTransformee}
              />
              {dejaTransformee && s.depots.length > 0 && (
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "4px 0 0" }}>Dépôts passés au bon — solde et nouveaux dépôts sur sa fiche.</p>
              )}
            </div>
          );
        })}
        {filtrees.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 16 }}>
            <span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, background: "rgba(232,163,61,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icone nom="crayon" taille={26} couleur="var(--accent-ombre)" />
            </span>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 14 }}>
              {recherche.trim() ? `Aucune soumission ne correspond à « ${recherche.trim()} ».` : "Pas encore de soumission."}
            </p>
            {!recherche.trim() && <BoutonPlein href="/secretaire/operations/soumissions/nouvelle">Créer la première</BoutonPlein>}
          </div>
        )}
      </div>
    </div>
  );
}

// Boutons d'action d'une soumission : même largeur sur une rangée
const boutonSoumission = {
  flex: "1 1 90px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "10px 6px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 13, fontWeight: 700, textDecoration: "none", cursor: "pointer", boxSizing: "border-box", textAlign: "center",
};
// Action principale (accepter / facturer) : pleine largeur, verte
const boutonVert = { flex: "1 1 100%", background: "var(--success)", borderColor: "var(--success)", color: "#fff" };
