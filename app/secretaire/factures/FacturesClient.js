"use client";

import { useState, useEffect, useRef } from "react";
import { nomClientBon } from "@/lib/nomClient";
import { useRouter } from "next/navigation";
import FormulaireEncaissement from "../../components/FormulaireEncaissement";
import { regrouperParJour, cleMoisQuebec } from "@/lib/regroupementDates";
import DossiersParMois, { DossiersParMoisACharger } from "../../components/DossiersParMois";
import { correspondRecherche } from "@/lib/recherche";
import { argent } from "@/lib/format";
import { Icone, CarteChiffre, Pastille } from "../../components/StyleSection";

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
  const source = !q ? factures : serveur?.factures || factures.filter((f) => correspondRecherche(q, f.numero, nomClientBon(f.bon), f.bon.client.nom, f.bon.numero));
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
    return nombre > 0 ? [{ cle, nombre, resume: `${argent(total)}` }] : [];
  });

  function carteFacture(f) {
    const joursEcoules = Math.floor((Date.now() - new Date(f.dateEmission).getTime()) / 86400000);
    const enRetard = f.statut === "IMPAYEE" && joursEcoules > 30;
    return (
      <div
        key={f.id}
        onClick={() => router.push(`/bons/${f.bon.id}`)}
        style={{
          position: "relative", overflow: "hidden", cursor: "pointer", background: "var(--surface)",
          border: enRetard ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: STATUTS[f.statut].color }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
            Facture #{f.numero}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {enRetard && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">{joursEcoules} jours</Pastille>}
            <Pastille couleur={STATUTS[f.statut].color} fond={`${STATUTS[f.statut].color}22`}>{STATUTS[f.statut].label}</Pastille>
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{nomClientBon(f.bon)}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {new Date(f.dateEmission).toLocaleDateString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long", year: "numeric" })} · Bon #{f.bon.numero}
        </div>
        {f.statut === "PAYEE" && f.referenceVersement && (
          <div style={{ fontSize: 12, color: "var(--success)", marginTop: 3 }}>Réf. {f.referenceVersement}</div>
        )}
        {f.statut === "IMPAYEE" && f.montantPaye > 0 && (
          <div style={{ fontSize: 12, color: "var(--success)", marginTop: 3 }}>
            Payé {argent(f.montantPaye)} · <strong style={{ color: "var(--avertissement)" }}>solde {argent((f.totalAvecTaxes - f.montantPaye))}</strong>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(f.totalAvecTaxes)}</span>
          {f.statut === "IMPAYEE" && f.totalAvecTaxes < 0 && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)" }}>↩ À remettre au client — sur le bon</span>
          )}
          {f.statut === "IMPAYEE" && f.totalAvecTaxes >= 0 && factureAPayer !== f.id && (
            <button
              onClick={(e) => { e.stopPropagation(); setFactureAPayer(f.id); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--success)", color: "#fff", cursor: "pointer" }}
            >
              <Icone nom="crochet" taille={16} /> {f.montantPaye > 0 ? "Encaisser le solde" : "Marquer payée"}
            </button>
          )}
        </div>
        {factureAPayer === f.id && (
          <div onClick={(e) => e.stopPropagation()}>
            <FormulaireEncaissement
              comptesTresorerie={comptesTresorerie} solde={f.totalAvecTaxes - f.montantPaye}
              onConfirmer={(paiements) => encaisser(f.id, paiements)}
              onAnnuler={() => setFactureAPayer(null)}
              excedentEnCredit
            />
          </div>
        )}
      </div>
    );
  }

  const totalImpaye = factures.filter((f) => f.statut === "IMPAYEE").reduce((s, f) => s + Math.max(0, f.totalAvecTaxes - f.montantPaye), 0);

  async function encaisser(id, paiements) {
    setAvertissement("");
    const res = await fetch(`/api/factures/${id}/paiements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paiements, excedentEnCredit: true }),
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
    <div className="conteneur-page-large" style={{ padding: 16, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {avertissement && <p style={{ fontSize: 13, color: "var(--accent-ombre)", marginBottom: 12 }}>⚠️ {avertissement}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        <CarteChiffre
          titre="Total impayé" montant={argent(totalImpaye)}
          couleur={totalImpaye > 0.005 ? "var(--avertissement)" : "var(--success)"} teinte={totalImpaye > 0.005 ? "var(--avertissement)" : "var(--success)"}
          actif={filtre === "IMPAYEE"}
          onClick={() => setFiltre("IMPAYEE")}
          note="Solde à encaisser · touche pour les voir"
        />
        <CarteChiffre
          titre="Total payé" montant={argent(totaux.totalPaye)} couleur="var(--success)" teinte="var(--success)"
          note={`${totaux.nombre} facture${totaux.nombre !== 1 ? "s" : ""} émise${totaux.nombre !== 1 ? "s" : ""} au total`}
        />
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
        </span>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Numéro ou client…"
          style={{
            width: "100%", padding: "11px 12px 11px 40px", borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 14 }}>
        {["IMPAYEE", "PAYEE", "ANNULEE", "TOUTES"].map((f) => {
          const actif = filtre === f;
          const couleur = f === "TOUTES" ? null : STATUTS[f].color;
          return (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              style={{
                flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 13, fontWeight: 700, padding: "8px 10px", borderRadius: 9, whiteSpace: "nowrap", cursor: "pointer", border: "none",
                background: actif ? "var(--accent)" : "transparent", color: actif ? "#221f18" : "var(--text-muted)",
              }}
            >
              {couleur && <span style={{ width: 7, height: 7, borderRadius: "50%", background: actif ? "#221f18" : couleur }} />}
              {f === "TOUTES" ? "Toutes" : STATUTS[f].label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {regrouperParJour(recentes, (f) => f.dateEmission).map((g) => (
          <div key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "0 2px" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{g.libelle}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                ({g.elements.length}) · {argent(totalSansAnnulees(g.elements))}
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
        {g.elements.map(carteFacture)}
          </div>
        ))}
        <DossiersParMois
          elements={anciennes} obtenirDate={(f) => f.dateEmission} carte={carteFacture}
          ouvert={!!q} resume={(liste) => `${argent(totalSansAnnulees(liste))}`}
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
          <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 16 }}>
            <span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, background: "rgba(232,163,61,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icone nom="document" taille={26} couleur="var(--accent-ombre)" />
            </span>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Aucune facture pour ce filtre — les factures se créent depuis un bon de commande terminé.</p>
          </div>
        )}
      </div>
    </div>
  );
}
