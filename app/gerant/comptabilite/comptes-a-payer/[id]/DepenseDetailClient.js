"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection, LigneInfo } from "../../../../components/ui";
import { LABEL_MODE_PAIEMENT } from "@/lib/modesPaiement";
import { etatEcheance } from "@/lib/echeance";
import { FormulairePaiementDepense, FormulaireEditionDepense, formaterDate, lienDepense } from "../ComptesAPayerClient";

export default function DepenseDetailClient({ depense, fournisseurs, categories, comptesTresorerie, tpsTaux, tvqTaux, autresImpayees }) {
  const router = useRouter();
  const [mode, setMode] = useState(null); // null | "payer" | "modifier"
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const payee = depense.statut === "PAYEE";
  const echeance = etatEcheance(depense);
  const sousTotal = depense.lignes.reduce((s, l) => s + l.montant, 0);
  const soldeFournisseur = autresImpayees.reduce((s, d) => s + d.montant, 0) + (payee ? 0 : depense.montant);

  async function supprimer() {
    if (!window.confirm("Supprimer cette dépense ? Retire aussi les écritures comptables liées.")) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/depenses/${depense.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/gerant/comptabilite/comptes-a-payer");
    router.refresh();
  }

  function termine() {
    setMode(null);
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/comptes-a-payer" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux comptes à payer</Link>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `4px solid ${payee ? "var(--success)" : echeance?.enRetard ? "var(--danger)" : "#C9A227"}`, borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16 }}>
        <Link href={`/gerant/fournisseurs/${depense.fournisseurId}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
          🏢 {depense.fournisseur.nom} →
        </Link>
        <div style={{ fontSize: 15, marginTop: 4 }}>{depense.description}</div>
        {depense.commandeFournisseur && (
          <Link href={`/secretaire/inventaire/commandes/${depense.commandeFournisseur.id}`} style={{ display: "inline-block", fontSize: 12, color: "var(--accent)", textDecoration: "none", marginTop: 4 }}>
            🛒 Réception de la commande {depense.commandeFournisseur.numero} →
          </Link>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{depense.montant.toFixed(2)} $</div>
          <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: payee ? "var(--success)" : echeance?.enRetard ? "var(--danger)" : "#C9A227", color: payee || echeance?.enRetard ? "white" : "#17150f" }}>
            {payee ? "✓ Payée" : (echeance?.texte || "Impayée")}
          </span>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {mode === "payer" && (
        <div className="carte" style={{ marginBottom: 12 }}>
          <TitreSection>Enregistrer le paiement</TitreSection>
          <FormulairePaiementDepense depense={depense} comptesTresorerie={comptesTresorerie} onTermine={termine} onAnnuler={() => setMode(null)} />
        </div>
      )}
      {mode === "modifier" && (
        <div className="carte" style={{ marginBottom: 12 }}>
          <TitreSection>Corriger la facture</TitreSection>
          <FormulaireEditionDepense
            depense={depense} fournisseurs={fournisseurs} categories={categories} tpsTaux={tpsTaux} tvqTaux={tvqTaux}
            onTermine={termine} onAnnuler={() => setMode(null)}
          />
        </div>
      )}

      {mode === null && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {!payee && (
            <button onClick={() => setMode("payer")} className="bouton-3d" style={{ flex: 1, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
              💸 Marquer payée
            </button>
          )}
          <button onClick={() => setMode("modifier")} className={payee ? "bouton-3d" : "bouton-3d-sombre"} style={{ flex: payee ? 1 : undefined, padding: "11px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
            ✏️ Modifier
          </button>
          <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ padding: "11px 14px", borderRadius: 10, fontSize: 13 }}>
            🗑️
          </button>
        </div>
      )}

      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Facture</TitreSection>
        <LigneInfo label="Date de la facture" valeur={formaterDate(depense.dateFacture)} />
        <LigneInfo label="Échéance" valeur={depense.dateEcheance ? formaterDate(depense.dateEcheance) : null} />
        <LigneInfo label="Saisie le" valeur={formaterDate(depense.creeLe)} />
      </div>

      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Détail par poste</TitreSection>
        {depense.lignes.map((l) => (
          <div key={l.id} className="ligne-info">
            <span>
              {l.piece ? `📦 ${l.piece.nom} (${l.piece.numero}) × ${l.qteRecue}` : l.categorieDepense.nom}
              {l.description ? ` — ${l.description}` : ""}
            </span>
            <span>{l.montant.toFixed(2)} $</span>
          </div>
        ))}
        <LigneInfo label="Sous-total" valeur={`${sousTotal.toFixed(2)} $`} />
        <LigneInfo label="TPS (récupérable)" valeur={`${depense.tpsPayee.toFixed(2)} $`} />
        <LigneInfo label="TVQ (récupérable)" valeur={`${depense.tvqPayee.toFixed(2)} $`} />
        <LigneInfo label="Total" valeur={`${depense.montant.toFixed(2)} $`} />
      </div>

      {payee && (
        <div className="carte" style={{ marginBottom: 12 }}>
          <TitreSection>Paiement</TitreSection>
          <LigneInfo label="Payée le" valeur={depense.datePaiement ? formaterDate(depense.datePaiement) : null} />
          <LigneInfo label="Mode" valeur={LABEL_MODE_PAIEMENT[depense.modePaiement] || depense.modePaiement} />
          <LigneInfo label="Compte" valeur={depense.compteTresorerie?.nom} />
          <LigneInfo label="Référence" valeur={depense.referenceVersement} />
        </div>
      )}

      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Solde dû à {depense.fournisseur.nom}</TitreSection>
        <div style={{ fontSize: 18, fontWeight: 700, color: soldeFournisseur > 0 ? "var(--danger)" : "var(--success)", marginBottom: 6 }}>
          {soldeFournisseur.toFixed(2)} $
        </div>
        {autresImpayees.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            {payee ? "Aucune autre facture impayée pour ce fournisseur." : "C'est la seule facture impayée de ce fournisseur."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Autres factures impayées :</div>
            {autresImpayees.map((d) => {
              const etat = etatEcheance(d);
              return (
                <Link key={d.id} href={lienDepense(d.id)} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, textDecoration: "none", color: "var(--text)", padding: "6px 8px", borderRadius: 6, background: "var(--bg)" }}>
                  <span>
                    {formaterDate(d.dateFacture)} — {d.description}
                    {etat && <span style={{ color: etat.couleur, marginLeft: 6, fontSize: 10.5, fontWeight: 700 }}>{etat.texte}</span>}
                  </span>
                  <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{d.montant.toFixed(2)} $ ›</span>
                </Link>
              );
            })}
            <Link href={`/gerant/comptabilite/comptes-a-payer?fournisseur=${depense.fournisseurId}`} style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 4 }}>
              Voir toutes les factures de ce fournisseur
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
