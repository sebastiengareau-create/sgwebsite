"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, BoutonPlein, Pastille } from "../../../components/StyleSection";

export default function JournalClient({ ecritures, estDev }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(null);

  async function supprimerUne(id) {
    if (!window.confirm("Supprimer cette écriture ? Cette action est irréversible.")) return;
    setEnCours(id);
    const res = await fetch(`/api/comptabilite/ecritures/${id}`, { method: "DELETE" });
    setEnCours(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  async function toutReinitialiser() {
    if (!window.confirm(`Supprimer les ${ecritures.length} écriture(s) ? À utiliser seulement en période de test — irréversible.`)) return;
    if (!window.confirm("Vraiment sûr ? Toute la comptabilité repart à zéro.")) return;
    setEnCours("tout");
    const res = await fetch("/api/comptabilite/ecritures", { method: "DELETE" });
    setEnCours(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la réinitialisation.");
      return;
    }
    router.refresh();
  }

  const nbManuelles = ecritures.filter((e) => e.source === "MANUEL").length;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📖" titre="Journal général" sousTitre="Toutes les écritures — automatiques (factures, paie, dépenses…) et manuelles." />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <BoutonPlein href="/gerant/comptabilite/ecriture-manuelle" icone="crayon">Nouvelle écriture supplémentaire</BoutonPlein>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
        {[
          ["Écritures", ecritures.length, "var(--accent)"],
          ["Automatiques", ecritures.length - nbManuelles, "var(--bleu)"],
          ["Manuelles", nbManuelles, "var(--accent-ombre)"],
        ].map(([libelle, n, teinte]) => (
          <div key={libelle} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 10px 10px 14px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte }} />
            <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{n}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{libelle}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ecritures.map((e) => {
          const manuelle = e.source === "MANUEL";
          const teinte = manuelle ? "var(--accent)" : "var(--bleu)";
          return (
            <div key={e.id} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px", opacity: enCours === e.id ? 0.6 : 1 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)" }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{e.numero}{e.reference ? ` · ${e.reference}` : ""}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {manuelle
                    ? <Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.14)">Manuelle</Pastille>
                    : <Pastille couleur="var(--bleu)" fond="var(--bleu-fond)">Automatique</Pastille>}
                  {new Date(e.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{e.description}</div>
              {e.creePar && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>par {e.creePar}</div>}

              <div style={{ marginTop: 10, borderRadius: 12, background: "var(--bg)", padding: "6px 10px" }}>
                <div style={{ display: "flex", gap: 8, fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ flex: 1 }}>Compte</span>
                  <span style={{ width: 92, textAlign: "right" }}>Débit</span>
                  <span style={{ width: 92, textAlign: "right" }}>Crédit</span>
                </div>
                {e.lignes.map((l) => (
                  <div key={l.id} style={{ display: "flex", gap: 8, fontSize: 13, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums", marginRight: 6 }}>{l.compte.numero}</span>
                      {l.compte.nom}
                    </span>
                    <span style={{ width: 92, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{l.debit > 0 ? argent(l.debit) : ""}</span>
                    <span style={{ width: 92, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{l.credit > 0 ? argent(l.credit) : ""}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => supprimerUne(e.id)}
                disabled={enCours === e.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--danger)", background: "var(--bg)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 10, cursor: "pointer" }}
              >
                <Icone nom="poubelle" taille={14} /> Supprimer
              </button>
            </div>
          );
        })}
        {ecritures.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Aucune écriture encore.</p>
          </div>
        )}
      </div>

      {estDev && ecritures.length > 0 && (
        <button
          onClick={toutReinitialiser}
          disabled={enCours === "tout"}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", margin: "20px 0", padding: 12, borderRadius: 12, border: "1px dashed var(--danger)", background: "var(--danger-fond)", color: "var(--danger)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <Icone nom="poubelle" taille={16} /> Tout réinitialiser (période de test)
        </button>
      )}
    </div>
  );
}
