"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, TitrePanneau, stylePanneau, BoutonContour, TitreGroupe, Pastille } from "../../../components/StyleSection";

const aujourdhuiQuebec = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function RapprochementClient({ comptesTresorerie, compteId, categorie, soldeOuverture, lignes, historique, releveSuggere }) {
  const router = useRouter();
  const [soldeReleve, setSoldeReleve] = useState(releveSuggere ? releveSuggere.solde.toFixed(2) : "");
  const [dateReleve, setDateReleve] = useState(releveSuggere?.date || aujourdhuiQuebec);
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
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🏦" titre="Conciliation bancaire" sousTitre="Coche chaque transaction du relevé ; quand l'écart tombe à zéro, enregistre." />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <BoutonContour href={`/gerant/comptabilite/transactions-bancaires?compte=${compteId || ""}`} icone="echange" style={{ flex: "1 1 200px", justifyContent: "center" }}>
          Importer d'abord le fichier de la banque
        </BoutonContour>
      </div>

      <div style={stylePanneau}>
        <TitrePanneau
          icone="banque" teinte={TEINTES.bleu} titre="Relevé"
          sousTitre="Les transactions reliées à tes livres arrivent cochées, et le solde du relevé est rempli d'office."
        />
        <select
          value={compteId || ""}
          onChange={(e) => changerCompte(e.target.value)}
          style={{ ...champStyle, marginBottom: 12, fontWeight: 700, fontSize: 15 }}
        >
          {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label style={labelStyle}>Date du relevé</label>
            <input type="date" max="9999-12-31" value={dateReleve} onChange={(e) => e.target.value && setDateReleve(e.target.value)} style={champStyle} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={labelStyle}>{estCarte ? "Solde dû selon le relevé" : "Solde selon le relevé"}</label>
            <input type="number" step="0.01" value={soldeReleve} onChange={(e) => setSoldeReleve(e.target.value)} placeholder="0.00" style={champStyle} />
          </div>
        </div>

        <LigneSolde label="Solde d'ouverture (dernière conciliation)" montant={soldeOuverture} />
        <LigneSolde label="+ Transactions pointées" montant={totalPointe} />
        <LigneSolde label="= Solde concilié" montant={soldeRapproche} gras />

        {soldeReleve !== "" && (
          <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, background: concorde ? "var(--success-fond)" : "var(--danger-fond)", borderLeft: `4px solid ${concorde ? "var(--success)" : "var(--danger)"}` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: concorde ? "var(--success)" : "var(--danger)" }}>
              {concorde ? "✓ Ça concorde avec le relevé" : `Écart avec le relevé : ${argent(ecart)}`}
            </div>
            {!concorde && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
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
          style={{
            width: "100%", marginTop: 12, padding: 13, borderRadius: 12, border: "none", fontWeight: 700, fontSize: 15,
            background: concorde ? "var(--accent)" : "var(--surface-alt)", color: concorde ? "#221f18" : "var(--text-muted)",
            cursor: concorde ? "pointer" : "not-allowed",
          }}
        >
          {enregistrement ? "Enregistrement…" : "Enregistrer la conciliation"}
        </button>
      </div>

      <TitreGroupe
        couleur="var(--accent)"
        droite={<Pastille couleur="var(--success)" fond="var(--success-fond)">{lignesPeriode.length - enCirculation.length} cochée{lignesPeriode.length - enCirculation.length > 1 ? "s" : ""} sur {lignesPeriode.length}</Pastille>}
      >
        Transactions à concilier
      </TitreGroupe>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
        {lignesPeriode.map((l) => (
          <label key={l.id} style={{
            position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", opacity: enCours === l.id ? 0.6 : 1,
            background: l.rapproche ? "var(--success-fond)" : "var(--surface)", border: `1px solid ${l.rapproche ? "var(--success)" : "var(--border)"}`,
            borderRadius: 14, padding: "12px 14px 12px 18px",
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: l.montant >= 0 ? "var(--success)" : "var(--danger)" }} />
            <input type="checkbox" checked={l.rapproche} onChange={() => toggleLigne(l.id, l.rapproche)} disabled={enCours === l.id} style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--success)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{l.description}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{l.dateStr} · {l.numero}</div>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: l.montant >= 0 ? "var(--success)" : "var(--danger)" }}>
              {l.montant >= 0 ? "+" : "−"}{argent(Math.abs(l.montant))}
            </span>
          </label>
        ))}
        {lignesPeriode.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction à concilier jusqu'à cette date.</p>}
      </div>
      {lignesApres > 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 12.5, marginBottom: 20 }}>
          {lignesApres} transaction(s) datée(s) après le {dateReleve} — elles seront conciliées avec le prochain relevé.
        </p>
      )}

      {historique.length > 0 && (
        <>
          <div style={{ marginTop: 24 }}><TitreGroupe couleur="var(--text-muted)">Historique des conciliations</TitreGroupe></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historique.map((h, i) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{new Date(h.dateRapprochement).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} · {argent(h.soldeReleve)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {h._count.lignes > 0 ? `${h._count.lignes} ligne(s) verrouillée(s)` : "Ancienne conciliation (lignes non verrouillées)"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {Math.abs(h.ecart) < 0.01
                    ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Concordant</Pastille>
                    : <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Écart {argent(h.ecart)}</Pastille>}
                  {i === 0 && (
                    <button onClick={() => annuler(h.id)} style={{ fontSize: 12.5, fontWeight: 700, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px", color: "var(--danger)", cursor: "pointer" }}>
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
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: gras ? 15 : discret ? 12.5 : 13.5, marginBottom: 5, paddingTop: gras ? 5 : 0, borderTop: gras ? "1px solid var(--border)" : "none" }}>
      <span style={{ color: gras ? "var(--text)" : "var(--text-muted)", fontWeight: gras ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: gras ? 800 : discret ? 500 : 600, color: discret ? "var(--text-muted)" : "var(--text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(montant)}</span>
    </div>
  );
}

const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 };

const champStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
};
