"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SelecteurCompteMode, { compteParDefaut } from "../../../components/SelecteurCompteMode";
import { CONDITIONS_PAIEMENT, ajouterJours, joursAvantEcheance, etatEcheance } from "@/lib/echeance";

const STATUTS_DEPENSE = {
  IMPAYEE: { label: "Impayées", color: "#C9A227" },
  EN_RETARD: { label: "En retard", color: "var(--danger)" },
  PAYEE: { label: "Payées", color: "#6FA96B" },
};

export const lienDepense = (id) => `/gerant/comptabilite/comptes-a-payer/${id}`;

// Impayées : la plus urgente d'abord (échéance, puis date de facture) ;
// sans échéance, elles passent après celles qui en ont une.
function trierParUrgence(a, b) {
  const ea = a.dateEcheance ? new Date(a.dateEcheance).getTime() : Infinity;
  const eb = b.dateEcheance ? new Date(b.dateEcheance).getTime() : Infinity;
  if (ea !== eb) return ea - eb;
  return new Date(a.dateFacture) - new Date(b.dateFacture);
}

export default function ComptesAPayerClient({ fournisseurs, categories, comptesDepense, depenses, tpsTaux, tvqTaux, comptesTresorerie, pieces, categorieInventaireId, fournisseurInitial }) {
  const router = useRouter();
  const [ongletGestion, setOngletGestion] = useState(null); // null | "fournisseurs" | "categories"
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [depenseAPayer, setDepenseAPayer] = useState(null); // id de la dépense en train d'être payée
  const [depenseEnEdition, setDepenseEnEdition] = useState(null); // id de la dépense en train d'être corrigée
  const [filtre, setFiltre] = useState("IMPAYEE");
  const [recherche, setRecherche] = useState("");
  const [fournisseurFiltre, setFournisseurFiltre] = useState(fournisseurInitial || null);

  const impayees = depenses.filter((d) => d.statut === "IMPAYEE");
  const totalDu = impayees.reduce((s, d) => s + d.montant, 0);
  const enRetard = impayees.filter((d) => etatEcheance(d)?.enRetard);
  const totalEnRetard = enRetard.reduce((s, d) => s + d.montant, 0);
  const dusCetteSemaine = impayees.filter((d) => { const j = joursAvantEcheance(d.dateEcheance); return j !== null && j >= 0 && j <= 7; });
  const totalCetteSemaine = dusCetteSemaine.reduce((s, d) => s + d.montant, 0);

  // Solde dû par fournisseur — un clic filtre la liste sur ce fournisseur
  const soldesParFournisseur = Object.values(
    impayees.reduce((acc, d) => {
      acc[d.fournisseurId] ||= { id: d.fournisseurId, nom: d.fournisseur.nom, total: 0, nombre: 0 };
      acc[d.fournisseurId].total += d.montant;
      acc[d.fournisseurId].nombre += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  const terme = recherche.trim().toLowerCase();
  const depensesFiltrees = depenses
    .filter((d) => {
      if (filtre === "IMPAYEE" && d.statut !== "IMPAYEE") return false;
      if (filtre === "PAYEE" && d.statut !== "PAYEE") return false;
      if (filtre === "EN_RETARD" && !etatEcheance(d)?.enRetard) return false;
      if (fournisseurFiltre && d.fournisseurId !== fournisseurFiltre) return false;
      if (terme) {
        const texte = [d.fournisseur.nom, d.description, d.referenceVersement, d.montant.toFixed(2), ...d.lignes.map((l) => l.categorieDepense.nom)].filter(Boolean).join(" ").toLowerCase();
        if (!texte.includes(terme)) return false;
      }
      return true;
    })
    .sort(filtre === "IMPAYEE" || filtre === "EN_RETARD" ? trierParUrgence : (a, b) => new Date(b.dateFacture) - new Date(a.dateFacture));
  const totalFiltre = depensesFiltrees.reduce((s, d) => s + d.montant, 0);
  const nomFournisseurFiltre = fournisseurFiltre && (fournisseurs.find((f) => f.id === fournisseurFiltre)?.nom || soldesParFournisseur.find((f) => f.id === fournisseurFiltre)?.nom);

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

  // Les boutons et formulaires dans une carte ne doivent pas ouvrir la fiche
  const arreter = (e) => e.stopPropagation();

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>💳 Comptes à payer</h1>
        <button onClick={() => setAfficherFormulaire((v) => !v)} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {afficherFormulaire ? "Annuler" : "+ Dépense"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        <CarteResume
          valeur={totalDu} libelle={`Total dû · ${impayees.length} facture${impayees.length !== 1 ? "s" : ""}`} couleur="var(--text)"
          actif={filtre === "IMPAYEE" && !fournisseurFiltre} onClick={() => { setFiltre("IMPAYEE"); setFournisseurFiltre(null); }}
        />
        <CarteResume
          valeur={totalEnRetard} libelle={`En retard · ${enRetard.length}`} couleur={enRetard.length > 0 ? "var(--danger)" : "var(--text-muted)"}
          actif={filtre === "EN_RETARD"} onClick={() => setFiltre("EN_RETARD")}
        />
        <CarteResume
          valeur={totalCetteSemaine} libelle={`Dû sous 7 jours · ${dusCetteSemaine.length}`} couleur={dusCetteSemaine.length > 0 ? "#C9A227" : "var(--text-muted)"}
          actif={false} onClick={() => setFiltre("IMPAYEE")}
        />
      </div>

      {afficherFormulaire && (
        <FormulaireDepense
          fournisseurs={fournisseurs} categoriesInitiales={categories} comptesDepense={comptesDepense} pieces={pieces}
          categorieInventaireId={categorieInventaireId}
          tpsTaux={tpsTaux} tvqTaux={tvqTaux} fournisseurInitial={fournisseurFiltre}
          onCree={() => { setAfficherFormulaire(false); router.refresh(); }}
          onCategorieCreee={() => router.refresh()}
        />
      )}

      {soldesParFournisseur.length > 0 && (
        <div className="carte carte-s" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Solde dû par fournisseur</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {soldesParFournisseur.map((f) => (
              <button
                key={f.id}
                onClick={() => setFournisseurFiltre(fournisseurFiltre === f.id ? null : f.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
                  fontSize: 12.5, padding: "6px 8px", borderRadius: 6, cursor: "pointer", color: "var(--text)",
                  background: fournisseurFiltre === f.id ? "var(--bg)" : "none",
                  border: fournisseurFiltre === f.id ? "1px solid var(--accent)" : "1px solid transparent",
                }}
              >
                <span>{f.nom} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({f.nombre})</span></span>
                <span style={{ fontWeight: 700 }}>{f.total.toFixed(2)} $</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        type="search" placeholder="🔍 Rechercher (fournisseur, description, poste, montant, réf.)"
        value={recherche} onChange={(e) => setRecherche(e.target.value)}
        style={{ ...champStyle, marginBottom: 8 }}
      />
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
        {["IMPAYEE", "EN_RETARD", "PAYEE", "TOUTES"].map((f) => (
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
            {f === "TOUTES" ? "Toutes" : STATUTS_DEPENSE[f].label}
          </button>
        ))}
      </div>
      {fournisseurFiltre && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 8, gap: 8 }}>
          <span>
            Fournisseur : <Link href={`/gerant/fournisseurs/${fournisseurFiltre}`} style={{ fontWeight: 700, color: "var(--accent)" }}>{nomFournisseurFiltre || "—"}</Link>
          </span>
          <button onClick={() => setFournisseurFiltre(null)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
            ✕ Tous les fournisseurs
          </button>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
        <span>{depensesFiltrees.length} facture{depensesFiltrees.length !== 1 ? "s" : ""} — touche une facture pour la voir</span>
        <span style={{ fontWeight: 700 }}>{totalFiltre.toFixed(2)} $</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {depensesFiltrees.map((d) => {
          const echeance = etatEcheance(d);
          return (
            <div
              key={d.id}
              role="link" tabIndex={0}
              onClick={() => router.push(lienDepense(d.id))}
              onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) router.push(lienDepense(d.id)); }}
              style={{ cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, borderLeft: `3px solid ${d.statut === "PAYEE" ? "var(--success)" : echeance?.enRetard ? "var(--danger)" : "#C9A227"}` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{d.fournisseur.nom}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: d.statut === "PAYEE" ? "var(--success)" : (echeance?.couleur || "var(--danger)"), whiteSpace: "nowrap" }}>
                  {d.statut === "PAYEE" ? "Payée" : (echeance?.texte || "Impayée")}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.description} · {d.lignes.map((l) => l.categorieDepense.nom).join(", ")}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                Facture du {formaterDate(d.dateFacture)}
                {d.statut === "PAYEE" && d.datePaiement && ` · payée le ${formaterDate(d.datePaiement)}`}
                {d.statut === "PAYEE" && d.referenceVersement && ` · réf. ${d.referenceVersement}`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{d.montant.toFixed(2)} $</span>
                <div style={{ display: "flex", gap: 8 }} onClick={arreter}>
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
                <div onClick={arreter} style={{ cursor: "default" }}>
                  <FormulairePaiementDepense depense={d} comptesTresorerie={comptesTresorerie} onTermine={() => { setDepenseAPayer(null); router.refresh(); }} onAnnuler={() => setDepenseAPayer(null)} />
                </div>
              )}
              {depenseEnEdition === d.id && (
                <div onClick={arreter} style={{ cursor: "default" }}>
                  <FormulaireEditionDepense
                    depense={d} fournisseurs={fournisseurs} categories={categories} tpsTaux={tpsTaux} tvqTaux={tvqTaux}
                    onTermine={() => { setDepenseEnEdition(null); router.refresh(); }} onAnnuler={() => setDepenseEnEdition(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
        {depensesFiltrees.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {depenses.length === 0 ? "Aucune dépense encore." : filtre === "IMPAYEE" && !terme && !fournisseurFiltre ? "🎉 Rien à payer — tous les fournisseurs sont à jour." : "Aucune dépense pour ce filtre."}
          </p>
        )}
        {filtre !== "IMPAYEE" && filtre !== "EN_RETARD" && (
          <p style={{ color: "var(--text-muted)", fontSize: 10.5, margin: 0 }}>Les 50 dernières factures payées sont affichées ; toutes les impayées le sont.</p>
        )}
      </div>

      <h2 style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8, marginTop: 20 }}>Outils</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Link href="/gerant/fournisseurs" className="bouton-3d-sombre" style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 8, fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>
          🏢 Fiches fournisseurs
        </Link>
        <Link href="/gerant/comptabilite/rapports/comptes-fournisseurs" target="_blank" className="bouton-3d-sombre" style={{ flex: 1, textAlign: "center", padding: 9, borderRadius: 8, fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>
          📄 Rapport chronologique
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setOngletGestion(ongletGestion === "fournisseurs" ? null : "fournisseurs")} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
          ⚙️ Gérer les fournisseurs
        </button>
        <button onClick={() => setOngletGestion(ongletGestion === "categories" ? null : "categories")} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
          📂 Postes de dépenses
        </button>
      </div>

      {ongletGestion === "fournisseurs" && <GestionFournisseurs fournisseurs={fournisseurs} onModifie={() => router.refresh()} />}
      {ongletGestion === "categories" && <GestionCategories categories={categories} comptesDepense={comptesDepense} onModifie={() => router.refresh()} />}
    </div>
  );
}

function CarteResume({ valeur, libelle, couleur, actif, onClick }) {
  return (
    <button
      onClick={onClick}
      className="carte carte-s"
      style={{ textAlign: "left", cursor: "pointer", border: actif ? "1px solid var(--accent)" : undefined, color: "var(--text)", minWidth: 0 }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: couleur }}>{valeur.toFixed(2)} $</div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{libelle}</div>
    </button>
  );
}

export function formaterDate(date) {
  return new Date(date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
}

export function FormulairePaiementDepense({ depense, comptesTresorerie, onTermine, onAnnuler }) {
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

export function FormulaireEditionDepense({ depense, fournisseurs, categories, tpsTaux, tvqTaux, onTermine, onAnnuler }) {
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
  const [dateEcheance, setDateEcheance] = useState(depense.dateEcheance ? new Date(depense.dateEcheance).toISOString().slice(0, 10) : "");
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
      body: JSON.stringify({ fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture, dateEcheance }),
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

      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date de la facture</label>
          <input type="date" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Échéance (optionnel)</label>
          <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
        </div>
      </div>
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

function LigneDepenseInput({ ligne, index, categories, onChange, onRetirer, peutRetirer, pieces, categorieInventaireId, onNouvellePiece }) {
  const pieceLiee = !!ligne.pieceId;
  const [creationPieceEnCours, setCreationPieceEnCours] = useState(false);
  const [nouvelleNom, setNouvelleNom] = useState("");
  const [nouveauNumero, setNouveauNumero] = useState("");
  const [nouveauPrix, setNouveauPrix] = useState("");
  const [erreurNouvellePiece, setErreurNouvellePiece] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);

  // Une ligne liée à une pièce débite toujours l'actif Inventaire (1200), peu
  // importe le poste de dépense normalement choisi — ce n'est pas une charge
  // tant que la pièce n'est pas vendue (voir lib/comptabilite.js).
  function choisirPiece(valeur) {
    if (valeur === "__nouvelle__") {
      setCreationPieceEnCours(true);
      return;
    }
    onChange(index, "pieceId", valeur || null);
    onChange(index, "categorieDepenseId", valeur ? categorieInventaireId : (categories[0]?.id || ""));
  }

  async function creerNouvellePiece() {
    setErreurNouvellePiece("");
    if (!nouvelleNom.trim() || !nouveauNumero.trim() || !nouveauPrix) {
      setErreurNouvellePiece("Nom, numéro et prix de vente sont requis.");
      return;
    }
    setCreationEnCours(true);
    const res = await fetch("/api/inventaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nouvelleNom, numero: nouveauNumero, prix: nouveauPrix, qte: 0 }),
    });
    setCreationEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreurNouvellePiece(data.erreur || "Erreur lors de la création.");
      return;
    }
    const piece = await res.json();
    onNouvellePiece(piece);
    choisirPiece(piece.id);
    setCreationPieceEnCours(false);
    setNouvelleNom(""); setNouveauNumero(""); setNouveauPrix("");
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
            {categories.map((c) => <option key={c.id} value={c.id}>{c.compteDepenseNumero} — {c.nom}</option>)}
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
      {pieces && !creationPieceEnCours && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            value={ligne.pieceId || ""}
            onChange={(e) => choisirPiece(e.target.value)}
            style={{ ...champStyle, marginBottom: 0, flex: 1.2, fontSize: 11.5, color: "var(--text-muted)" }}
          >
            <option value="">— pas de réception d'inventaire —</option>
            {pieces.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.numero}) — {p.qte} en stock</option>)}
            <option value="__nouvelle__">+ Créer une nouvelle pièce…</option>
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
      {creationPieceEnCours && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--bg)", borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            📦 Nouvel article — ajouté au stock à 0, puis reçu avec la quantité ci-dessous une fois créé.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input placeholder="Nom de la pièce" value={nouvelleNom} onChange={(e) => setNouvelleNom(e.target.value)} style={{ ...champStyle, marginBottom: 0, flex: 1.4, fontSize: 11.5 }} />
            <input placeholder="Numéro" value={nouveauNumero} onChange={(e) => setNouveauNumero(e.target.value)} style={{ ...champStyle, marginBottom: 0, flex: 1, fontSize: 11.5 }} />
            <input type="number" min={0} step="0.01" placeholder="Prix de vente" value={nouveauPrix} onChange={(e) => setNouveauPrix(e.target.value)} style={{ ...champStyle, marginBottom: 0, width: 90, fontSize: 11.5 }} />
          </div>
          {erreurNouvellePiece && <p style={{ color: "var(--danger)", fontSize: 10.5, margin: 0 }}>{erreurNouvellePiece}</p>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={creerNouvellePiece} disabled={creationEnCours} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>
              {creationEnCours ? "…" : "✓ Créer et lier"}
            </button>
            <button type="button" onClick={() => setCreationPieceEnCours(false)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
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
    <div className="carte carte-m" style={{ marginBottom: 16 }}>
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
    <div className="carte carte-m" style={{ marginBottom: 16 }}>
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

function FormulaireDepense({ fournisseurs, categoriesInitiales, comptesDepense, pieces, categorieInventaireId, tpsTaux, tvqTaux, fournisseurInitial, onCree, onCategorieCreee }) {
  const [categories, setCategories] = useState(categoriesInitiales);
  const [piecesDisponibles, setPiecesDisponibles] = useState(pieces);
  const [fournisseurId, setFournisseurId] = useState(fournisseurs.some((f) => f.id === fournisseurInitial) ? fournisseurInitial : (fournisseurs[0]?.id || ""));
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState([{ categorieDepenseId: categoriesInitiales[0]?.id || "", montant: "", description: "", pieceId: null, qteRecue: "" }]);
  const [tpsPayee, setTpsPayee] = useState("");
  const [tvqPayee, setTvqPayee] = useState("");
  const [dateFacture, setDateFacture] = useState(new Date().toISOString().slice(0, 10));
  // Échéance : Net 30 par défaut (le plus courant) — alimente les alertes
  // « en retard » / « à payer cette semaine » du tableau de bord.
  const [condition, setCondition] = useState("30");
  const [dateEcheancePrecise, setDateEcheancePrecise] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const joursCondition = CONDITIONS_PAIEMENT.find((c) => c.valeur === condition)?.jours;
  const dateEcheance = condition === "DATE" ? dateEcheancePrecise : joursCondition != null && dateFacture ? ajouterJours(dateFacture, joursCondition) : "";

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
  function ajouterNouvellePiece(piece) {
    setPiecesDisponibles((prev) => [...prev, piece].sort((a, b) => a.nom.localeCompare(b.nom)));
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
      body: JSON.stringify({ fournisseurId, description, lignes, tpsPayee, tvqPayee, dateFacture, dateEcheance }),
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
    return <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Ajoute d'abord un fournisseur (bouton « ⚙️ Gérer les fournisseurs » plus bas).</p>;
  }

  return (
    <form onSubmit={creer} className="carte carte-m" style={{ marginBottom: 16 }}>
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
            key={i} ligne={l} index={i} categories={categories} pieces={piecesDisponibles} categorieInventaireId={categorieInventaireId}
            onChange={modifierLigne} onRetirer={retirerLigne} peutRetirer={lignes.length > 1} onNouvellePiece={ajouterNouvellePiece}
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

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date de la facture</label>
          <input type="date" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={champStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Conditions de paiement</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} style={champStyle}>
            {CONDITIONS_PAIEMENT.map((c) => <option key={c.valeur} value={c.valeur}>{c.label}</option>)}
          </select>
        </div>
      </div>
      {condition === "DATE" ? (
        <>
          <label style={labelStyle}>Date d'échéance</label>
          <input type="date" value={dateEcheancePrecise} onChange={(e) => setDateEcheancePrecise(e.target.value)} style={champStyle} />
        </>
      ) : dateEcheance && (
        <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "-4px 0 8px" }}>Échéance : {dateEcheance}</p>
      )}

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
