"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import FormulaireEncaissement from "../../components/FormulaireEncaissement";
import { regrouperParJour, cleMoisQuebec } from "@/lib/regroupementDates";
import DossiersParMois, { DossiersParMoisACharger } from "../../components/DossiersParMois";

const STATUTS = {
  IMPAYEE: { label: "Impayée", color: "#C9A227" },
  PAYEE: { label: "Payée", color: "#6FA96B" },
  ANNULEE: { label: "Annulée", color: "#C15B4A" },
};

// La page ne reçoit que les factures impayées et celles de ce mois-ci, plus
// le résumé des mois passés (moisAnciens), dont les dossiers se chargent à
// l'ouverture — voir lib/listeFactures.js. La recherche passe par le serveur
// pour couvrir tout l'historique.
export default function FacturesClient({ factures, moisAnciens, totaux, comptesTresorerie }) {
  const router = useRouter();
  const [filtre, setFiltre] = useState("IMPAYEE");
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState(null); // { q, factures, tronque } — réponse du serveur pour la recherche q
  const [avertissement, setAvertissement] = useState("");
  const [factureAPayer, setFactureAPayer] = useState(null); // id de la facture en train d'être marquée payée
  const [version, setVersion] = useState(0); // augmente après un paiement : recharge les dossiers ouverts
  const moisCharges = useRef(new Map()); // cle du mois → promesse de ses factures

  const q = recherche.trim().toLowerCase();

  // Recherche : les factures déjà chargées sont filtrées tout de suite, puis
  // le serveur répond avec tout l'historique.
  useEffect(() => {
    if (!q) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      fetch(`/api/factures?recherche=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { if (!annule) setResultats({ q, factures: d.factures, tronque: d.tronque }); })
        .catch(() => { if (!annule) setResultats({ q, factures: null }); });
    }, 300);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [q]);

  function chargerMois(cle) {
    if (!moisCharges.current.has(cle)) {
      const promesse = fetch(`/api/factures?mois=${cle}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => d.factures);
      promesse.catch(() => moisCharges.current.delete(cle));
      moisCharges.current.set(cle, promesse);
    }
    return moisCharges.current.get(cle).then((liste) => (filtre === "TOUTES" ? liste : liste.filter((f) => f.statut === filtre)));
  }

  const serveur = q && resultats?.q === q ? resultats : null;
  const rechercheEnCours = !!q && !serveur;
  const source = !q ? factures : serveur?.factures || factures.filter((f) => f.numero.toLowerCase().includes(q) || f.bon.client.nom.toLowerCase().includes(q) || f.bon.numero.toLowerCase().includes(q));
  const facturesFiltrees = source.filter((f) => filtre === "TOUTES" || f.statut === filtre);

  // Les factures du mois en cours restent affichées une par une ; les plus
  // anciennes vont dans un dossier repliable par mois d'émission (sauf les
  // impayées, toujours affichées une par une : c'est la liste de travail).
  // Hors recherche, ces dossiers se chargent à l'ouverture.
  const moisCourant = cleMoisQuebec(new Date());
  const estAncienne = (f) => cleMoisQuebec(f.dateEmission) < moisCourant;
  const anciennes = q && filtre === "TOUTES" ? facturesFiltrees.filter(estAncienne) : [];
  const recentes = !q && filtre === "TOUTES" ? facturesFiltrees.filter((f) => !estAncienne(f)) : facturesFiltrees.filter((f) => !anciennes.includes(f));
  const totalSansAnnulees = (liste) => liste.filter((f) => f.statut !== "ANNULEE").reduce((s, f) => s + f.totalAvecTaxes, 0);
  const dossiersACharger = q || filtre === "IMPAYEE" ? [] : moisAnciens.flatMap(({ cle, statuts }) => {
    const retenus = Object.entries(statuts).filter(([statut]) => filtre === "TOUTES" || statut === filtre);
    const nombre = retenus.reduce((s, [, r]) => s + r.nombre, 0);
    const total = retenus.filter(([statut]) => statut !== "ANNULEE").reduce((s, [, r]) => s + r.total, 0);
    return nombre > 0 ? [{ cle, nombre, resume: `${total.toFixed(2)} $` }] : [];
  });

  function carteFacture(f) {
    const joursEcoules = Math.floor((Date.now() - new Date(f.dateEmission).getTime()) / 86400000);
    const enRetard = f.statut === "IMPAYEE" && joursEcoules > 30;
    return (
      <div
        key={f.id}
        onClick={() => router.push(`/bons/${f.bon.id}`)}
        style={{ cursor: "pointer", background: "var(--surface)", border: enRetard ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 10, padding: 14, borderLeft: `3px solid ${STATUTS[f.statut].color}` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>
            #{f.numero}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {enRetard && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#17150f", background: "var(--danger)", padding: "2px 7px", borderRadius: 999 }}>
                ⚠ {joursEcoules}j
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 700, color: STATUTS[f.statut].color }}>{STATUTS[f.statut].label}</span>
          </div>
        </div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{f.bon.client.nom}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(f.dateEmission).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
        {f.statut === "PAYEE" && f.referenceVersement && (
          <div style={{ fontSize: 10.5, color: "var(--success)", marginTop: 2 }}>Réf. {f.referenceVersement}</div>
        )}
        {f.statut === "IMPAYEE" && f.montantPaye > 0 && (
          <div style={{ fontSize: 10.5, color: "var(--success)", marginTop: 2 }}>
            Payé {f.montantPaye.toFixed(2)} $ · <strong style={{ color: "#C9A227" }}>solde {(f.totalAvecTaxes - f.montantPaye).toFixed(2)} $</strong>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{f.totalAvecTaxes.toFixed(2)} $</span>
          {f.statut === "IMPAYEE" && factureAPayer !== f.id && (
            <button
              onClick={(e) => { e.stopPropagation(); setFactureAPayer(f.id); }}
              className="bouton-3d"
              style={{ fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8 }}
            >
              {f.montantPaye > 0 ? "Encaisser le solde" : "Marquer payée"}
            </button>
          )}
        </div>
        {factureAPayer === f.id && (
          <div onClick={(e) => e.stopPropagation()}>
            <FormulaireEncaissement
              comptesTresorerie={comptesTresorerie} solde={f.totalAvecTaxes - f.montantPaye}
              onConfirmer={(paiements) => encaisser(f.id, paiements)}
              onAnnuler={() => setFactureAPayer(null)}
            />
          </div>
        )}
      </div>
    );
  }

  const totalImpaye = factures.filter((f) => f.statut === "IMPAYEE").reduce((s, f) => s + f.totalAvecTaxes - f.montantPaye, 0);

  async function encaisser(id, paiements) {
    setAvertissement("");
    const res = await fetch(`/api/factures/${id}/paiements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paiements }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.erreur || "Erreur.";
    if (data.avertissementComptable) {
      setAvertissement(`Paiement enregistré, mais aucune écriture comptable créée : ${data.avertissementComptable}.`);
    }
    setFactureAPayer(null);
    moisCharges.current.clear();
    setVersion((v) => v + 1);
    router.refresh();
    return null;
  }

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Factures</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        {totaux.nombre} facture{totaux.nombre !== 1 ? "s" : ""} émise{totaux.nombre !== 1 ? "s" : ""} au total.
      </p>
      {avertissement && <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 12 }}>⚠️ {avertissement}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="carte carte-s">
          <div style={{ fontSize: 20, fontWeight: 700, color: "#C9A227" }}>{totalImpaye.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total impayé</div>
        </div>
        <div className="carte carte-s">
          <div style={{ fontSize: 20, fontWeight: 700, color: "#6FA96B" }}>{totaux.totalPaye.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total payé</div>
        </div>
      </div>

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher par numéro ou client…"
        style={{
          width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, marginBottom: 12, boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {["IMPAYEE", "PAYEE", "ANNULEE", "TOUTES"].map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer",
              background: filtre === f ? "var(--accent)" : "var(--surface)",
              color: filtre === f ? "#17150f" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {f === "TOUTES" ? "Toutes" : STATUTS[f].label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {regrouperParJour(recentes, (f) => f.dateEmission).map((g) => (
          <div key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "0 2px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{g.libelle}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                ({g.elements.length}) · {totalSansAnnulees(g.elements).toFixed(2)} $
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
        {g.elements.map(carteFacture)}
          </div>
        ))}
        <DossiersParMois
          elements={anciennes} obtenirDate={(f) => f.dateEmission} carte={carteFacture}
          ouvert={!!q} resume={(liste) => `${totalSansAnnulees(liste).toFixed(2)} $`}
        />
        <DossiersParMoisACharger key={filtre} mois={dossiersACharger} charger={chargerMois} carte={carteFacture} version={version} />
        {serveur?.tronque && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Seules les {serveur.factures.length} factures les plus récentes qui correspondent sont affichées — précise la recherche pour en trouver une plus ancienne.
          </p>
        )}
        {rechercheEnCours && facturesFiltrees.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>Recherche dans tout l'historique…</p>
        )}
        {!rechercheEnCours && facturesFiltrees.length === 0 && dossiersACharger.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🧾</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucune facture pour ce filtre — les factures se créent depuis un bon de commande terminé.</p>
          </div>
        )}
      </div>
    </div>
  );
}
