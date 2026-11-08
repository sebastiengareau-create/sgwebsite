"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, Pastille, TitrePanneau, BoutonContour, stylePanneau } from "../../../../components/StyleSection";
import { LABEL_MODE_PAIEMENT } from "@/lib/modesPaiement";
import { etatEcheance } from "@/lib/echeance";
import { FormulairePaiementDepense, FormulaireEditionDepense, BoutonAction, formaterDate, lienDepense } from "../ComptesAPayerClient";
import { argent } from "@/lib/format";

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

  const couleur = payee ? "var(--success)" : echeance?.enRetard ? "var(--danger)" : "var(--avertissement)";
  const fond = payee ? "var(--success-fond)" : echeance?.enRetard ? "var(--danger-fond)" : "var(--avertissement-fond)";

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/comptes-a-payer" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux comptes à payer</Link>

      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleur }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleur, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: TEINTES.bleu.fond, color: TEINTES.bleu.couleur,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800,
          }}>
            {depense.fournisseur.nom.charAt(0).toUpperCase()}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link href={`/gerant/fournisseurs/${depense.fournisseurId}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 17, fontWeight: 800, color: "var(--text)", textDecoration: "none" }}>
              {depense.fournisseur.nom} <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
            </Link>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>{depense.description}</div>
          </div>
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Montant de la facture</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{argent(depense.montant)}</div>
          </div>
          <Pastille couleur={couleur} fond={fond}>{payee ? "Payée" : (echeance?.texte || "Impayée")}</Pastille>
        </div>
        {depense.commandeFournisseur && (
          <Link href={`/secretaire/inventaire/commandes/${depense.commandeFournisseur.id}`} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)", textDecoration: "none", marginTop: 12, padding: "5px 10px", borderRadius: 999, background: "rgba(232,163,61,0.16)" }}>
            <Icone nom="panier" taille={14} couleur="var(--accent-ombre)" /> Réception de la commande {depense.commandeFournisseur.numero}
          </Link>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {mode === null && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${payee ? 2 : 3}, 1fr)`, gap: 8, marginBottom: 16 }}>
          {!payee && (
            <BoutonAction icone="crochet" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={() => setMode("payer")}>Payer</BoutonAction>
          )}
          <BoutonAction icone="crayon" onClick={() => setMode("modifier")}>Corriger</BoutonAction>
          <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={enCours ? undefined : supprimer}>{enCours ? "…" : "Supprimer"}</BoutonAction>
        </div>
      )}

      {mode === "payer" && (
        <div style={stylePanneau}>
          <TitrePanneau icone="banque" teinte={TEINTES.vert} titre="Enregistrer le paiement" sousTitre="Compte, mode de paiement et numéro de chèque ou de transaction." />
          <FormulairePaiementDepense depense={depense} comptesTresorerie={comptesTresorerie} onTermine={termine} onAnnuler={() => setMode(null)} />
        </div>
      )}
      {mode === "modifier" && (
        <div style={stylePanneau}>
          <TitrePanneau icone="crayon" titre="Corriger la facture" sousTitre="Les écritures comptables sont ajustées automatiquement." />
          <FormulaireEditionDepense
            depense={depense} fournisseurs={fournisseurs} categories={categories} tpsTaux={tpsTaux} tvqTaux={tvqTaux}
            onTermine={termine} onAnnuler={() => setMode(null)}
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ ...stylePanneau, marginBottom: 0 }}>
          <TitrePanneau icone="calendrier" teinte={TEINTES.ambre} titre="Facture" />
          <LigneDetail label="Date de la facture" valeur={formaterDate(depense.dateFacture)} premiere />
          <LigneDetail label="Échéance" valeur={depense.dateEcheance ? formaterDate(depense.dateEcheance) : "—"} />
          <LigneDetail label="Saisie le" valeur={formaterDate(depense.creeLe)} />
        </div>
        {payee && (
          <div style={{ ...stylePanneau, marginBottom: 0 }}>
            <TitrePanneau icone="banque" teinte={TEINTES.vert} titre="Paiement" />
            <LigneDetail label="Payée le" valeur={depense.datePaiement ? formaterDate(depense.datePaiement) : "—"} premiere />
            <LigneDetail label="Mode" valeur={LABEL_MODE_PAIEMENT[depense.modePaiement] || depense.modePaiement || "—"} />
            <LigneDetail label="Compte" valeur={depense.compteTresorerie?.nom || "—"} />
            <LigneDetail label="Référence" valeur={depense.referenceVersement || "—"} />
          </div>
        )}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="liste" teinte={TEINTES.bleu} titre="Détail par poste" sousTitre={`${depense.lignes.length} ligne${depense.lignes.length !== 1 ? "s" : ""}`} />
        {depense.lignes.map((l, i) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {l.piece ? `${l.piece.nom} (${l.piece.numero}) × ${l.qteRecue}` : l.categorieDepense.nom}
              </div>
              {(l.piece || l.description) && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {[l.piece && "Réception d'inventaire", l.description].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(l.montant)}</span>
          </div>
        ))}
        <div style={{ borderTop: "2px solid var(--accent)", marginTop: 4, paddingTop: 4 }}>
          <LigneDetail label="Sous-total" valeur={argent(sousTotal)} premiere />
          <LigneDetail label="TPS (récupérable)" valeur={argent(depense.tpsPayee)} />
          <LigneDetail label="TVQ (récupérable)" valeur={argent(depense.tvqPayee)} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "rgba(232,163,61,0.16)", marginTop: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(depense.montant)}</span>
        </div>
      </div>

      <div style={stylePanneau}>
        <TitrePanneau
          icone="immeuble" teinte={TEINTES.bleu} titre={`Solde dû à ${depense.fournisseur.nom}`}
          sousTitre={autresImpayees.length === 0 ? (payee ? "Aucune autre facture impayée pour ce fournisseur." : "C'est la seule facture impayée de ce fournisseur.") : `${autresImpayees.length} autre${autresImpayees.length !== 1 ? "s" : ""} facture${autresImpayees.length !== 1 ? "s" : ""} impayée${autresImpayees.length !== 1 ? "s" : ""}`}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: soldeFournisseur > 0 ? "var(--danger-fond)" : "var(--success-fond)", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: soldeFournisseur > 0 ? "var(--danger)" : "var(--success)" }}>{soldeFournisseur > 0 ? "Total dû" : "Rien à payer"}</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: soldeFournisseur > 0 ? "var(--danger)" : "var(--success)" }}>{argent(soldeFournisseur)}</span>
        </div>
        {autresImpayees.map((d, i) => {
          const etat = etatEcheance(d);
          const c = etat?.enRetard ? "var(--danger)" : "var(--avertissement)";
          return (
            <Link key={d.id} href={lienDepense(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)", padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Facture du {formaterDate(d.dateFacture)}</span>
                  {etat && <Pastille couleur={c} fond={etat.enRetard ? "var(--danger-fond)" : "var(--avertissement-fond)"}>{etat.texte}</Pastille>}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(d.montant)}</span>
              <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
            </Link>
          );
        })}
        <BoutonContour href={`/gerant/comptabilite/comptes-a-payer?fournisseur=${depense.fournisseurId}`} icone="presse" style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          Voir toutes les factures de ce fournisseur
        </BoutonContour>
      </div>
    </div>
  );
}

function LigneDetail({ label, valeur, premiere }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 2px", borderTop: premiere ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{valeur}</span>
    </div>
  );
}
