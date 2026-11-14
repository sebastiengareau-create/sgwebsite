"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { argent, nombre } from "@/lib/format";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../../../../components/StyleSection";

const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

export default function LotDetailClient({ lot, checklist, employesDisponibles }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avertissements, setAvertissements] = useState([]);
  const [employeAAjouter, setEmployeAAjouter] = useState("");
  const estBrouillon = lot.statut === "BROUILLON";

  const totalBrut = lot.paies.reduce((s, p) => s + p.salaireBrut, 0);
  const totalDeductions = lot.paies.reduce((s, p) => s + p.totalDeductions, 0);
  const totalNet = lot.paies.reduce((s, p) => s + p.salaireNet, 0);

  async function ajusterPaie(paieId, valeurs) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/paies/${paieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeurs),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'ajustement.");
      return;
    }
    router.refresh();
  }

  async function retirerEmploye(paieId) {
    if (!window.confirm("Retirer cet employé de ce lot ?")) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/paies/${paieId}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  async function ajouterEmploye() {
    if (!employeAAjouter) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/paies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId: employeAAjouter }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'ajout.");
      return;
    }
    setEmployeAAjouter("");
    router.refresh();
  }

  async function supprimerLot() {
    if (!window.confirm(`Supprimer complètement le lot #${lot.numero} ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.erreur || "Erreur.");
      return;
    }
    router.push("/gerant/paie");
  }

  async function traiterLaPaie() {
    if (!window.confirm(`Traiter la paie pour ${lot.paies.length} employé(s) — total net ${argent(totalNet)} ? Cette action comptabilise chaque paie et ne peut plus être annulée d'un coup (seulement employé par employé, ensuite).`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/paie/lots/${lot.id}/comptabiliser`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur lors du traitement.");
      router.refresh(); // un traitement interrompu a pu verser une partie des paies
      return;
    }
    setAvertissements(data.avertissements || []);
    router.refresh();
  }

  async function corrigerPaieIndividuelle(paieId) {
    if (!window.confirm("Annuler cette paie pour la refaire ? Son écriture comptable est renversée. Tu pourras créer un nouveau lot (avec juste cet employé) pour la refaire correctement.")) return;
    setEnCours(true);
    const res = await fetch(`/api/paie/${paieId}/corriger`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      window.alert(data.erreur || "Erreur lors de la correction.");
      return;
    }
    router.refresh();
  }

  const couleurProfil = estBrouillon ? "var(--accent)" : "var(--success)";

  return (
    <div className="conteneur-page">
      <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la paie</Link>

      {/* Carte du lot */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleurProfil }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleurProfil, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: estBrouillon ? TEINTES.ambre.fond : TEINTES.vert.fond, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom="calculatrice" taille={28} couleur={estBrouillon ? TEINTES.ambre.couleur : TEINTES.vert.couleur} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>Lot de paie #{lot.numero}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Du {dateCourte(lot.periodeDebut)} au {dateCourte(lot.periodeFin)}
              {lot.creePar && ` · créé par ${lot.creePar}`}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {estBrouillon
                ? <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>Brouillon</Pastille>
                : <Pastille couleur="var(--success)" fond="var(--success-fond)">Comptabilisée</Pastille>}
              {lot.typePaie === "VACANCES" && <Pastille couleur="var(--success)" fond="var(--success-fond)">Paie de vacances</Pastille>}
              {lot.dateVersementPrevue && <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>Versement le {dateCourte(lot.dateVersementPrevue)}</Pastille>}
            </div>
          </div>
        </div>
      </div>

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="Salaire brut" montant={argent(totalBrut)} teinte="var(--bleu)" note={`${lot.paies.length} employé${lot.paies.length !== 1 ? "s" : ""}`} />
        <CarteChiffre titre="Retenues" montant={argent(totalDeductions)} teinte="var(--danger)" note="Impôts et cotisations" />
        <CarteChiffre titre="Net à verser" montant={argent(totalNet)} teinte="var(--success)" couleur="var(--success)" note={estBrouillon ? "Après traitement de la paie" : "Versé aux employés"} />
      </div>

      {estBrouillon && checklist && (
        <div style={stylePanneau}>
          <TitrePanneau
            icone="crochet" teinte={checklist.peutComptabiliser ? TEINTES.vert : TEINTES.rouge} titre="Checklist avant traitement"
            sousTitre={checklist.peutComptabiliser ? "Tout est prêt pour traiter la paie." : "Règle les points en rouge avant de traiter la paie."}
            droite={<span style={{ fontSize: 17, fontWeight: 800, color: checklist.peutComptabiliser ? "var(--success)" : "var(--danger)", whiteSpace: "nowrap", paddingTop: 2 }}>{checklist.pourcentage} %</span>}
          />
          <div style={{ height: 8, borderRadius: 999, background: "var(--surface-alt)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{ width: `${checklist.pourcentage}%`, height: "100%", borderRadius: 999, background: checklist.peutComptabiliser ? "var(--success)" : "var(--accent)" }} />
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
              {checklist.informatifs.map((info, i) => (
                <div key={info.cle} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{info.label}</span>
                  <span style={{ fontWeight: 700 }}>{info.valeur}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{erreur}</p>}
      {avertissements.length > 0 && (
        <div style={{ ...stylePanneau, background: "var(--avertissement-fond)", border: "1.5px solid var(--avertissement)" }}>
          <TitrePanneau icone="alerte" teinte={TEINTES.ambre} titre="Paie traitée, avec des avertissements comptables" />
          {avertissements.map((a, i) => <p key={i} style={{ fontSize: 13, margin: "4px 0", color: "var(--text-muted)" }}>{a}</p>)}
        </div>
      )}

      <div style={stylePanneau}>
        <TitrePanneau
          icone="utilisateurs" teinte={TEINTES.vert} titre="Employés"
          sousTitre={estBrouillon ? "Touche un employé pour ajuster ses heures, son boni ou voir ses retenues." : "Touche un employé pour voir ses retenues, son talon et son mode de paiement."}
          droite={<Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>{lot.paies.length}</Pastille>}
        />
        {estBrouillon && employesDisponibles.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 12 }}>
            <select value={employeAAjouter} onChange={(e) => setEmployeAAjouter(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
              <option value="">Ajouter un employé oublié…</option>
              {employesDisponibles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
            <BoutonAction icone="plus" couleur="var(--accent-ombre)" bordure="var(--accent)" onClick={ajouterEmploye} disabled={enCours || !employeAAjouter}>Ajouter</BoutonAction>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lot.paies.map((p) => (
            <LignePaie
              key={p.id}
              paie={p}
              estBrouillon={estBrouillon}
              estVacances={lot.typePaie === "VACANCES"}
              enCours={enCours}
              onAjuster={ajusterPaie}
              onRetirer={retirerEmploye}
              onCorriger={corrigerPaieIndividuelle}
            />
          ))}
        </div>
      </div>

      {estBrouillon ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 600, margin: 0, padding: "10px 12px", borderRadius: 12, background: "var(--danger-fond)" }}>
            ⚠️ Une fois traitée, chaque paie sera versée et son écriture comptable créée — une correction se fera ensuite employé par employé, pas pour tout le lot d'un coup.
          </p>
          <button onClick={traiterLaPaie} disabled={enCours || !checklist?.peutComptabiliser} className="bouton-3d" style={{ padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 15, opacity: checklist?.peutComptabiliser ? 1 : 0.55 }}>
            ▶ Traiter la paie · {argent(totalNet)}
          </button>
          <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimerLot} disabled={enCours}>Supprimer ce lot</BoutonAction>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 16 }}>
          Comptabilisée le {new Date(lot.comptabiliseLe).toLocaleString("fr-CA", { timeZone: "America/Toronto" })}.
        </p>
      )}
    </div>
  );
}

function LignePaie({ paie, estBrouillon, estVacances, enCours, onAjuster, onRetirer, onCorriger }) {
  const [ouvert, setOuvert] = useState(false);
  const [heuresValeur, setHeuresValeur] = useState(String(paie.heuresTravaillees));
  const [montantValeur, setMontantValeur] = useState(String(paie.salaireBrut));
  const [boniValeur, setBoniValeur] = useState(String(paie.boni || 0));
  const [forfaitaireValeur, setForfaitaireValeur] = useState(!!paie.vacancesForfaitaire);
  const [heuresSupValeur, setHeuresSupValeur] = useState(String(paie.heuresSupplementaires || 0));
  const [feriesValeur, setFeriesValeur] = useState(String(paie.indemniteFeries || 0));
  const modifiable = estBrouillon && paie.employe.typeRemuneration !== "SALAIRE";
  const corrigee = paie.statut === "CORRIGEE";

  const infoRemuneration = paie.employe.typeRemuneration === "SALAIRE"
    ? `Salarié — ${argent((paie.employe.salaireAnnuel || 0))}/an`
    : `${argent((paie.employe.tauxHoraireEmploye || 0))}/h`;

  function recalculer() {
    onAjuster(paie.id, estVacances ? { montantVacances: montantValeur, vacancesForfaitaire: forfaitaireValeur } : { heuresManuelles: heuresValeur, heuresSupManuelles: heuresSupValeur, indemniteFeriesManuelle: feriesValeur, boni: boniValeur });
  }

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${ouvert ? "var(--accent)" : "var(--border)"}`, background: "var(--surface)", opacity: corrigee ? 0.6 : 1, overflow: "hidden" }}>
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)", fontFamily: "inherit" }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>
          {paie.employe.nom.charAt(0).toUpperCase()}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>{paie.employe.nom}</span>
            {corrigee && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Corrigée</Pastille>}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {infoRemuneration}
            {!estVacances && (paie.heuresTravaillees > 0 || paie.employe.typeRemuneration !== "SALAIRE") && ` · ${nombre(paie.heuresTravaillees)} h`}
            {!estVacances && paie.heuresHorodateur != null && paie.heuresHorodateur !== paie.heuresTravaillees && ` (${nombre(paie.heuresHorodateur)} h réelles)`}
            {estVacances && (paie.vacancesForfaitaire ? " · en plus du salaire" : " · remplace le salaire")}
            {paie.heuresSupplementaires > 0 && ` · ${nombre(paie.heuresSupplementaires)} h supp.`}
            {paie.indemniteFeries > 0 && ` · férié ${argent(paie.indemniteFeries)}`}
            {paie.boni > 0 && ` · +${argent(paie.boni)} boni`}
          </span>
        </span>
        <span style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", textDecoration: corrigee ? "line-through" : "none" }}>{argent(paie.salaireNet)}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>brut {argent(paie.salaireBrut)}</span>
        </span>
        <span style={{ display: "inline-flex", transform: ouvert ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
          <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
        </span>
      </button>

      {ouvert && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border)" }}>
          {modifiable ? (
            <div style={{ paddingTop: 12 }}>
              {estVacances ? (
                <div>
                  <label style={labelStyle}>Montant de vacances ($)</label>
                  <input type="number" min={0} step="0.01" value={montantValeur} onChange={(e) => setMontantValeur(e.target.value)} style={champStyle} />
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={forfaitaireValeur} onChange={(e) => setForfaitaireValeur(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>
                      <span style={{ fontWeight: 700 }}>Versées en plus du salaire, sans congé</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>Impôt calculé comme pour un boni. Décochée : la paie remplace le salaire de la période.</span>
                    </span>
                  </label>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={labelStyle}>
                      Heures régulières{paie.heuresHorodateur != null && <span> ({nombre(paie.heuresHorodateur)} h réelles)</span>}
                    </label>
                    <input type="number" min={0} step="0.01" value={heuresValeur} onChange={(e) => setHeuresValeur(e.target.value)} style={champStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Heures supp. (taux et demi)</label>
                    <input type="number" min={0} step="0.01" value={heuresSupValeur} onChange={(e) => setHeuresSupValeur(e.target.value)} style={champStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Jours fériés ($)</label>
                    <input type="number" min={0} step="0.01" value={feriesValeur} onChange={(e) => setFeriesValeur(e.target.value)} style={champStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Boni / extra ($)</label>
                    <input type="number" min={0} step="0.01" value={boniValeur} onChange={(e) => setBoniValeur(e.target.value)} style={champStyle} />
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
                <BoutonAction icone="echange" couleur="var(--accent-ombre)" bordure="var(--accent)" onClick={recalculer} disabled={enCours}>Recalculer</BoutonAction>
                <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={() => onRetirer(paie.id)} disabled={enCours}>Retirer du lot</BoutonAction>
              </div>
            </div>
          ) : null}

          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", margin: "12px 0 4px" }}>Retenues détaillées</div>
          <LigneRetenue label="RRQ" valeur={paie.rrqEmploye} premiere />
          {paie.rrq2Employe > 0 && <LigneRetenue label="RRQ — 2e cotisation supplémentaire" valeur={paie.rrq2Employe} />}
          <LigneRetenue label="RQAP" valeur={paie.rqapEmploye} />
          <LigneRetenue label="Assurance-emploi" valeur={paie.aeEmploye} />
          <LigneRetenue label="Impôt fédéral" valeur={paie.impotFederal} />
          <LigneRetenue label="Impôt Québec" valeur={paie.impotQuebec} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderRadius: 12, background: "var(--danger-fond)", marginTop: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>Total des retenues</span>
            <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--danger)" }}>{argent(paie.totalDeductions)}</span>
          </div>

          {paie.statut === "VERSEE" && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <ModePaiement paie={paie} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <BoutonAction href={`/gerant/paie/${paie.id}/talon`} target="_blank" icone="imprimante">Talon de paie</BoutonAction>
                <BoutonAction icone="crayon" couleur="var(--accent-ombre)" onClick={() => onCorriger(paie.id)}>Corriger</BoutonAction>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Chèque ou virement + son numéro, enregistré dès qu'on change le mode ou
// qu'on quitte le champ du numéro
function ModePaiement({ paie }) {
  const [mode, setMode] = useState(paie.modePaiement || "CHEQUE");
  const [reference, setReference] = useState(paie.referencePaiement || "");
  const [enregistre, setEnregistre] = useState({ mode: paie.modePaiement || "", reference: paie.referencePaiement || "" });
  const [etat, setEtat] = useState("");

  async function enregistrer(nouveauMode, nouvelleReference) {
    const ref = nouvelleReference.trim();
    // Rien à sauvegarder tant qu'aucun numéro n'est entré pour une paie sans mode encore choisi
    if (!enregistre.mode && !ref) return;
    if (nouveauMode === enregistre.mode && ref === enregistre.reference) return;
    setEtat("…");
    const res = await fetch(`/api/paie/${paie.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modePaiement: nouveauMode, referencePaiement: ref }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEtat("");
      window.alert(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    setEnregistre({ mode: nouveauMode, reference: ref });
    setEtat("✓");
  }

  const styleChamp = { fontSize: 13, padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
      <select
        value={mode}
        onChange={(e) => { setMode(e.target.value); enregistrer(e.target.value, reference); }}
        style={styleChamp}
        title="Mode de paiement"
      >
        <option value="CHEQUE">Chèque</option>
        <option value="VIREMENT">Virement</option>
      </select>
      <input
        type="text"
        value={reference}
        onChange={(e) => { setReference(e.target.value); setEtat(""); }}
        onBlur={() => enregistrer(mode, reference)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        placeholder={mode === "CHEQUE" ? "N° de chèque" : "N° de virement"}
        maxLength={100}
        style={{ ...styleChamp, flex: 1, minWidth: 0 }}
      />
      {etat && <span style={{ fontSize: 13, fontWeight: 700, color: etat === "✓" ? "var(--success)" : "var(--text-muted)" }}>{etat}</span>}
    </div>
  );
}

function LigneRetenue({ label, valeur, premiere }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "7px 2px", borderTop: premiere ? "none" : "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{argent(valeur)}</span>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, marginBottom: 10, boxSizing: "border-box",
};
