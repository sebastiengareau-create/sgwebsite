"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SelecteurCompteMode, { compteParDefaut } from "../../../components/SelecteurCompteMode";

const STATUTS_DEPENSE = {
  IMPAYEE: { label: "Impayée", color: "#C9A227" },
  PAYEE: { label: "Payée", color: "#6FA96B" },
};

export default function ComptesAPayerClient({ fournisseurs, categories, comptesDepense, depenses, tpsTaux, tvqTaux, comptesTresorerie, pieces, categorieInventaireId }) {
  const router = useRouter();
  const [ongletGestion, setOngletGestion] = useState(null); // null | "fournisseurs" | "categories"
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [depenseAPayer, setDepenseAPayer] = useState(null); // id de la dépense en train d'être payée
  const [depenseEnEdition, setDepenseEnEdition] = useState(null); // id de la dépense en train d'être corrigée
  const [filtre, setFiltre] = useState("TOUTES");

  const totalDu = depenses.filter((d) => d.statut === "IMPAYEE").reduce((s, d) => s + d.montant, 0);
  const depensesFiltrees = depenses.filter((d) => filtre === "TOUTES" || d.statut === filtre);

  async function supprimerDepense(id) {
    if (!window.confirm("Supprimer cette dépense ? Retire aussi les écritures comptables liées.")) return;
    const res = await fetch(`/api/depenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>💳 Comptes à payer</h1>
        <button onClick={() => setAfficherFormulaire((v) => !v)} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {afficherFormulaire ? "Annuler" : "+ Dépense"}
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>{totalDu.toFixed(2)} $</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total dû aux fournisseurs</div>
      </div>

      <Link
        href="/gerant/fournisseurs"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}
      >
        🏢 Voir tous les fournisseurs
      </Link>

      <Link
        href="/gerant/comptabilite/rapports/comptes-fournisseurs"
        target="_blank"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
      >
        💳 Rapport de comptes à payer
      </Link>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setOngletGestion(ongletGestion === "fournisseurs" ? null : "fournisseurs")} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
          🏢 Fournisseurs
        </button>
        <button onClick={() => setOngletGestion(ongletGestion === "categories" ? null : "categories")} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
          📂 Postes de dépenses
        </button>
      </div>

      {ongletGestion === "fournisseurs" && <GestionFournisseurs fournisseurs={fournisseurs} onModifie={() => router.refresh()} />}
      {ongletGestion === "categories" && <GestionCategories categories={categories} comptesDepense={comptesDepense} onModifie={() => router.refresh()} />}

      {afficherFormulaire && (
        <FormulaireDepense
          fournisseurs={fournisseurs} categoriesInitiales={categories} comptesDepense={comptesDepense} pieces={pieces}
          categorieInventaireId={categorieInventaireId}
          tpsTaux={tpsTaux} tvqTaux={tvqTaux}
          onCree={() => { setAfficherFormulaire(false); router.refresh(); }}
          onCategorieCreee={() => router.refresh()}
        />
      )}

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, marginTop: 8 }}>Dépenses récentes</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
        {["IMPAYEE", "PAYEE", "TOUTES"].map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer",
              background: filtre === f ? "var(--accent)" : "var(--surface)",
              color: filtre === f ? "#17150f" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {f === "TOUTES" ? "Tous" : STATUTS_DEPENSE[f].label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {depensesFiltrees.map((d) => (
          <div key={d.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, borderLeft: `3px solid ${d.statut === "PAYEE" ? "var(--success)" : "var(--danger)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.fournisseur.nom}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: d.statut === "PAYEE" ? "var(--success)" : "var(--danger)" }}>
                {d.statut === "PAYEE" ? "Payée" : "Impayée"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.description} · {d.lignes.map((l) => l.categorieDepense.nom).join(", ")}</div>
            {d.lignes.length > 1 && (
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {d.lignes.map((l) => (
                  <span key={l.id}>· {l.categorieDepense.nom}{l.description ? ` (${l.description})` : ""} — {l.montant.toFixed(2)} $</span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{new Date(d.dateFacture).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
            {(d.tpsPayee > 0 || d.tvqPayee > 0) && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                TPS {d.tpsPayee.toFixed(2)} $ · TVQ {d.tvqPayee.toFixed(2)} $ (récupérables)
              </div>
            )}
            {d.statut === "PAYEE" && d.referenceVersement && (
              <div style={{ fontSize: 10.5, color: "var(--success)", marginTop: 2 }}>Réf. {d.referenceVersement}</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{d.montant.toFixed(2)} $</span>
              <div style={{ display: "flex", gap: 8 }}>
                {d.statut === "IMPAYEE" && depenseAPayer !== d.id && depenseEnEdition !== d.id && (
                  <button onClick={() => setDepenseAPayer(d.id)} className="bouton-3d" style={{ fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 8 }}>
                    Marquer payée
                  </button>
                )}
                {depenseAPayer !== d.id && (
                  <button onClick={() => setDepenseEnEdition(depenseEnEdition === d.id ? null : d.id)} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>
                    ✏️
                  </button>
                )}
                <button onClick={() => supprimerDepense(d.id)} style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>
                  🗑️
                </button>
              </div>
            </div>
            {depenseAPayer === d.id && (
              <FormulairePaiementDepense depense={d} comptesTresorerie={comptesTresorerie} onTermine={() => { setDepenseAPayer(null); router.refresh(); }} onAnnuler={() => setDepenseAPayer(null)} />
            )}
            {depenseEnEdition === d.id && (
              <FormulaireEditionDepense
                depense={d} fournisseurs={fournisseurs} categories={categories} tpsTaux={tpsTaux} tvqTaux={tvqTaux}
                onTermine={() => { setDepenseEnEdition(null); router.refresh(); }} onAnnuler={() => setDepenseEnEdition(null)}
              />
            )}
          </div>
        ))}
        {depensesFiltrees.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {depenses.length === 0 ? "Aucune dépense encore." : "Aucune dépense pour ce filtre."}
          </p>
        )}
      </div>
    </div>
  );
}

function FormulairePaiementDepense({ depense, comptesTresorerie, onTermine, onAnnuler }) {
  const [reference, setReference] = useState("");
  const [compteTresorerieId, setCompteTresorerieId] = useState(compteParDefaut(comptesTresorerie));
  const [modePaiement, setModePaiement] = useState("VIREMENT");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function confirmer() {
    if (!compteTresorerieId) { setErreur("Aucun compte de trésorerie disponible."); return; }
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/depenses/${depense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "PAYEE", reference, compteTresorerieId, modePaiement }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onTermine();
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <SelecteurCompteMode
        comptes={comptesTresorerie}
        compteTresorerieId={compteTresorerieId} setCompteTresorerieId={setCompteTresorerieId}
        modePaiement={modePaiement} setModePaiement={setModePaiement}
      />
      <input
        placeholder="No de chèque ou de transaction (optionnel)" value={reference}
        onChange={(e) => setReference(e.target.value)}
        style={{ padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12.5 }}
      />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={confirmer} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "✓ Confirmer le paiement"}
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function FormulaireEditionDepense({ depense, fournisseurs, categories, tpsTaux, tvqTaux, onTermine, onAnnuler }) {
  const [fournisseurId, setFournisseurId] = useState(depense.fournisseurId);
  const [description, setDescription] = useState(depense.description);
  const [lignes, setLignes] = useState(
    depense.lignes.map((l) => ({
      categorieDepenseId: l.categorieDepenseId, montant: String(l.montant), description: l.description || "",
      pieceId: l.pieceId || null, qteRecue: l.qteRecue || "",
    }))
  );
  const [tpsPayee, setTpsPayee] = useState(String(depense.tpsPayee || 0));
  const [tvqPayee, setTvqPayee] = useState(String(depense.tvqPayee || 0));
  const [dateFacture, setDateFacture] = useState(new Date(depense.dateFacture).toISOString().slice(0, 10));
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const sousTotal = lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const grandTotal = sousTotal + (Number(tpsPayee) || 0) + (Number(tvqPayee) || 0);

  function modifierLigne(index, champ, valeur) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)));
  }
  function ajouterLigne() {
    setLignes((prev) => [...prev, { categorieDepenseId: categories[0]?.id || "", montant: "", description: "" }]);
  }
  function retirerLigne(index) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  async function sauvegarder() {
    setErreur("");
    const manquants = [];
    if (!description.trim()) manquants.push("Description");
    if (lignes.length === 0 || lignes.some((l) => !l.categorieDepenseId || !l.montant || Number(l.montant) <= 0)) {
      manquants.push("Poste et montant de chaque ligne");
    }
    if (manquants.length > 0) {
      setErreur(`Champ(s) manquant(s) : ${manquants.join(", ")}.`);
      return;
    }
    setEnCours(true);
    const res = await fetch(`/api/depenses/${depense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onTermine();
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
      </select>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ ...champStyle, marginBottom: 0 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lignes.map((l, i) => (
          <LigneDepenseInput
            key={i} ligne={l} index={i} categories={categories}
            onChange={modifierLigne} onRetirer={retirerLigne} peutRetirer={lignes.length > 1}
          />
        ))}
        <button type="button" onClick={ajouterLigne} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "5px 8px", cursor: "pointer", alignSelf: "flex-start" }}>
          + Ajouter une ligne (autre poste)
        </button>
      </div>

      <input type="date" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => { setTpsPayee((sousTotal * (tpsTaux / 100)).toFixed(2)); setTvqPayee((sousTotal * (tvqTaux / 100)).toFixed(2)); }}
          style={{ fontSize: 10.5, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          Calculer les taxes à partir des lignes
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="number" min={0} step="0.01" value={tpsPayee} onChange={(e) => setTpsPayee(e.target.value)} placeholder="TPS" style={{ ...champStyle, marginBottom: 0, flex: 1 }} />
        <input type="number" min={0} step="0.01" value={tvqPayee} onChange={(e) => setTvqPayee(e.target.value)} placeholder="TVQ" style={{ ...champStyle, marginBottom: 0, flex: 1 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: "var(--text-muted)" }}>Total (lignes + taxes)</span>
        <span style={{ fontWeight: 700 }}>{grandTotal.toFixed(2)} $</span>
      </div>
      {depense.statut === "PAYEE" && (
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: 0 }}>
          Déjà payée — l'écriture de paiement sera ajustée automatiquement si le montant change.
        </p>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: 0 }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "✓ Sauvegarder la correction"}
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, padding: 8, borderRadius: 6, fontSize: 12, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function LigneDepenseInput({ ligne, index, categories, onChange, onRetirer, peutRetirer, pieces, categorieInventaireId }) {
  const pieceLiee = !!ligne.pieceId;

  // Une ligne liée à une pièce débite toujours l'actif Inventaire (1200), peu
  // importe le poste de dépense normalement choisi — ce n'est pas une charge
  // tant que la pièce n'est pas vendue (voir lib/comptabilite.js).
  function choisirPiece(pieceId) {
    onChange(index, "pieceId", pieceId || null);
    onChange(index, "categorieDepenseId", pieceId ? categorieInventaireId : (categories[0]?.id || ""));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {pieceLiee ? (
          <div style={{ ...champStyle, marginBottom: 0, flex: 1.2, display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: 12 }}>
            📦 Inventaire de pièces (actif)
          </div>
        ) : (
          <select value={ligne.categorieDepenseId} onChange={(e) => onChange(index, "categorieDepenseId", e.target.value)} style={{ ...champStyle, marginBottom: 0, flex: 1.2 }}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        )}
        <input
          placeholder="Note (optionnel)" value={ligne.description}
          onChange={(e) => onChange(index, "description", e.target.value)}
          style={{ ...champStyle, marginBottom: 0, flex: 1 }}
        />
        <input
          type="number" min={0} step="0.01" placeholder="Montant"
          value={ligne.montant} onChange={(e) => onChange(index, "montant", e.target.value)}
          style={{ ...champStyle, marginBottom: 0, width: 90 }}
        />
        {peutRetirer && (
          <button type="button" onClick={() => onRetirer(index)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>✕</button>
        )}
      </div>
      {pieces && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            value={ligne.pieceId || ""}
            onChange={(e) => choisirPiece(e.target.value)}
            style={{ ...champStyle, marginBottom: 0, flex: 1.2, fontSize: 11.5, color: "var(--text-muted)" }}
          >
            <option value="">— pas de réception d'inventaire —</option>
            {pieces.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.numero}) — {p.qte} en stock</option>)}
          </select>
          {ligne.pieceId && (
            <input
              type="number" min={1} step="1" placeholder="Qté reçue"
              value={ligne.qteRecue || ""} onChange={(e) => onChange(index, "qteRecue", e.target.value)}
              style={{ ...champStyle, marginBottom: 0, width: 90, fontSize: 11.5 }}
            />
          )}
        </div>
      )}
      {!pieces && pieceLiee && (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
          📦 Réception déjà appliquée à l'inventaire ({ligne.qteRecue} unité{ligne.qteRecue > 1 ? "s" : ""}) — non modifiable ici.
        </div>
      )}
    </div>
  );
}

function GestionFournisseurs({ fournisseurs, onModifie }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [courriel, setCourriel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [modificationId, setModificationId] = useState(null);

  async function creer(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnCours(true);
    await fetch("/api/fournisseurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse }),
    });
    setEnCours(false);
    setNom(""); setTelephone(""); setCourriel(""); setAdresse("");
    onModifie();
  }

  async function desactiver(id) {
    if (!window.confirm("Retirer ce fournisseur de la liste ?")) return;
    await fetch(`/api/fournisseurs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    onModifie();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Fournisseurs</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {fournisseurs.map((f) =>
          modificationId === f.id ? (
            <LigneEditionFournisseur key={f.id} fournisseur={f} onTermine={() => { setModificationId(null); onModifie(); }} onAnnuler={() => setModificationId(null)} />
          ) : (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <div>
                <div>{f.nom}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                  {[f.telephone, f.adresse].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => setModificationId(f.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✏️</button>
                <button onClick={() => desactiver(f.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}>✕</button>
              </div>
            </div>
          )
        )}
        {fournisseurs.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun fournisseur encore.</p>}
      </div>
      <form onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input placeholder="Nom du fournisseur" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
        <input placeholder="Téléphone (optionnel)" value={telephone} onChange={(e) => setTelephone(e.target.value)} style={champStyle} />
        <input placeholder="Courriel (optionnel)" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
        <input placeholder="Adresse (optionnel)" value={adresse} onChange={(e) => setAdresse(e.target.value)} style={champStyle} />
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "+ Ajouter le fournisseur"}
        </button>
      </form>
    </div>
  );
}

function LigneEditionFournisseur({ fournisseur, onTermine, onAnnuler }) {
  const [nom, setNom] = useState(fournisseur.nom);
  const [telephone, setTelephone] = useState(fournisseur.telephone || "");
  const [courriel, setCourriel] = useState(fournisseur.courriel || "");
  const [adresse, setAdresse] = useState(fournisseur.adresse || "");
  const [enCours, setEnCours] = useState(false);

  async function sauvegarder() {
    setEnCours(true);
    await fetch(`/api/fournisseurs/${fournisseur.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, adresse }),
    });
    setEnCours(false);
    onTermine();
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" style={{ ...champStyle, marginBottom: 0 }} />
      <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" style={{ ...champStyle, marginBottom: 0 }} />
      <input value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="Courriel" style={{ ...champStyle, marginBottom: 0 }} />
      <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse" style={{ ...champStyle, marginBottom: 0 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={sauvegarder} disabled={enCours} style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: 7, borderRadius: 6, cursor: "pointer" }}>
          ✓ Sauvegarder
        </button>
        <button onClick={onAnnuler} style={{ flex: 1, fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: 7, borderRadius: 6, cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function GestionCategories({ categories, comptesDepense, onModifie }) {
  const [nom, setNom] = useState("");
  const [modeCompte, setModeCompte] = useState("nouveau"); // "existant" | "nouveau"
  const [compteDepenseNumero, setCompteDepenseNumero] = useState(comptesDepense[0]?.numero || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    if (!nom.trim()) return;
    setEnCours(true);
    const res = await fetch("/api/comptabilite/categories-depense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        modeCompte === "nouveau" ? { nom, nomNouveauCompte: nom } : { nom, compteDepenseNumero }
      ),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setNom("");
    onModifie();
  }

  async function desactiver(id) {
    if (!window.confirm("Retirer ce poste de dépense ?")) return;
    await fetch(`/api/comptabilite/categories-depense/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    onModifie();
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Postes de dépenses</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span>{c.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>→ {c.compteDepenseNumero}</span></span>
            {c.code !== "GENERAL" && (
              <button onClick={() => desactiver(c.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}>✕</button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input placeholder="Nom du poste (ex : Huile et lubrifiants)" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />

        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
          <button type="button" onClick={() => setModeCompte("nouveau")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "nouveau" ? "var(--accent)" : "none", color: modeCompte === "nouveau" ? "#17150f" : "var(--text-muted)" }}>
            + Nouveau compte
          </button>
          <button type="button" onClick={() => setModeCompte("existant")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "existant" ? "var(--accent)" : "none", color: modeCompte === "existant" ? "#17150f" : "var(--text-muted)" }}>
            Compte existant
          </button>
        </div>

        {modeCompte === "nouveau" ? (
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "2px 0 0" }}>Un compte "{nom || "…"}" sera créé automatiquement, avec le prochain numéro disponible.</p>
        ) : (
          <select value={compteDepenseNumero} onChange={(e) => setCompteDepenseNumero(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
            {comptesDepense.map((c) => <option key={c.id} value={c.numero}>{c.numero} — {c.nom}</option>)}
          </select>
        )}

        {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "+ Ajouter le poste"}
        </button>
      </form>
    </div>
  );
}

function FormulaireDepense({ fournisseurs, categoriesInitiales, comptesDepense, pieces, categorieInventaireId, tpsTaux, tvqTaux, onCree, onCategorieCreee }) {
  const [categories, setCategories] = useState(categoriesInitiales);
  const [fournisseurId, setFournisseurId] = useState(fournisseurs[0]?.id || "");
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState([{ categorieDepenseId: categoriesInitiales[0]?.id || "", montant: "", description: "", pieceId: null, qteRecue: "" }]);
  const [tpsPayee, setTpsPayee] = useState("");
  const [tvqPayee, setTvqPayee] = useState("");
  const [dateFacture, setDateFacture] = useState(new Date().toISOString().slice(0, 10));
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const sousTotal = lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const grandTotal = sousTotal + (Number(tpsPayee) || 0) + (Number(tvqPayee) || 0);

  function modifierLigne(index, champ, valeur) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)));
  }
  function ajouterLigne() {
    setLignes((prev) => [...prev, { categorieDepenseId: categories[0]?.id || "", montant: "", description: "", pieceId: null, qteRecue: "" }]);
  }
  function retirerLigne(index) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }
  function calculerTaxesAutomatiquement() {
    if (!sousTotal) return;
    setTpsPayee((sousTotal * (tpsTaux / 100)).toFixed(2));
    setTvqPayee((sousTotal * (tvqTaux / 100)).toFixed(2));
  }

  const [afficherNouveauPoste, setAfficherNouveauPoste] = useState(false);
  const [nomNouveauPoste, setNomNouveauPoste] = useState("");
  const [creationPosteEnCours, setCreationPosteEnCours] = useState(false);

  async function creerPoste() {
    if (!nomNouveauPoste.trim()) return;
    setCreationPosteEnCours(true);
    setErreur("");
    const res = await fetch("/api/comptabilite/categories-depense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomNouveauPoste, nomNouveauCompte: nomNouveauPoste }),
    });
    setCreationPosteEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création du poste.");
      return;
    }
    const nouveauPoste = await res.json();
    setCategories((prev) => [...prev, nouveauPoste]);
    setNomNouveauPoste("");
    setAfficherNouveauPoste(false);
    onCategorieCreee(); // rafraîchit la vraie liste côté serveur, pour que ça reste après réouverture
  }

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    const manquants = [];
    if (!fournisseurId) manquants.push("Fournisseur");
    if (!description.trim()) manquants.push("Description");
    if (lignes.length === 0 || lignes.some((l) => !l.categorieDepenseId || !l.montant || Number(l.montant) <= 0)) {
      manquants.push("Poste et montant de chaque ligne");
    }
    if (lignes.some((l) => l.pieceId && !(Number(l.qteRecue) > 0))) {
      manquants.push("Quantité reçue pour chaque ligne liée à une pièce");
    }
    if (manquants.length > 0) {
      setErreur(`Champ(s) manquant(s) : ${manquants.join(", ")}.`);
      return;
    }
    setEnCours(true);
    const res = await fetch("/api/depenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onCree();
  }

  if (fournisseurs.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Ajoute d'abord un fournisseur ci-dessus.</p>;
  }

  return (
    <form onSubmit={creer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
      <label style={labelStyle}>Fournisseur</label>
      <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} style={champStyle}>
        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
      </select>

      <label style={labelStyle}>Description de la facture</label>
      <input placeholder="Ex : Facture #1234" value={description} onChange={(e) => setDescription(e.target.value)} style={champStyle} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Postes de dépenses — un même fournisseur peut être fractionné sur plusieurs postes</label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
        {lignes.map((l, i) => (
          <LigneDepenseInput
            key={i} ligne={l} index={i} categories={categories} pieces={pieces} categorieInventaireId={categorieInventaireId}
            onChange={modifierLigne} onRetirer={retirerLigne} peutRetirer={lignes.length > 1}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={ajouterLigne} style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "1px dashed var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
          + Ajouter une ligne (autre poste)
        </button>
        {afficherNouveauPoste ? (
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            <input placeholder="Nom du nouveau poste" value={nomNouveauPoste} onChange={(e) => setNomNouveauPoste(e.target.value)} style={{ ...champStyle, marginBottom: 0, flex: 1 }} />
            <button type="button" onClick={creerPoste} disabled={creationPosteEnCours} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "0 10px", borderRadius: 6, cursor: "pointer" }}>
              {creationPosteEnCours ? "…" : "✓ Créer"}
            </button>
            <button type="button" onClick={() => setAfficherNouveauPoste(false)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "0 10px", borderRadius: 6, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAfficherNouveauPoste(true)} className="bouton-3d-sombre" style={{ padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            + Nouveau poste
          </button>
        )}
      </div>

      <label style={labelStyle}>Date de la facture</label>
      <input type="date" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={champStyle} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Taxes payées (optionnel — récupérables)</label>
        <button type="button" onClick={calculerTaxesAutomatiquement} style={{ fontSize: 10.5, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Calculer à partir des lignes
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input type="number" min={0} step="0.01" placeholder={`TPS (${tpsTaux}%)`} value={tpsPayee} onChange={(e) => setTpsPayee(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <input type="number" min={0} step="0.01" placeholder={`TVQ (${tvqTaux}%)`} value={tvqPayee} onChange={(e) => setTvqPayee(e.target.value)} style={champStyle} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: "var(--text-muted)" }}>Total dû au fournisseur</span>
        <span style={{ fontWeight: 700 }}>{grandTotal.toFixed(2)} $</span>
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
        {enCours ? "Enregistrement…" : "Enregistrer la dépense"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };
