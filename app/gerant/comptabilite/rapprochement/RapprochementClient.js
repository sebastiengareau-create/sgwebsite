"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const aujourdhuiQuebec = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function RapprochementClient({ comptesTresorerie, compteId, categorie, soldeOuverture, lignes, historique }) {
  const router = useRouter();
  const [soldeReleve, setSoldeReleve] = useState("");
  const [dateReleve, setDateReleve] = useState(aujourdhuiQuebec);
  const [enCours, setEnCours] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");

  const estCarte = categorie === "CARTE_CREDIT";

  // Seules les lignes datées jusqu'au relevé entrent dans cette conciliation ;
  // les suivantes attendent le prochain relevé.
  const lignesPeriode = useMemo(() => lignes.filter((l) => l.dateStr <= dateReleve), [lignes, dateReleve]);
  const lignesApres = lignes.length - lignesPeriode.length;
  const enCirculation = lignesPeriode.filter((l) => !l.rapproche);

  const totalPointe = lignesPeriode.filter((l) => l.rapproche).reduce((s, l) => s + l.montant, 0);
  const totalEnCirculation = enCirculation.reduce((s, l) => s + l.montant, 0);
  const soldeRapproche = soldeOuverture + totalPointe;
  const soldeLivres = soldeRapproche + totalEnCirculation;
  const ecart = soldeReleve !== "" ? Number(soldeReleve) - soldeRapproche : null;
  const concorde = ecart !== null && Math.abs(ecart) < 0.01;

  function changerCompte(id) {
    router.push(`/gerant/comptabilite/rapprochement?compte=${id}`);
  }

  async function toggleLigne(id, actuel) {
    setEnCours(id);
    setErreur("");
    const res = await fetch(`/api/comptabilite/lignes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rapproche: !actuel }),
    });
    if (!res.ok) setErreur((await res.json().catch(() => ({}))).erreur || "Impossible de modifier cette ligne.");
    setEnCours(null);
    router.refresh();
  }

  async function finaliser() {
    if (!concorde || !compteId) return;
    const nbPointees = lignesPeriode.length - enCirculation.length;
    if (!window.confirm(`Enregistrer la conciliation au ${dateReleve} ? Les ${nbPointees} ligne(s) pointée(s) seront verrouillées.`)) return;
    setEnregistrement(true);
    setErreur("");
    const res = await fetch("/api/comptabilite/rapprochement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compteTresorerieId: compteId, dateRapprochement: dateReleve, soldeReleve }),
    });
    setEnregistrement(false);
    if (!res.ok) {
      setErreur((await res.json().catch(() => ({}))).erreur || "Impossible d'enregistrer la conciliation.");
      return;
    }
    setSoldeReleve("");
    setConfirmation("Conciliation enregistrée ✓");
    router.refresh();
    setTimeout(() => setConfirmation(""), 3000);
  }

  async function annuler(id) {
    if (!window.confirm("Annuler cette conciliation ? Ses lignes redeviendront modifiables (elles restent cochées).")) return;
    setErreur("");
    const res = await fetch(`/api/comptabilite/rapprochement/${id}`, { method: "DELETE" });
    if (!res.ok) setErreur((await res.json().catch(() => ({}))).erreur || "Impossible d'annuler la conciliation.");
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>🏦 Conciliation bancaire</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Entre la date et le solde de ton relevé, puis coche chaque transaction qui y apparaît. Quand l'écart tombe à zéro, enregistre :
        les lignes cochées sont verrouillées et celles non cochées restent en circulation pour le prochain relevé.
      </p>

      <select
        value={compteId || ""}
        onChange={(e) => changerCompte(e.target.value)}
        style={{ ...champStyle, marginBottom: 16, fontWeight: 700 }}
      >
        {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>

      <div className="carte carte-m" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date du relevé</label>
            <input type="date" value={dateReleve} onChange={(e) => e.target.value && setDateReleve(e.target.value)} style={champStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{estCarte ? "Solde dû selon le relevé" : "Solde selon le relevé"}</label>
            <input type="number" step="0.01" value={soldeReleve} onChange={(e) => setSoldeReleve(e.target.value)} placeholder="0.00" style={champStyle} />
          </div>
        </div>

        <LigneSolde label="Solde d'ouverture (dernière conciliation)" montant={soldeOuverture} />
        <LigneSolde label="+ Transactions pointées" montant={totalPointe} />
        <LigneSolde label="= Solde concilié" montant={soldeRapproche} gras />

        {soldeReleve !== "" && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: concorde ? "rgba(111,169,107,0.12)" : "rgba(193,91,74,0.12)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: concorde ? "var(--success)" : "var(--danger)" }}>
              {concorde ? "✓ Ça concorde avec le relevé" : `Écart avec le relevé : ${ecart.toFixed(2)} $`}
            </div>
            {!concorde && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Coche les transactions qui apparaissent sur le relevé. S'il en manque une, ajoute l'écriture (frais bancaires, intérêts…) avant de concilier.
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 10 }}>
          <LigneSolde label={`Éléments en circulation (${enCirculation.length})`} montant={totalEnCirculation} discret />
          <LigneSolde label="Solde selon les livres au relevé" montant={soldeLivres} discret />
        </div>

        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8, fontWeight: 700 }}>{erreur}</p>}
        {confirmation && <p style={{ color: "var(--success)", fontSize: 12, marginTop: 8, fontWeight: 700 }}>{confirmation}</p>}
        <button
          onClick={finaliser} disabled={!concorde || enregistrement}
          className="bouton-3d" style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}
        >
          {enregistrement ? "Enregistrement…" : "Enregistrer la conciliation"}
        </button>
      </div>

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Transactions à concilier ({lignesPeriode.length})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {lignesPeriode.map((l) => (
          <label key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, cursor: "pointer", opacity: enCours === l.id ? 0.6 : 1 }}>
            <input type="checkbox" checked={l.rapproche} onChange={() => toggleLigne(l.id, l.rapproche)} disabled={enCours === l.id} style={{ width: 18, height: 18, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{l.description}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{l.dateStr} · {l.numero}</div>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: l.montant >= 0 ? "var(--success)" : "var(--danger)" }}>
              {l.montant >= 0 ? "+" : "−"}{Math.abs(l.montant).toFixed(2)} $
            </span>
          </label>
        ))}
        {lignesPeriode.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction à concilier jusqu'à cette date.</p>}
      </div>
      {lignesApres > 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 20 }}>
          {lignesApres} transaction(s) datée(s) après le {dateReleve} — elles seront conciliées avec le prochain relevé.
        </p>
      )}

      {historique.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, color: "var(--text-muted)", margin: "20px 0 8px" }}>Historique</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {historique.map((h, i) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{new Date(h.dateRapprochement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {h.soldeReleve.toFixed(2)} $</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                    {h._count.lignes > 0 ? `${h._count.lignes} ligne(s) verrouillée(s)` : "Ancienne conciliation (lignes non verrouillées)"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, color: Math.abs(h.ecart) < 0.01 ? "var(--success)" : "var(--danger)" }}>
                    {Math.abs(h.ecart) < 0.01 ? "✓ Concordant" : `Écart ${h.ecart.toFixed(2)} $`}
                  </span>
                  {i === 0 && (
                    <button onClick={() => annuler(h.id)} style={{ fontSize: 11, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}>
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LigneSolde({ label, montant, gras, discret }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: discret ? 12 : 13, marginBottom: 4 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: gras ? 700 : discret ? 500 : 600, color: discret ? "var(--text-muted)" : "var(--text)" }}>{montant.toFixed(2)} $</span>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };

const champStyle = {
  width: "100%", padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
