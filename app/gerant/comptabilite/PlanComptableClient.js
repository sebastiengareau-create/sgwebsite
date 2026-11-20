"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonContour, GroupeLiens } from "../../components/StyleSection";

const ORDRE_TYPE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];
const COULEUR_TYPE = { ACTIF: "#4F82C0", PASSIF: "#C9A227", CAPITAUX_PROPRES: "#9C978A", REVENU: "#6FA96B", DEPENSE: "#C15B4A" };

// Chaque groupe a sa teinte, pour se repérer d'un coup d'œil.
const GROUPES = [
  {
    titre: "Au quotidien", teinte: TEINTES.ambre,
    liens: [
      { href: "/gerant/comptabilite/transactions-bancaires", icone: "echange", label: "Transactions bancaires", detail: "Importer et classer les mouvements" },
      { href: "/gerant/comptabilite/rapprochement", icone: "liste", label: "Conciliation bancaire", detail: "Rapprocher le relevé et les livres" },
      { href: "/gerant/comptabilite/ecriture-manuelle", icone: "crayon", label: "Écriture supplémentaire", detail: "Ajouter une écriture manuelle" },
      { href: "/gerant/comptabilite/journal", icone: "livre", label: "Journal", detail: "Toutes les écritures, dans l'ordre" },
    ],
  },
  {
    titre: "Fin de période", teinte: TEINTES.bleu,
    liens: [
      { href: "/gerant/comptabilite/procedure", icone: "presse", label: "Procédure de fermeture", detail: "Liste des étapes à compléter" },
      { href: "/gerant/comptabilite/fermeture", icone: "cadenas", label: "Fermeture de période", detail: "Verrouiller les écritures" },
      { href: "/gerant/comptabilite/remise-gouvernementale", icone: "banque", label: "Remises à payer", detail: "TPS, TVQ, retenues sur la paie, REER et assurance des employés" },
    ],
  },
  {
    titre: "Rapports", teinte: TEINTES.vert,
    liens: [
      { href: "/gerant/comptabilite/rapports", icone: "imprimante", label: "Rapports imprimables", detail: "Exporter en PDF ou imprimer" },
      { href: "/gerant/comptabilite/previsions", icone: "tendance", label: "Prévisions de trésorerie", detail: "Entrées et sorties à venir" },
    ],
  },
  {
    titre: "Configuration", teinte: TEINTES.neutre,
    liens: [
      { href: "/gerant/comptabilite/immobilisations", icone: "boite", label: "Immobilisations", detail: "Actifs et amortissement" },
      { href: "/gerant/comptabilite/ouverture", icone: "drapeau", label: "Soldes d’ouverture", detail: "Montants au début de l’exercice" },
    ],
  },
];


export default function PlanComptableClient({ comptes, labelsType, estDeveloppeur, dateLabel, tresorerie }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [numero, setNumero] = useState("");
  const [nom, setNom] = useState("");
  const [type, setType] = useState("DEPENSE");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [renommageId, setRenommageId] = useState(null);
  const [nomRenommage, setNomRenommage] = useState("");
  const [erreurRenommage, setErreurRenommage] = useState("");

  const typesPresents = ORDRE_TYPE.filter((t) => comptes.some((c) => c.type === t));
  const [ongletType, setOngletType] = useState(typesPresents[0] || "ACTIF");

  // Suggère automatiquement le prochain numéro disponible pour le type
  // choisi (comme la numérotation EMP-/CLI-/FOUR-) — l'utilisateur reste
  // libre de le corriger, un numéro de compte ayant souvent un sens précis.
  const dernierNumeroSuggere = useRef("");
  useEffect(() => {
    if (!afficherFormulaire) return;
    let annule = false;
    fetch(`/api/comptabilite/comptes/prochain-numero?type=${type}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (annule || !data?.numero) return;
        // Capturé avant de muter la ref : l'updater ci-dessous peut s'exécuter
        // après cette ligne, donc comparer à dernierNumeroSuggere.current
        // directement comparerait la valeur au numéro qu'on est en train
        // d'appliquer plutôt qu'à l'ancienne suggestion.
        const suggestionPrecedente = dernierNumeroSuggere.current;
        dernierNumeroSuggere.current = data.numero;
        setNumero((actuel) => (actuel === "" || actuel === suggestionPrecedente ? data.numero : actuel));
      });
    return () => { annule = true; };
  }, [afficherFormulaire, type]);

  const totalActif = comptes.filter((c) => c.type === "ACTIF").reduce((s, c) => s + c.solde, 0);
  const totalPassif = comptes.filter((c) => c.type === "PASSIF").reduce((s, c) => s + c.solde, 0);
  const totalRevenu = comptes.filter((c) => c.type === "REVENU").reduce((s, c) => s + c.solde, 0);
  const totalDepense = comptes.filter((c) => c.type === "DEPENSE").reduce((s, c) => s + c.solde, 0);
  const profitNet = totalRevenu - totalDepense;

  const comptesOnglet = comptes.filter((c) => c.type === ongletType);

  async function creerCompte(e) {
    e.preventDefault();
    setErreur("");
    if (!numero.trim() || !nom.trim()) {
      setErreur("Numéro et nom requis.");
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/comptabilite/comptes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero, nom, type }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    setNumero(""); setNom(""); setAfficherFormulaire(false);
    router.refresh();
  }

  async function desactiverCompte(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Retirer ce compte du plan comptable ? Son historique reste intact, il sera juste caché de cette liste.")) return;
    await fetch(`/api/comptabilite/comptes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    router.refresh();
  }

  async function basculerTypeCharge(compte, e) {
    e.preventDefault();
    e.stopPropagation();
    const nouveau = (compte.typeCharge || "FIXE") === "FIXE" ? "VARIABLE" : "FIXE";
    await fetch(`/api/comptabilite/comptes/${compte.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typeCharge: nouveau }),
    });
    router.refresh();
  }

  function commencerRenommage(compte, e) {
    e.preventDefault();
    e.stopPropagation();
    setErreurRenommage("");
    setRenommageId(compte.id);
    setNomRenommage(compte.nom);
  }

  async function sauvegarderRenommage(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!nomRenommage.trim()) return;
    setErreurRenommage("");
    const res = await fetch(`/api/comptabilite/comptes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomRenommage.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurRenommage(data.erreur || "Erreur lors du renommage.");
      return;
    }
    setRenommageId(null);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <BandeauSection icone="💰" titre="Comptabilité" sousTitre="Les écritures se génèrent automatiquement à partir des factures, comptes à payer, de la paie et des mouvements d’inventaire." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <BoutonContour href="/gerant/comptabilite/etat-resultats" icone="graphique">État des résultats</BoutonContour>
        <BoutonContour href="/gerant/comptabilite/bilan" icone="balance">Bilan</BoutonContour>
      </div>

      <GrilleChiffres>
        <CarteChiffre
          titre="Revenus totaux" montant={argent(totalRevenu)} couleur="var(--success)" teinte="var(--success)"
          note={`Cumul à ce jour · au ${dateLabel}`}
        />
        <CarteChiffre
          titre="Profit net" montant={argent(profitNet)}
          couleur={profitNet >= 0 ? "var(--success)" : "var(--danger)"} teinte={profitNet >= 0 ? "var(--success)" : "var(--danger)"}
          note={`Cumul à ce jour · au ${dateLabel}`}
        />
        {tresorerie && (
          <CarteChiffre
            titre="Trésorerie" montant={argent(tresorerie.solde)} couleur="var(--text)" teinte="var(--bleu)"
            note={tresorerie.dateConciliation ? `Solde bancaire · dernière conciliation ${tresorerie.dateConciliation}` : "Solde bancaire · aucune conciliation encore"}
          />
        )}
      </GrilleChiffres>

      {GROUPES.map((g) => <GroupeLiens key={g.titre} {...g} />)}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Plan comptable</div>
        <button
          onClick={() => setAfficherFormulaire((v) => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700,
            whiteSpace: "nowrap", cursor: "pointer", border: "none",
            background: afficherFormulaire ? "var(--surface-alt)" : "var(--accent)", color: afficherFormulaire ? "var(--text)" : "#221f18",
          }}
        >
          {afficherFormulaire ? "Annuler" : <><Icone nom="plus" taille={16} /> Compte</>}
        </button>
      </div>

      {afficherFormulaire && (
        <form onSubmit={creerCompte} className="carte carte-m" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Numéro (ex : 4060)" value={numero} onChange={(e) => setNumero(e.target.value)}
              style={{ width: 110, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "monospace" }}
            />
            <input
              placeholder="Nom du compte" value={nom} onChange={(e) => setNom(e.target.value)}
              style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
            />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%", marginTop: 8, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}>
            {ORDRE_TYPE.map((t) => <option key={t} value={t}>{labelsType[t]}</option>)}
          </select>
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{erreur}</p>}
          <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            {enCours ? "Création…" : "Créer le compte"}
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)", marginBottom: 14 }}>
        {typesPresents.map((t) => {
          const actif = ongletType === t;
          return (
            <button
              key={t}
              onClick={() => setOngletType(t)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: actif ? 700 : 600,
                padding: "8px 14px", borderRadius: 9, whiteSpace: "nowrap", cursor: "pointer", border: "none",
                background: actif ? "var(--surface)" : "transparent", color: actif ? "var(--text)" : "var(--text-muted)",
                boxShadow: actif ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: COULEUR_TYPE[t], opacity: actif ? 1 : 0.6 }} />
              {labelsType[t]}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", padding: "0 10px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: `2px solid ${COULEUR_TYPE[ongletType]}` }}>
          <span style={{ width: 64 }}>N°</span>
          <span style={{ flex: 1 }}>Compte — {labelsType[ongletType]}</span>
          <span>Solde</span>
        </div>
        <div>
          {comptesOnglet.map((c, i) => (
            <Link key={c.id} href={`/gerant/comptabilite/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                padding: "12px 10px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                  <span style={{ width: 64, flexShrink: 0, fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{c.numero}</span>
                  {renommageId === c.id ? (
                    <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                      <input
                        value={nomRenommage}
                        onChange={(e) => setNomRenommage(e.target.value)}
                        autoFocus
                        style={{ fontSize: 13, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
                      />
                      <button onClick={(e) => sauvegarderRenommage(c.id, e)} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>✓</button>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRenommageId(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 14 }}>{c.nom}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(c.solde)}</span>
                  {ongletType === "DEPENSE" && (
                    <button
                      onClick={(e) => basculerTypeCharge(c, e)}
                      title="Utilisé pour le seuil de rentabilité (Vue d'ensemble) — clique pour changer"
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, cursor: "pointer",
                        border: `1px solid ${(c.typeCharge || "FIXE") === "VARIABLE" ? "var(--accent)" : "var(--border)"}`,
                        background: (c.typeCharge || "FIXE") === "VARIABLE" ? "rgba(232,163,61,0.15)" : "var(--bg)",
                        color: (c.typeCharge || "FIXE") === "VARIABLE" ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      {(c.typeCharge || "FIXE") === "VARIABLE" ? "Variable" : "Fixe"}
                    </button>
                  )}
                  {estDeveloppeur && renommageId !== c.id && (
                    <button onClick={(e) => commencerRenommage(c, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 4 }}>✏️</button>
                  )}
                  {c.nbEcritures === 0 && (
                    <button onClick={(e) => desactiverCompte(c.id, e)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: 4 }}>✕</button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {comptesOnglet.some((c) => c.id === renommageId) && erreurRenommage && (
          <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreurRenommage}</p>
        )}
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 0" }}>
        Actif total : {argent(totalActif)} · Passif total : {argent(totalPassif)}
      </p>
      </div>
    </div>
  );
}
