import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

export default function PrevisionsClient({ prevision }) {
  const {
    soldeActuel, clientsARecevoir, fournisseursAPayer, paiePrevue, paiePrevueEstimee, taxesARemettre, liquiditesProjetees,
  } = prevision;

  const lignes = [
    { label: "Solde actuel (liquidités)", montant: soldeActuel, signe: "" },
    { label: "Comptes clients à recevoir", montant: clientsARecevoir, signe: "+", href: "/gerant/comptabilite/rapports/comptes-clients" },
    { label: "Fournisseurs à payer", montant: fournisseursAPayer, signe: "−", href: "/gerant/comptabilite/comptes-a-payer" },
    { label: `Paie prévue${paiePrevueEstimee ? " (estimée)" : ""}`, montant: paiePrevue, signe: "−", href: "/gerant/paie" },
    { label: "Taxes et remises à remettre", montant: taxesARemettre, signe: "−", href: "/gerant/comptabilite/remise-gouvernementale" },
  ];

  const sorties = fournisseursAPayer + paiePrevue + taxesARemettre;
  const positif = liquiditesProjetees >= 0;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📈" titre="Prévisions de trésorerie" sousTitre="Tes liquidités si tout ce qui est déjà connu se réglait — pas une prédiction de nouvelles ventes." />
      </div>

      <div style={{ marginBottom: 10 }}>
        <CarteChiffre
          titre="Liquidités projetées" montant={argent(liquiditesProjetees)}
          couleur={positif ? "var(--success)" : "var(--danger)"} teinte={positif ? "var(--success)" : "var(--danger)"}
          note="Solde actuel + à recevoir − à payer"
        />
      </div>
      <GrilleChiffres>
        <CarteChiffre titre="Solde actuel" montant={argent(soldeActuel)} teinte="var(--bleu)" note="Liquidités en banque et en caisse" />
        <CarteChiffre titre="Entrées attendues" montant={`+ ${argent(clientsARecevoir)}`} couleur="var(--success)" teinte="var(--success)" note="Comptes clients à recevoir" />
        <CarteChiffre titre="Sorties prévues" montant={`− ${argent(sorties)}`} couleur="var(--danger)" teinte="var(--danger)" note="Fournisseurs, paie, taxes et remises" />
      </GrilleChiffres>

      {!positif && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--danger-fond)", borderLeft: "4px solid var(--danger)", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, color: "var(--danger)", fontWeight: 700, marginBottom: 16 }}>
          <Icone nom="alerte" taille={20} couleur="var(--danger)" />
          Si tout ce qui est dû se réglait maintenant, les liquidités deviendraient négatives.
        </div>
      )}

      <div style={stylePanneau}>
        <TitrePanneau icone="calculatrice" teinte={TEINTES.ambre} titre="Détail du calcul" sousTitre="Touche une ligne pour voir d'où vient le montant" />
        {lignes.map((l, i) => (
          <LigneMontant key={l.label} {...l} premier={i === 0} />
        ))}
        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, background: positif ? "var(--success-fond)" : "var(--danger-fond)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>= Liquidités projetées</span>
          <span style={{ fontWeight: 800, fontSize: 20, fontVariantNumeric: "tabular-nums", color: positif ? "var(--success)" : "var(--danger)" }}>
            {argent(liquiditesProjetees)}
          </span>
        </div>
        {paiePrevueEstimee && paiePrevue > 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "10px 0 0" }}>
            Aucun lot de paie en préparation — la paie prévue est estimée à partir de la moyenne des 3 derniers lots réguliers versés.
          </p>
        )}
      </div>
    </div>
  );
}

function LigneMontant({ label, montant, signe, href, premier }) {
  const teinte = signe === "+" ? TEINTES.vert : signe === "−" ? TEINTES.rouge : TEINTES.bleu;
  const contenu = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 4px", borderTop: premier ? "none" : "1px solid var(--border)" }}>
      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: teinte.fond, color: teinte.couleur, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>
        {signe || "="}
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: signe === "+" ? "var(--success)" : signe === "−" ? "var(--danger)" : "var(--text)" }}>
        {argent(montant)}
      </span>
      {href ? <Icone nom="chevron" taille={16} couleur="var(--text-muted)" /> : <span style={{ width: 16 }} />}
    </div>
  );
  if (!href) return contenu;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {contenu}
    </Link>
  );
}
