"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SelecteurCompteMode, { compteParDefaut } from "../../../components/SelecteurCompteMode";
import { CONDITIONS_PAIEMENT, ajouterJours, joursAvantEcheance, etatEcheance } from "@/lib/echeance";
import { ChampAdresse, ChampVille, ChampCodePostal, remplisseurAdresse } from "../../../components/ChampsAdresse";
import SelectProvince from "../../../components/SelectProvince";
import { PROVINCE_DEFAUT, adresseComplete } from "@/lib/adresse";
import { formaterTelephone } from "@/lib/telephone";
import { correspondRecherche } from "@/lib/recherche";
import { argent } from "@/lib/format";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, BoutonPlein, GroupeLiens, Panneau, Pastille, TitrePanneau, stylePanneau } from "../../../components/StyleSection";

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

export default function ComptesAPayerClient({ fournisseurs, categories, comptesDepense, depenses, tpsTaux, tvqTaux, comptesTresorerie, pieces, categorieInventaireId, fournisseurInitial, lectureFacture = false }) {
  const router = useRouter();
  const [ongletGestion, setOngletGestion] = useState(null); // null | "fournisseurs" | "categories"
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [depenseAPayer, setDepenseAPayer] = useState(null); // id de la dépense en train d'être payée
  const [depenseEnEdition, setDepenseEnEdition] = useState(null); // id de la dépense en train d'être corrigée
  const [filtre, setFiltre] = useState("IMPAYEE");
  const [recherche, setRecherche] = useState("");
  const [fournisseurFiltre, setFournisseurFiltre] = useState(fournisseurInitial || null);
  // Paiement groupé : factures impayées cochées, toutes du même fournisseur
  const [selection, setSelection] = useState([]);
  const [paiementGroupe, setPaiementGroupe] = useState(false);

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
        if (!correspondRecherche(terme, d.fournisseur.nom, d.description, d.referenceVersement, d.montant.toFixed(2), d.lignes.map((l) => l.categorieDepense.nom))) return false;
      }
      return true;
    })
    .sort(filtre === "IMPAYEE" || filtre === "EN_RETARD" ? trierParUrgence : (a, b) => new Date(b.dateFacture) - new Date(a.dateFacture));
  const totalFiltre = depensesFiltrees.reduce((s, d) => s + d.montant, 0);
  const nomFournisseurFiltre = fournisseurFiltre && (fournisseurs.find((f) => f.id === fournisseurFiltre)?.nom || soldesParFournisseur.find((f) => f.id === fournisseurFiltre)?.nom);

  const selectionnees = impayees.filter((d) => selection.includes(d.id));
  const fournisseurSelection = selectionnees[0]?.fournisseur || null;
  const totalSelection = selectionnees.reduce((s, d) => s + d.montant, 0);
  const autresDuFournisseur = fournisseurSelection ? impayees.filter((d) => d.fournisseurId === fournisseurSelection.id && !selection.includes(d.id)) : [];
  const impayeesFournisseurFiltre = fournisseurFiltre ? impayees.filter((d) => d.fournisseurId === fournisseurFiltre) : [];

  function basculerSelection(d) {
    setPaiementGroupe(false);
    setSelection((prev) => (prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev.filter((id) => impayees.some((x) => x.id === id && x.fournisseurId === d.fournisseurId)), d.id]));
  }
  function viderSelection() {
    setSelection([]);
    setPaiementGroupe(false);
  }

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
      <Link href="/gerant/fournisseurs" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux fournisseurs</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="💳" titre="Comptes à payer" sousTitre="Saisis les factures de tes fournisseurs et note leur paiement — touche une facture pour la voir." />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={afficherFormulaire ? null : "plus"} onClick={() => setAfficherFormulaire((v) => !v)}>
          {afficherFormulaire ? "Annuler" : "Nouvelle dépense"}
        </BoutonPlein>
      </div>

      {afficherFormulaire && (
        <FormulaireDepense
          fournisseurs={fournisseurs} categoriesInitiales={categories} comptesDepense={comptesDepense} pieces={pieces}
          categorieInventaireId={categorieInventaireId}
          tpsTaux={tpsTaux} tvqTaux={tvqTaux} fournisseurInitial={fournisseurFiltre} lectureFacture={lectureFacture}
          onCree={() => { setAfficherFormulaire(false); router.refresh(); }}
          onCategorieCreee={() => router.refresh()}
        />
      )}

      <div className="grille-trois" style={{ marginBottom: 28 }}>
        <CarteChiffre
          titre="Total dû" montant={argent(totalDu)} teinte="var(--accent)"
          note={`${impayees.length} facture${impayees.length !== 1 ? "s" : ""} impayée${impayees.length !== 1 ? "s" : ""}`}
          actif={filtre === "IMPAYEE" && !fournisseurFiltre} onClick={() => { setFiltre("IMPAYEE"); setFournisseurFiltre(null); }}
        />
        <CarteChiffre
          titre="En retard" montant={argent(totalEnRetard)}
          couleur={enRetard.length > 0 ? "var(--danger)" : "var(--text)"} teinte={enRetard.length > 0 ? "var(--danger)" : "var(--success)"}
          note={enRetard.length > 0 ? `${enRetard.length} facture${enRetard.length !== 1 ? "s" : ""} passée${enRetard.length !== 1 ? "s" : ""} d'échéance` : "Aucune facture en retard"}
          actif={filtre === "EN_RETARD"} onClick={() => setFiltre("EN_RETARD")}
        />
        <CarteChiffre
          titre="Dû sous 7 jours" montant={argent(totalCetteSemaine)}
          couleur={dusCetteSemaine.length > 0 ? "var(--avertissement)" : "var(--text)"} teinte="var(--avertissement)"
          note={dusCetteSemaine.length > 0 ? `${dusCetteSemaine.length} facture${dusCetteSemaine.length !== 1 ? "s" : ""} à prévoir` : "Rien d'ici une semaine"}
          onClick={() => setFiltre("IMPAYEE")}
        />
      </div>

      {soldesParFournisseur.length > 0 && (
        <div style={stylePanneau}>
          <TitrePanneau
            icone="immeuble" teinte={TEINTES.bleu} titre="Solde dû par fournisseur"
            sousTitre="Touche un fournisseur pour ne voir que ses factures."
          />
          {soldesParFournisseur.map((f, i) => {
            const choisi = fournisseurFiltre === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFournisseurFiltre(choisi ? null : f.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", font: "inherit",
                  padding: "10px 8px", cursor: "pointer", color: "var(--text)", borderRadius: 12,
                  background: choisi ? "rgba(232,163,61,0.16)" : "none",
                  border: "none", borderTop: i === 0 || choisi ? "none" : "1px solid var(--border)",
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: TEINTES.bleu.fond, color: TEINTES.bleu.couleur,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800,
                }}>
                  {f.nom.charAt(0).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{f.nombre} facture{f.nombre !== 1 ? "s" : ""}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(f.total)}</span>
              </button>
            );
          })}
        </div>
      )}

      <Panneau titre="Factures">
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            type="search" placeholder="Fournisseur, description, poste, montant, réf."
            value={recherche} onChange={(e) => setRecherche(e.target.value)}
            style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)", marginBottom: 12 }}>
          {["IMPAYEE", "EN_RETARD", "PAYEE", "TOUTES"].map((f) => (
            <button
              key={f} onClick={() => setFiltre(f)}
              style={{
                padding: "9px 4px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                background: filtre === f ? "var(--accent)" : "transparent", color: filtre === f ? "#221f18" : "var(--text-muted)",
              }}
            >
              {f === "TOUTES" ? "Toutes" : STATUTS_DEPENSE[f].label}
            </button>
          ))}
        </div>

        {fournisseurFiltre && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", borderRadius: 12, background: "var(--bleu-fond)", marginBottom: 12, fontSize: 13 }}>
            <span>
              Fournisseur : <Link href={`/gerant/fournisseurs/${fournisseurFiltre}`} style={{ fontWeight: 700, color: "var(--bleu)" }}>{nomFournisseurFiltre || "—"}</Link>
            </span>
            <button onClick={() => setFournisseurFiltre(null)} style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 8, cursor: "pointer" }}>
              ✕ Tous les fournisseurs
            </button>
          </div>
        )}

        {impayeesFournisseurFiltre.length > 1 && filtre !== "PAYEE" && impayeesFournisseurFiltre.some((d) => !selection.includes(d.id)) && (
          <button
            type="button"
            onClick={() => { setPaiementGroupe(false); setSelection(impayeesFournisseurFiltre.map((d) => d.id)); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px 12px", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer", color: "var(--success)", background: "var(--success-fond)", border: "1.5px dashed var(--success)", marginBottom: 12 }}
          >
            <Icone nom="crochet" taille={16} couleur="var(--success)" />
            Tout sélectionner ({impayeesFournisseurFiltre.length}) · {argent(impayeesFournisseurFiltre.reduce((s, d) => s + d.montant, 0))}
          </button>
        )}
        {impayees.length > 1 && selection.length === 0 && filtre !== "PAYEE" && (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
            Coche plusieurs factures d'un même fournisseur pour les payer ensemble (un seul chèque ou virement).
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "2px solid var(--accent)", marginBottom: 10 }}>
          <span>{depensesFiltrees.length} facture{depensesFiltrees.length !== 1 ? "s" : ""}</span>
          <span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{argent(totalFiltre)}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {depensesFiltrees.map((d) => {
            const echeance = etatEcheance(d);
            const payee = d.statut === "PAYEE";
            const couleur = payee ? "var(--success)" : echeance?.enRetard ? "var(--danger)" : "var(--avertissement)";
            const fond = payee ? "var(--success-fond)" : echeance?.enRetard ? "var(--danger-fond)" : "var(--avertissement-fond)";
            const actionsVisibles = depenseAPayer !== d.id && depenseEnEdition !== d.id;
            const cochee = selection.includes(d.id);
            const cochable = !payee && (!fournisseurSelection || fournisseurSelection.id === d.fournisseurId);
            return (
              <div
                key={d.id}
                role="link" tabIndex={0}
                onClick={() => router.push(lienDepense(d.id))}
                onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) router.push(lienDepense(d.id)); }}
                style={{ position: "relative", overflow: "hidden", cursor: "pointer", background: cochee ? "var(--success-fond)" : "var(--surface)", border: `1px solid ${cochee ? "var(--success)" : "var(--border)"}`, borderRadius: 14, padding: "14px 14px 14px 18px" }}
              >
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: couleur }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  {!payee && (
                    <CaseACocher
                      cochee={cochee} desactivee={!cochable}
                      titre={cochable ? "Sélectionner pour un paiement groupé" : `Seulement les factures de ${fournisseurSelection?.nom} dans ce paiement`}
                      onClick={(e) => { e.stopPropagation(); if (cochable) basculerSelection(d); }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{d.fournisseur.nom}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{d.description} · {d.lignes.map((l) => l.categorieDepense.nom).join(", ")}</div>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(d.montant)}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <Pastille couleur={couleur} fond={fond}>{payee ? "Payée" : (echeance?.texte || "Impayée")}</Pastille>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Facture du {formaterDate(d.dateFacture)}
                    {payee && d.datePaiement && ` · payée le ${formaterDate(d.datePaiement)}`}
                    {payee && d.referenceVersement && ` · réf. ${d.referenceVersement}`}
                  </span>
                </div>
                {actionsVisibles && (
                  <div onClick={arreter} style={{ display: "grid", gridTemplateColumns: `repeat(${payee ? 2 : 3}, 1fr)`, gap: 8, marginTop: 12 }}>
                    {!payee && (
                      <BoutonAction icone="crochet" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={() => setDepenseAPayer(d.id)}>Payer</BoutonAction>
                    )}
                    <BoutonAction icone="crayon" onClick={() => setDepenseEnEdition(d.id)}>Corriger</BoutonAction>
                    <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={() => supprimerDepense(d.id)}>Supprimer</BoutonAction>
                  </div>
                )}
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
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0, textAlign: "center", padding: "12px 0" }}>
              {depenses.length === 0 ? "Aucune dépense encore." : filtre === "IMPAYEE" && !terme && !fournisseurFiltre ? "🎉 Rien à payer — tous les fournisseurs sont à jour." : "Aucune dépense pour ce filtre."}
            </p>
          )}
          {filtre !== "IMPAYEE" && filtre !== "EN_RETARD" && (
            <p style={{ color: "var(--text-muted)", fontSize: 11.5, margin: 0 }}>Les 50 dernières factures payées sont affichées ; toutes les impayées le sont.</p>
          )}
        </div>
      </Panneau>

      {selectionnees.length > 0 && (
        <div style={{ position: "sticky", bottom: 88, zIndex: 20, background: "var(--surface)", border: "1.5px solid var(--success)", borderRadius: 16, padding: 14, marginBottom: 24, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {selectionnees.length} facture{selectionnees.length !== 1 ? "s" : ""} sélectionnée{selectionnees.length !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fournisseurSelection?.nom}</div>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--success)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(totalSelection)}</span>
          </div>
          {autresDuFournisseur.length > 0 && !paiementGroupe && (
            <button
              type="button" onClick={() => setSelection((prev) => [...prev, ...autresDuFournisseur.map((d) => d.id)])}
              style={{ marginTop: 6, padding: 0, fontSize: 12.5, fontWeight: 700, color: "var(--success)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              + Ajouter {autresDuFournisseur.length === 1 ? "l'autre facture impayée" : `les ${autresDuFournisseur.length} autres factures impayées`} de ce fournisseur
            </button>
          )}
          {paiementGroupe ? (
            <FormulairePaiementDepense
              depenses={selectionnees} comptesTresorerie={comptesTresorerie}
              onTermine={() => { viderSelection(); router.refresh(); }} onAnnuler={() => setPaiementGroupe(false)}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <BoutonAction icone="crochet" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={() => setPaiementGroupe(true)}>Payer la sélection</BoutonAction>
              <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={viderSelection}>Désélectionner</BoutonAction>
            </div>
          )}
        </div>
      )}

      <GroupeLiens
        titre="Outils" teinte={TEINTES.bleu}
        liens={[
          { href: "/gerant/fournisseurs", icone: "immeuble", label: "Fiches fournisseurs", detail: "Coordonnées et historique" },
          { href: "/gerant/comptabilite/rapports/comptes-fournisseurs", target: "_blank", icone: "imprimante", label: "Rapport chronologique", detail: "Comptes fournisseurs, PDF ou imprimer" },
          { onClick: () => setOngletGestion(ongletGestion === "fournisseurs" ? null : "fournisseurs"), icone: "reglages", label: "Gérer les fournisseurs", detail: "Ajouter, corriger ou retirer" },
          { onClick: () => setOngletGestion(ongletGestion === "categories" ? null : "categories"), icone: "liste", label: "Postes de dépenses", detail: "Postes et leur compte" },
        ]}
      />

      {ongletGestion === "fournisseurs" && <GestionFournisseurs fournisseurs={fournisseurs} onModifie={() => router.refresh()} />}
      {ongletGestion === "categories" && <GestionCategories categories={categories} comptesDepense={comptesDepense} onModifie={() => router.refresh()} />}
    </div>
  );
}

function CaseACocher({ cochee, desactivee, titre, onClick }) {
  return (
    <button
      type="button" role="checkbox" aria-checked={cochee} aria-disabled={desactivee} title={titre} aria-label={titre}
      onClick={onClick} onKeyDown={(e) => e.stopPropagation()}
      style={{
        flexShrink: 0, width: 24, height: 24, marginTop: 1, borderRadius: 7, padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: desactivee ? "not-allowed" : "pointer", opacity: desactivee ? 0.35 : 1,
        background: cochee ? "var(--success)" : "var(--surface)", border: `2px solid ${cochee ? "var(--success)" : "var(--border)"}`,
      }}
    >
      {cochee && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      )}
    </button>
  );
}

function BoutonIcone({ icone, titre, couleur = "var(--text-muted)", onClick }) {
  return (
    <button
      type="button" onClick={onClick} title={titre} aria-label={titre}
      style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <Icone nom={icone} taille={16} couleur={couleur} />
    </button>
  );
}

export function BoutonAction({ icone, couleur = "var(--text)", fond = "var(--surface)", bordure = "var(--border)", onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 8px", borderRadius: 10,
        fontSize: 13, fontWeight: 700, cursor: "pointer", color: couleur, background: fond, border: `1px solid ${bordure}`,
      }}
    >
      <Icone nom={icone} taille={16} couleur={couleur} />
      {children}
    </button>
  );
}

export function formaterDate(date) {
  return new Date(date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });
}

// Paie une facture (`depense`) ou, avec `depenses`, plusieurs factures du
// même fournisseur d'un coup (même compte, mode et référence).
export function FormulairePaiementDepense({ depense, depenses, comptesTresorerie, onTermine, onAnnuler }) {
  const groupe = Array.isArray(depenses);
  const totalGroupe = groupe ? depenses.reduce((s, d) => s + d.montant, 0) : 0;
  const [reference, setReference] = useState("");
  const [compteTresorerieId, setCompteTresorerieId] = useState(compteParDefaut(comptesTresorerie));
  const [modePaiement, setModePaiement] = useState("VIREMENT");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function confirmer() {
    if (!compteTresorerieId) { setErreur("Aucun compte de trésorerie disponible."); return; }
    setErreur("");
    setEnCours(true);
    const res = groupe
      ? await fetch("/api/depenses/payer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ depenseIds: depenses.map((d) => d.id), reference, compteTresorerieId, modePaiement }),
        })
      : await fetch(`/api/depenses/${depense.id}`, {
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
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
          {enCours ? "…" : groupe ? `✓ Payer ${argent(totalGroupe)}` : "✓ Confirmer le paiement"}
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
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
          <input type="date" max="9999-12-31" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Échéance (optionnel)</label>
          <input type="date" max="9999-12-31" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />
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
        <span style={{ fontWeight: 700 }}>{argent(grandTotal)}</span>
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
  const [adresse, setAdresse] = useState(ADRESSE_VIDE);
  const [enCours, setEnCours] = useState(false);
  const [modificationId, setModificationId] = useState(null);

  async function creer(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnCours(true);
    await fetch("/api/fournisseurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, ...adresse }),
    });
    setEnCours(false);
    setNom(""); setTelephone(""); setCourriel(""); setAdresse(ADRESSE_VIDE);
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
    <div style={stylePanneau}>
      <TitrePanneau icone="reglages" teinte={TEINTES.bleu} titre="Gérer les fournisseurs" sousTitre="Ajouter, corriger ou retirer un fournisseur de la liste." />
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 12, borderBottom: "1px solid var(--border)" }}>
        {fournisseurs.map((f) =>
          modificationId === f.id ? (
            <LigneEditionFournisseur key={f.id} fournisseur={f} onTermine={() => { setModificationId(null); onModifie(); }} onAnnuler={() => setModificationId(null)} />
          ) : (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 2px", borderTop: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{f.nom}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {[f.telephone, adresseComplete(f)].filter(Boolean).join(" · ") || "Aucune coordonnée"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <BoutonIcone icone="crayon" titre="Corriger" onClick={() => setModificationId(f.id)} />
                <BoutonIcone icone="poubelle" titre="Retirer" couleur="var(--danger)" onClick={() => desactiver(f.id)} />
              </div>
            </div>
          )
        )}
        {fournisseurs.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun fournisseur encore.</p>}
      </div>
      <form onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input placeholder="Nom du fournisseur" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
        <input placeholder="Téléphone (optionnel)" value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} style={champStyle} />
        <input placeholder="Courriel (optionnel)" value={courriel} onChange={(e) => setCourriel(e.target.value)} style={champStyle} />
        <ChampsAdresseFournisseur valeur={adresse} onChange={setAdresse} style={champStyle} />
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "…" : "+ Ajouter le fournisseur"}
        </button>
      </form>
    </div>
  );
}

const ADRESSE_VIDE = { adresse: "", ville: "", province: PROVINCE_DEFAUT, codePostal: "" };

// Adresse, ville, province et code postal d'un fournisseur — valeur : objet
// { adresse, ville, province, codePostal }
function ChampsAdresseFournisseur({ valeur, onChange, style }) {
  const champ = (cle) => (v) => onChange((a) => ({ ...a, [cle]: v }));
  const remplir = remplisseurAdresse({
    ville: valeur.ville, setAdresse: champ("adresse"), setVille: champ("ville"),
    setProvince: champ("province"), setCodePostal: champ("codePostal"),
  });
  return (
    <>
      <ChampAdresse placeholder="Adresse (optionnel)" valeur={valeur.adresse} onChange={champ("adresse")} onChoisir={remplir.onChoisir} style={style} />
      <ChampVille placeholder="Ville" valeur={valeur.ville} onChange={champ("ville")} codePostal={valeur.codePostal} style={style} />
      <div style={{ display: "flex", gap: 6 }}>
        <SelectProvince valeur={valeur.province} onChange={champ("province")} style={{ ...style, flex: 1 }} />
        <ChampCodePostal placeholder="Code postal" valeur={valeur.codePostal} onChange={champ("codePostal")} onSecteur={remplir.onSecteur} style={{ ...style, width: 110 }} />
      </div>
    </>
  );
}

function LigneEditionFournisseur({ fournisseur, onTermine, onAnnuler }) {
  const [nom, setNom] = useState(fournisseur.nom);
  const [telephone, setTelephone] = useState(fournisseur.telephone || "");
  const [courriel, setCourriel] = useState(fournisseur.courriel || "");
  const [adresse, setAdresse] = useState({
    adresse: fournisseur.adresse || "", ville: fournisseur.ville || "",
    province: fournisseur.province || PROVINCE_DEFAUT, codePostal: fournisseur.codePostal || "",
  });
  const [enCours, setEnCours] = useState(false);

  async function sauvegarder() {
    setEnCours(true);
    await fetch(`/api/fournisseurs/${fournisseur.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, telephone, courriel, ...adresse }),
    });
    setEnCours(false);
    onTermine();
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" style={{ ...champStyle, marginBottom: 0 }} />
      <input value={telephone} type="tel" onChange={(e) => setTelephone(e.target.value)} onBlur={(e) => setTelephone(formaterTelephone(e.target.value))} placeholder="Téléphone" style={{ ...champStyle, marginBottom: 0 }} />
      <input value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="Courriel" style={{ ...champStyle, marginBottom: 0 }} />
      <ChampsAdresseFournisseur valeur={adresse} onChange={setAdresse} style={{ ...champStyle, marginBottom: 0 }} />
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
    <div style={stylePanneau}>
      <TitrePanneau icone="liste" teinte={TEINTES.bleu} titre="Postes de dépenses" sousTitre="Chaque poste est relié à un compte de dépense." />
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 12, borderBottom: "1px solid var(--border)" }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, minHeight: 34, padding: "4px 2px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{c.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontWeight: 400 }}>→ {c.compteDepenseNumero}</span></span>
            {c.code !== "GENERAL" && (
              <BoutonIcone icone="poubelle" titre="Retirer" couleur="var(--danger)" onClick={() => desactiver(c.id)} />
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

function FormulaireDepense({ fournisseurs, categoriesInitiales, comptesDepense, pieces, categorieInventaireId, tpsTaux, tvqTaux, fournisseurInitial, lectureFacture, onCree, onCategorieCreee }) {
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

  // Lecture automatique d'une facture (photo ou PDF) — lib/lectureFacture.js :
  // remplit le formulaire, à vérifier avant d'enregistrer
  const [lecture, setLecture] = useState(null); // null | { enCours } | { erreur } | { avertissements }
  async function lireFichierFacture(e) {
    const fichier = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le même fichier
    if (!fichier) return;
    setErreur("");
    setLecture({ enCours: true });
    const envoi = new FormData();
    envoi.append("fichier", fichier);
    if (categories[0]?.id) envoi.append("categorieDefautId", lignes[0]?.categorieDepenseId || categories[0].id);
    const res = await fetch("/api/depenses/lire-facture", { method: "POST", body: envoi }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data) return setLecture({ erreur: data?.erreur || "La lecture a échoué. Réessaie, ou entre la facture à la main." });
    if (data.fournisseurId) setFournisseurId(data.fournisseurId);
    if (data.description) setDescription(data.description);
    if (data.lignes.length > 0) setLignes(data.lignes.map((l) => ({ ...l, pieceId: null, qteRecue: "" })));
    setTpsPayee(data.tpsPayee);
    setTvqPayee(data.tvqPayee);
    if (data.dateFacture) setDateFacture(data.dateFacture);
    if (data.dateEcheance) {
      setCondition("DATE");
      setDateEcheancePrecise(data.dateEcheance);
    }
    setLecture({ avertissements: data.avertissements });
  }

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
    return <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Ajoute d'abord un fournisseur (« Gérer les fournisseurs », dans les outils plus bas).</p>;
  }

  return (
    <form onSubmit={creer} style={stylePanneau}>
      <TitrePanneau icone="presse" titre="Nouvelle dépense" sousTitre="Facture d'un fournisseur, répartie sur un ou plusieurs postes." />
      {lectureFacture && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ ...boutonPointille, display: "block", textAlign: "center", padding: "12px 8px", fontSize: 13.5, cursor: lecture?.enCours ? "wait" : "pointer", opacity: lecture?.enCours ? 0.7 : 1 }}>
            {lecture?.enCours ? "Lecture de la facture…" : "📷 Remplir à partir d'une photo ou d'un PDF de la facture"}
            <input type="file" accept="image/*,application/pdf" onChange={lireFichierFacture} disabled={!!lecture?.enCours} style={{ display: "none" }} />
          </label>
          {lecture?.erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 12.5, margin: "6px 0 0" }}>{lecture.erreur}</p>}
          {lecture?.avertissements && (
            <div role="status" style={{ marginTop: 6, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--accent)", background: "rgba(232,163,61,0.12)", fontSize: 12.5 }}>
              <strong>Facture lue — vérifie chaque champ avant d&apos;enregistrer.</strong>
              {lecture.avertissements.map((a) => <div key={a} style={{ marginTop: 4 }}>⚠️ {a}</div>)}
            </div>
          )}
        </div>
      )}
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={ajouterLigne} style={boutonPointille}>
          + Ajouter une ligne
        </button>
        <button type="button" onClick={() => setAfficherNouveauPoste((v) => !v)} style={boutonPointille}>
          {afficherNouveauPoste ? "Annuler le poste" : "+ Nouveau poste"}
        </button>
      </div>
      {afficherNouveauPoste && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input placeholder="Nom du nouveau poste" value={nomNouveauPoste} onChange={(e) => setNomNouveauPoste(e.target.value)} style={{ ...champStyle, marginBottom: 0, flex: 1 }} />
            <button type="button" onClick={creerPoste} disabled={creationPosteEnCours} style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "none", border: "1px solid var(--border)", padding: "0 10px", borderRadius: 6, cursor: "pointer" }}>
              {creationPosteEnCours ? "…" : "✓ Créer"}
            </button>
          </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date de la facture</label>
          <input type="date" max="9999-12-31" value={dateFacture} onChange={(e) => setDateFacture(e.target.value)} style={champStyle} />
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
          <input type="date" max="9999-12-31" value={dateEcheancePrecise} onChange={(e) => setDateEcheancePrecise(e.target.value)} style={champStyle} />
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "rgba(232,163,61,0.16)", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>Total dû au fournisseur</span>
        <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(grandTotal)}</span>
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
        {enCours ? "Enregistrement…" : "Enregistrer la dépense"}
      </button>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const boutonPointille = {
  padding: "9px 8px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  color: "var(--accent-ombre)", background: "none", border: "1.5px dashed var(--accent)",
};
const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };
