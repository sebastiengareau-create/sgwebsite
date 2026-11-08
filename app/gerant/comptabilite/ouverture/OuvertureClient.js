"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

const LABELS_TYPE = { ACTIF: "Actif", PASSIF: "Passif", CAPITAUX_PROPRES: "Capitaux propres", REVENU: "Revenus", DEPENSE: "Dépenses" };
const ORDRE_TYPE = ["ACTIF", "PASSIF", "CAPITAUX_PROPRES", "REVENU", "DEPENSE"];
const STYLE_TYPE = {
  ACTIF: { icone: "banque", teinte: TEINTES.bleu },
  PASSIF: { icone: "presse", teinte: TEINTES.rouge },
  CAPITAUX_PROPRES: { icone: "balance", teinte: TEINTES.ambre },
  REVENU: { icone: "tendance", teinte: TEINTES.vert },
  DEPENSE: { icone: "panier", teinte: TEINTES.ambre },
};

export default function OuvertureClient({ comptes }) {
  const router = useRouter();
  const [montants, setMontants] = useState({});
  const [erreur, setErreur] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  const totalDebit = comptes
    .filter((c) => ["ACTIF", "DEPENSE"].includes(c.type))
    .reduce((s, c) => s + (Number(montants[c.numero]) || 0), 0);
  const totalCredit = comptes
    .filter((c) => !["ACTIF", "DEPENSE"].includes(c.type))
    .reduce((s, c) => s + (Number(montants[c.numero]) || 0), 0);
  const difference = totalDebit - totalCredit;

  async function enregistrer(e) {
    e.preventDefault();
    setErreur("");
    setConfirmation("");

    const soldes = Object.entries(montants)
      .filter(([, v]) => Number(v) > 0)
      .map(([compteNumero, montant]) => ({ compteNumero, montant: Number(montant) }));

    if (soldes.length === 0) {
      setErreur("Entre au moins un solde.");
      return;
    }

    setEnCours(true);
    const res = await fetch("/api/comptabilite/ouverture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soldes }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setConfirmation("Soldes d'ouverture enregistrés ✓");
    setMontants({});
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection
          icone="🏁" titre="Soldes d'ouverture"
          sousTitre="Les montants déjà présents avant de commencer à utiliser la comptabilité (ex. solde de banque actuel). La contrepartie s'équilibre automatiquement — pas besoin de calculer toi-même."
        />
      </div>

      <form onSubmit={enregistrer}>
        {ORDRE_TYPE.map((type) => {
          const comptesType = comptes.filter((c) => c.type === type);
          if (comptesType.length === 0) return null;
          const style = STYLE_TYPE[type];
          const sousTotal = comptesType.reduce((s, c) => s + (Number(montants[c.numero]) || 0), 0);
          return (
            <div key={type} style={stylePanneau}>
              <TitrePanneau
                icone={style.icone} teinte={style.teinte} titre={LABELS_TYPE[type]}
                sousTitre={["ACTIF", "DEPENSE"].includes(type) ? "Soldes au débit" : "Soldes au crédit"}
                droite={<span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: sousTotal > 0 ? style.teinte.couleur : "var(--text-muted)", paddingTop: 2 }}>{argent(sousTotal)}</span>}
              />
              {comptesType.map((c, i) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", cursor: "text" }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)", width: 40, flexShrink: 0 }}>{c.numero}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{c.nom}</span>
                  <span style={{ position: "relative", flexShrink: 0 }}>
                    <input
                      type="number" min={0} step="0.01" placeholder="0,00" inputMode="decimal" className="champ-sans-fleches"
                      value={montants[c.numero] || ""}
                      onChange={(e) => setMontants((prev) => ({ ...prev, [c.numero]: e.target.value }))}
                      style={{
                        width: 130, padding: "9px 26px 9px 10px", borderRadius: 10, fontSize: 14, textAlign: "right", boxSizing: "border-box",
                        fontVariantNumeric: "tabular-nums", color: "var(--text)",
                        background: Number(montants[c.numero]) > 0 ? style.teinte.fond : "var(--bg)",
                        border: `1px solid ${Number(montants[c.numero]) > 0 ? style.teinte.couleur : "var(--border)"}`,
                      }}
                    />
                    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-muted)", pointerEvents: "none" }}>$</span>
                  </span>
                </label>
              ))}
            </div>
          );
        })}

        <div style={{ position: "sticky", bottom: 88, zIndex: 20, background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: 16, padding: 14, marginBottom: 24, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            <BlocTotal titre="Débit" montant={totalDebit} />
            <BlocTotal titre="Crédit" montant={totalCredit} />
            <BlocTotal titre="Contrepartie" montant={Math.abs(difference)} accent />
          </div>
          {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{erreur}</p>}
          {confirmation && <p style={{ color: "var(--success)", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>{confirmation}</p>}
          <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
            {enCours ? "Enregistrement…" : "Enregistrer les soldes d'ouverture"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BlocTotal({ titre, montant, accent }) {
  return (
    <div style={{ minWidth: 0, padding: "8px 8px", borderRadius: 12, textAlign: "center", background: accent ? "rgba(232,163,61,0.16)" : "var(--bg)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: accent ? "var(--accent-ombre)" : "var(--text-muted)" }}>{titre}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(montant)}</div>
    </div>
  );
}
