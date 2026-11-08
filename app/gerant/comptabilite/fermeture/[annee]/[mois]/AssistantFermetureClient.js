"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../../../components/StyleSection";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUT_INFO = {
  OUVERTE: { label: "Ouverte", couleur: "var(--success)", fond: "var(--success-fond)", teinte: TEINTES.vert },
  VERROUILLEE: { label: "Verrouillée", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)", teinte: TEINTES.ambre },
  FERMEE: { label: "Fermée", couleur: "var(--danger)", fond: "var(--danger-fond)", teinte: TEINTES.rouge },
};

export default function AssistantFermetureClient({ annee, mois, statut, statutParNom, statutLe, resume, checklist, estGerantOuDev }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [afficherReouverture, setAfficherReouverture] = useState(false);
  const [motif, setMotif] = useState("");

  const info = STATUT_INFO[statut];

  async function verrouiller() {
    setErreur(""); setEnCours(true);
    const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/verrouiller`, { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  async function fermer() {
    if (!window.confirm(`Fermer ${NOMS_MOIS[mois - 1]} ${annee} ? Après fermeture, les écritures de cette période ne pourront plus être modifiées ni supprimées, et aucune nouvelle pièce datée dans cette période ne sera acceptée.`)) return;
    setErreur(""); setEnCours(true);
    const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/fermer`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors de la fermeture.");
      return;
    }
    router.refresh();
  }

  async function reouvrir() {
    if (!motif.trim()) {
      setErreur("Un motif est requis pour rouvrir cette période.");
      return;
    }
    if (!window.confirm("Rouvrir cette période ? Ça peut modifier les états financiers et les rapports fiscaux déjà produits.")) return;
    setErreur(""); setEnCours(true);
    const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/reouvrir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors de la réouverture.");
      return;
    }
    setMotif(""); setAfficherReouverture(false);
    router.refresh();
  }

  const benefice = resume.beneficeNet;

  return (
    <div className="conteneur-page">
      <Link href={`/gerant/comptabilite/fermeture?annee=${annee}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la fermeture de période</Link>

      {/* Carte de la période */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: info.couleur }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: info.couleur, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: info.teinte.fond, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom="cadenas" taille={28} couleur={info.teinte.couleur} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>Fermeture — {NOMS_MOIS[mois - 1]} {annee}</div>
            {statutParNom && statutLe && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                Par {statutParNom}, le {new Date(statutLe).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "short", timeStyle: "short" })}
              </div>
            )}
            <div style={{ marginTop: 8 }}><Pastille couleur={info.couleur} fond={info.fond}>{info.label}</Pastille></div>
          </div>
        </div>
      </div>

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="Revenus" montant={argent(resume.revenus)} teinte="var(--success)" note="Du mois" />
        <CarteChiffre titre="Dépenses" montant={argent(resume.depenses)} teinte="var(--danger)" note="Du mois" />
        <CarteChiffre
          titre="Bénéfice net" montant={argent(benefice)} teinte={benefice >= 0 ? "var(--success)" : "var(--danger)"}
          couleur={benefice >= 0 ? "var(--success)" : "var(--danger)"} note="Revenus − dépenses"
        />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau
          icone="crochet" teinte={checklist.peutFermer ? TEINTES.vert : TEINTES.rouge} titre="Checklist de fermeture"
          sousTitre={checklist.peutFermer ? "Tout est prêt pour fermer la période." : "Règle les points en rouge avant de fermer la période."}
          droite={<span style={{ fontSize: 17, fontWeight: 800, color: checklist.peutFermer ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap", paddingTop: 2 }}>{checklist.pourcentage} %</span>}
        />
        <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${checklist.pourcentage}%`, height: "100%", borderRadius: 999, background: checklist.peutFermer ? "var(--success)" : "var(--accent)" }} />
        </div>
        {checklist.blocages.map((b, i) => (
          <div key={b.cle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
              <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: b.ok ? "var(--success-fond)" : "var(--danger-fond)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom={b.ok ? "crochet" : "alerte"} taille={14} couleur={b.ok ? "var(--success)" : "var(--danger)"} />
              </span>
              {b.label}
            </span>
            {b.detail && <span style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>{b.detail}</span>}
          </div>
        ))}
        {checklist.informatifs.length > 0 && (
          <div style={{ marginTop: 10, padding: "4px 12px", borderRadius: 12, background: "var(--avertissement-fond)" }}>
            {checklist.informatifs.map((inf, i) => (
              <div key={inf.cle} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>{inf.label}</span>
                <span style={{ fontWeight: 700 }}>{inf.valeur}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="balance" teinte={TEINTES.bleu} titre="Soldes à la fin du mois" />
        <LigneDetail premiere label="TPS à remettre" valeur={argent(resume.tpsARemettre)} />
        <LigneDetail label="TVQ à remettre" valeur={argent(resume.tvqARemettre)} />
        <LigneDetail label="Clients à recevoir" valeur={argent(resume.clientsARecevoir)} />
        <LigneDetail label="Fournisseurs à payer" valeur={argent(resume.fournisseursAPayer)} />
        <LigneDetail label="Solde bancaire" valeur={argent(resume.soldeBancaire)} />
      </div>

      {statut !== "FERMEE" && (
        <p style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600, margin: "0 0 12px", padding: "10px 12px", borderRadius: 12, background: "var(--danger-fond)" }}>
          ⚠️ Après fermeture, les écritures de cette période ne pourront plus être modifiées ni supprimées, et aucune nouvelle pièce datée dedans ne sera acceptée. Une correction nécessitera une écriture d'ajustement ou une réouverture autorisée.
        </p>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{erreur}</p>}

      {statut !== "FERMEE" && (
        <div style={{ display: "grid", gridTemplateColumns: statut === "OUVERTE" ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 16 }}>
          {statut === "OUVERTE" && (
            <BoutonAction icone="cadenas" couleur="var(--avertissement)" bordure="var(--avertissement)" onClick={verrouiller} disabled={enCours}>Verrouiller</BoutonAction>
          )}
          <BoutonAction icone="cadenas" couleur="#fff" fond="var(--danger)" bordure="var(--danger)" onClick={fermer} disabled={enCours || !checklist.peutFermer}>Fermer la période</BoutonAction>
        </div>
      )}

      {estGerantOuDev && statut !== "OUVERTE" && (
        !afficherReouverture ? (
          <BoutonAction icone="echange" couleur="var(--danger)" onClick={() => setAfficherReouverture(true)} style={{ width: "100%", marginBottom: 16 }}>Rouvrir la période</BoutonAction>
        ) : (
          <div style={{ ...stylePanneau, border: "1.5px solid var(--danger)" }}>
            <TitrePanneau icone="echange" teinte={TEINTES.rouge} titre="Rouvrir la période" sousTitre="La réouverture peut modifier les états financiers et les rapports fiscaux déjà produits." />
            <textarea
              required
              placeholder="Motif de la réouverture (obligatoire)"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box", resize: "vertical" }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <BoutonAction icone="echange" couleur="#fff" fond="var(--danger)" bordure="var(--danger)" onClick={reouvrir} disabled={enCours}>Confirmer</BoutonAction>
              <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setAfficherReouverture(false)}>Annuler</BoutonAction>
            </div>
          </div>
        )
      )}
    </div>
  );
}
