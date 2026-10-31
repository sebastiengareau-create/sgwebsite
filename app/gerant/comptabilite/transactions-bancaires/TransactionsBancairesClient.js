"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TAILLE_PAGE = 50;
const LABEL_CREE = {
  DEPENSE: "Dépense ajoutée",
  ECRITURE: "Écriture ajoutée",
  PAIEMENT_DEPENSE: "Paiement de la dépense enregistré",
  PAIEMENT_FACTURE: "Paiement de la facture enregistré",
};
const LABEL_JOURNAL = {
  ...LABEL_CREE,
  ASSOCIEE: "Associée",
  EXCLUE: "Exclue",
  ANNULEE: "Remise à examiner",
  DETACHEE: "Remise à examiner : l'écriture reliée a été supprimée ailleurs",
};

const formaterMontant = (m) => `${m < 0 ? "−" : "+"}${Math.abs(m).toFixed(2)} $`;
const formaterDateHeure = (iso) => new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "short", timeStyle: "short" });
const normaliser = (texte) => String(texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

// Fournisseur dont le nom apparaît dans la description de la banque
// (« PETRO-CANADA 12345 MONTREAL » → Petro-Canada) — le plus long l'emporte
function devinerFournisseur(description, fournisseurs) {
  const texte = ` ${normaliser(description)} `;
  let meilleur = null;
  for (const f of fournisseurs) {
    const nom = normaliser(f.nom);
    if (nom.length >= 3 && texte.includes(` ${nom} `) && (!meilleur || nom.length > normaliser(meilleur.nom).length)) meilleur = f;
  }
  return meilleur;
}

export default function TransactionsBancairesClient({
  comptesTresorerie, compte, aExaminer, examinees, exclues, nbExaminees, totalDoublons, imports, regles,
  fournisseurs, categories, comptesGl, dernierPosteParFournisseur, tpsTaux, tvqTaux,
}) {
  const router = useRouter();
  const [onglet, setOnglet] = useState("examiner");
  const [ouvert, setOuvert] = useState(null); // { id, mode: "ajouter" | "transfert" | "trouver" }
  const [enCours, setEnCours] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [message, setMessage] = useState(null);
  const [limite, setLimite] = useState(TAILLE_PAGE);

  const estCarte = compte.categorie === "CARTE_CREDIT";
  const sures = aExaminer.filter((t) => t.suggestion?.certitude === "SURE");
  const apprises = aExaminer.filter((t) => t.suggestion?.type === "REGLE");
  const nbReconnues = aExaminer.filter((t) => t.suggestion).length;
  const autresComptes = comptesTresorerie.filter((c) => c.id !== compte.id);

  // Envoie une action d'examen ; retourne le message d'erreur, ou null
  async function envoyer(id, corps) {
    setEnCours(id);
    setMessage(null);
    setErreurs((e) => ({ ...e, [id]: null }));
    const res = await fetch(`/api/comptabilite/transactions-bancaires/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    setEnCours(null);
    if (!res.ok) {
      const erreur = (await res.json().catch(() => ({}))).erreur || "Erreur inattendue.";
      setErreurs((e) => ({ ...e, [id]: erreur }));
      return erreur;
    }
    setOuvert(null);
    router.refresh();
    return null;
  }

  // Confirme d'un coup les correspondances trouvées, ou les classements
  // appris — les correspondances seulement possibles se confirment une à une
  async function confirmerGroupe(liste, question) {
    if (!window.confirm(question)) return;
    setEnCours("tout");
    setMessage(null);
    const res = await fetch("/api/comptabilite/transactions-bancaires/associer-tout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestions: liste.map((t) => ({ transactionId: t.id, ...t.suggestion })) }),
    });
    setEnCours(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ erreur: true, texte: data.erreur || "Erreur inattendue." });
      return;
    }
    setMessage({
      erreur: data.erreurs.length > 0,
      texte: `${data.acceptees} transaction(s) confirmée(s).` + (data.erreurs.length > 0 ? ` ${data.erreurs.length} restée(s) à examiner : ${data.erreurs[0]}` : ""),
    });
    router.refresh();
  }

  function basculer(id, mode) {
    setOuvert((o) => (o?.id === id && o.mode === mode ? null : { id, mode }));
  }

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>📥 Transactions bancaires</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
        Importe le fichier des transactions de ta banque en ligne, puis relie chacune à tes livres : associe-la à ce qui est déjà
        saisi, ajoute ce qui manque, ou exclus-la. Ce que tu ajoutes est retenu pour reconnaître les transactions semblables.
        Tout ce qui est relié est coché d'avance dans la conciliation bancaire.
      </p>

      <select value={compte.id} onChange={(e) => router.push(`/gerant/comptabilite/transactions-bancaires?compte=${e.target.value}`)} className="champ" style={{ marginBottom: 4, fontWeight: 700 }}>
        {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 16 }}>Compte comptable : {compte.compteGl}</p>

      <div className="carte carte-m" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div className="titre-section" style={{ marginBottom: 2 }}>{estCarte ? "Solde dû selon la banque" : "Solde selon la banque"}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{compte.soldeReleve !== null ? `${compte.soldeReleve.toFixed(2)} $` : "—"}</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{compte.soldeReleveLe ? `au ${compte.soldeReleveLe}` : "importe un fichier OFX pour l'obtenir"}</div>
          </div>
          <div>
            <div className="titre-section" style={{ marginBottom: 2 }}>Solde aux livres</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{compte.soldeLivres.toFixed(2)} $</div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>toutes dates confondues</div>
          </div>
        </div>
        <Importation compte={compte} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
        <Tuile valeur={aExaminer.length - nbReconnues} libelle="À classifier" couleur={aExaminer.length - nbReconnues > 0 ? "var(--danger)" : "var(--text-muted)"} />
        <Tuile valeur={nbReconnues} libelle="Reconnues, à confirmer" couleur={nbReconnues > 0 ? "var(--success)" : "var(--text-muted)"} />
        <Tuile valeur={nbExaminees} libelle="Examinées" couleur="var(--text)" />
        <Tuile valeur={totalDoublons} libelle="Doublons ignorés" couleur="var(--text-muted)" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          ["examiner", `À examiner (${aExaminer.length})`],
          ["examinees", "Examinées"],
          ["exclues", `Exclues (${exclues.length})`],
        ].map(([cle, label]) => (
          <button
            key={cle} onClick={() => setOnglet(cle)}
            className={onglet === cle ? "bouton-3d" : "bouton-3d-sombre"}
            style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p style={{ color: message.erreur ? "var(--danger)" : "var(--success)", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{message.texte}</p>}

      {onglet === "examiner" && (
        <>
          {(sures.length > 0 || apprises.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {sures.length > 0 && (
                <button
                  onClick={() => confirmerGroupe(sures, `Associer les ${sures.length} correspondance(s) trouvée(s) à leur écriture ?`)}
                  disabled={enCours === "tout"} className="bouton-3d" style={{ padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}
                >
                  {enCours === "tout" ? "Confirmation…" : `✓ Associer les ${sures.length} correspondance(s) trouvée(s)`}
                </button>
              )}
              {apprises.length > 0 && (
                <button
                  onClick={() => confirmerGroupe(apprises, `Confirmer les ${apprises.length} classement(s) appris ? Une dépense ou une écriture sera ajoutée pour chacune, comme la dernière fois.`)}
                  disabled={enCours === "tout"} className="bouton-3d-sombre" style={{ padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700 }}
                >
                  {enCours === "tout" ? "Confirmation…" : `🧠 Confirmer les ${apprises.length} classement(s) appris`}
                </button>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aExaminer.slice(0, limite).map((t) => (
              <div key={t.id} className="carte carte-s" style={{ opacity: enCours === t.id ? 0.6 : 1 }}>
                <EnteteTransaction t={t} />
                {t.suggestion
                  ? <Suggestion t={t} enCours={enCours === t.id} onAccepter={(corps) => envoyer(t.id, corps)} />
                  : <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Aucune correspondance — à classifier</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <BoutonAction actif={ouvert?.id === t.id && ouvert.mode === "ajouter"} onClick={() => basculer(t.id, "ajouter")}>➕ Ajouter</BoutonAction>
                  {autresComptes.length > 0 && <BoutonAction actif={ouvert?.id === t.id && ouvert.mode === "transfert"} onClick={() => basculer(t.id, "transfert")}>⇄ Transfert</BoutonAction>}
                  <BoutonAction actif={ouvert?.id === t.id && ouvert.mode === "trouver"} onClick={() => basculer(t.id, "trouver")}>🔍 Trouver</BoutonAction>
                  <BoutonAction onClick={() => envoyer(t.id, { action: "exclure" })} disabled={enCours === t.id}>Exclure</BoutonAction>
                </div>
                {ouvert?.id === t.id && ouvert.mode === "ajouter" && (
                  <PanneauAjouter
                    t={t} fournisseurs={fournisseurs} categories={categories} comptesGl={comptesGl}
                    dernierPosteParFournisseur={dernierPosteParFournisseur} tpsTaux={tpsTaux} tvqTaux={tvqTaux}
                    enCours={enCours === t.id} onEnvoyer={(corps) => envoyer(t.id, corps)}
                  />
                )}
                {ouvert?.id === t.id && ouvert.mode === "transfert" && (
                  <PanneauTransfert t={t} autresComptes={autresComptes} enCours={enCours === t.id} onEnvoyer={(corps) => envoyer(t.id, corps)} />
                )}
                {ouvert?.id === t.id && ouvert.mode === "trouver" && (
                  <PanneauTrouver t={t} enCours={enCours === t.id} onEnvoyer={(corps) => envoyer(t.id, corps)} />
                )}
                {erreurs[t.id] && <p style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginTop: 8, whiteSpace: "pre-line" }}>{erreurs[t.id]}</p>}
                <Journal t={t} />
              </div>
            ))}
            {aExaminer.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {imports.length > 0 ? "Tout est examiné ✓" : "Aucune transaction pour l'instant — importe un fichier de ta banque ci-dessus."}
              </p>
            )}
            {aExaminer.length > limite && (
              <button onClick={() => setLimite((l) => l + TAILLE_PAGE)} className="bouton-3d-sombre" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                Afficher plus ({aExaminer.length - limite} de plus)
              </button>
            )}
          </div>
        </>
      )}

      {onglet === "examinees" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {examinees.map((t) => (
            <div key={t.id} className="carte carte-s" style={{ opacity: enCours === t.id ? 0.6 : 1 }}>
              <EnteteTransaction t={t} />
              <div style={{ fontSize: 11.5, marginTop: 6, color: "var(--success)", fontWeight: 600 }}>
                ✓ {t.creeType ? LABEL_CREE[t.creeType] : "Associée"}{t.examinePar ? ` · par ${t.examinePar}` : ""}
              </div>
              {t.liens.map((l, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.numero} · {l.description}</div>
              ))}
              <button
                onClick={() => {
                  const avertissement = t.creeType === "DEPENSE" || t.creeType === "ECRITURE"
                    ? " Ce qui a été ajouté depuis cette transaction sera supprimé."
                    : t.creeType ? " La dépense ou la facture redeviendra impayée." : "";
                  if (window.confirm(`Remettre cette transaction à examiner ?${avertissement}`)) envoyer(t.id, { action: "annuler" });
                }}
                disabled={enCours === t.id}
                style={{ fontSize: 11, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, marginTop: 6 }}
              >
                Annuler
              </button>
              {erreurs[t.id] && <p style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginTop: 6, whiteSpace: "pre-line" }}>{erreurs[t.id]}</p>}
              <Journal t={t} />
            </div>
          ))}
          {examinees.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction examinée pour l'instant.</p>}
          {nbExaminees > examinees.length && <p style={{ color: "var(--text-muted)", fontSize: 11 }}>Les {examinees.length} plus récentes sont affichées.</p>}
        </div>
      )}

      {onglet === "exclues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exclues.map((t) => (
            <div key={t.id} className="carte carte-s" style={{ opacity: enCours === t.id ? 0.6 : 1 }}>
              <EnteteTransaction t={t} />
              <button
                onClick={() => envoyer(t.id, { action: "annuler" })} disabled={enCours === t.id}
                style={{ fontSize: 11, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, marginTop: 6 }}
              >
                Remettre à examiner
              </button>
              <Journal t={t} />
            </div>
          ))}
          {exclues.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction exclue.</p>}
        </div>
      )}

      <Link href={`/gerant/comptabilite/rapprochement?compte=${compte.id}`} className="bouton-3d-sombre" style={{ display: "block", textAlign: "center", marginTop: 20, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
        🏦 Passer à la conciliation bancaire
      </Link>

      <HistoriqueImports imports={imports} />
      <ClassementsAppris regles={regles} />
    </div>
  );
}

function Tuile({ valeur, libelle, couleur }) {
  return (
    <div className="carte carte-s" style={{ padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.25 }}>{libelle}</div>
    </div>
  );
}

function Importation({ compte }) {
  const router = useRouter();
  const [fichier, setFichier] = useState(null);
  const [cleChamp, setCleChamp] = useState(0); // vide le champ fichier après un import
  const [enCours, setEnCours] = useState(false);
  const [choixCompte, setChoixCompte] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState("");

  async function importer(numeroCompte) {
    if (!fichier) return;
    setEnCours(true);
    setErreur("");
    setResultat(null);
    const donnees = new FormData();
    donnees.append("fichier", fichier);
    donnees.append("compteTresorerieId", compte.id);
    if (numeroCompte) donnees.append("numeroCompte", numeroCompte);
    const res = await fetch("/api/comptabilite/transactions-bancaires", { method: "POST", body: donnees });
    setEnCours(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErreur(data.erreur || "Import impossible.");
      return;
    }
    if (data.choixCompte) {
      setChoixCompte(data.choixCompte);
      return;
    }
    setChoixCompte(null);
    setFichier(null);
    setCleChamp((c) => c + 1);
    setResultat(data);
    router.refresh();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div className="titre-section">Importer un fichier de la banque</div>
      <div style={{ display: "flex", gap: 8 }}>
        {/* Pas d'attribut accept : l'iPhone (et certains Android) ne connaît
            pas le type .ofx/.qfx/.qbo et grise ces fichiers dans le sélecteur.
            Le serveur reconnaît le format et refuse un fichier illisible. */}
        <input
          key={cleChamp} type="file"
          onChange={(e) => { setFichier(e.target.files?.[0] || null); setChoixCompte(null); setErreur(""); }}
          className="champ" style={{ flex: 1, minWidth: 0 }}
        />
        <button onClick={() => importer()} disabled={!fichier || enCours} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
          {enCours ? "Import…" : "Importer"}
        </button>
      </div>

      {choixCompte && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12, marginBottom: 6 }}>Ce fichier contient plusieurs comptes. Lequel correspond à <strong>{compte.nom}</strong> ?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {choixCompte.map((c) => (
              <button key={c.numero || "?"} onClick={() => importer(c.numero)} disabled={enCours} className="bouton-3d-sombre" style={{ padding: 8, borderRadius: 8, fontSize: 12, textAlign: "left" }}>
                Compte {c.numero || "sans numéro"} · {c.nombre} transaction(s)
              </button>
            ))}
          </div>
        </div>
      )}

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700, marginTop: 8 }}>{erreur}</p>}
      {resultat && (
        <p style={{ color: "var(--success)", fontSize: 12, fontWeight: 700, marginTop: 8 }}>
          {resultat.importees} transaction(s) importée(s) du {resultat.debut} au {resultat.fin}
          {resultat.dejaImportees > 0 && ` · ${resultat.dejaImportees} doublon(s) ignoré(s)`}
          {resultat.solde && ` · solde de la banque mis à jour`}
        </p>
      )}

      <details style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10 }}>
        <summary style={{ cursor: "pointer" }}>Où trouver le fichier ?</summary>
        <p style={{ marginTop: 6 }}>
          Dans la banque en ligne pour entreprises (RBC, CIBC, AccèsD Affaires…), ouvre le compte, choisis la période, puis télécharge
          ou exporte les transactions — pas le relevé mensuel en PDF. Préfère le format <strong>OFX</strong>, <strong>QFX (Quicken)</strong>
          ou <strong>QBO (QuickBooks)</strong> : il donne aussi le solde du compte. Le format <strong>CSV</strong> fonctionne aussi. Garde le
          même format d'un import à l'autre : réimporter une période qui chevauche la précédente ne crée pas de doublons.
        </p>
      </details>
    </div>
  );
}

function HistoriqueImports({ imports }) {
  const router = useRouter();

  async function annuler(i) {
    if (!window.confirm(`Retirer les ${i.aExaminer} transaction(s) de « ${i.nomFichier} » encore à examiner ? L'import restera dans l'historique.`)) return;
    await fetch(`/api/comptabilite/transactions-bancaires/imports/${i.id}`, { method: "DELETE" });
    router.refresh();
  }

  if (imports.length === 0) return null;
  return (
    <details className="carte carte-m" style={{ marginTop: 16 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>🗂️ Historique des imports</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {imports.map((i) => (
          <div key={i.id} style={{ fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 8, opacity: i.annuleLe ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <a href={`/api/comptabilite/transactions-bancaires/imports/${i.id}`} style={{ color: "var(--accent)", fontWeight: 600, overflowWrap: "anywhere" }} title="Télécharger la copie du fichier original">
                {i.nomFichier}
              </a>
              <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formaterDateHeure(i.importeLe)}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {i.format}{i.numeroCompte ? ` · compte ${i.numeroCompte}` : ""}{i.debut ? ` · du ${i.debut} au ${i.fin}` : ""}
              {` · ${i.nbImportees} importée(s), ${i.nbDoublons} doublon(s)`}{i.importePar ? ` · par ${i.importePar}` : ""}
            </div>
            {i.annuleLe && <div style={{ fontSize: 11, color: "var(--danger)" }}>Annulé le {formaterDateHeure(i.annuleLe)}{i.annulePar ? ` par ${i.annulePar}` : ""}</div>}
            {!i.annuleLe && i.aExaminer > 0 && (
              <button onClick={() => annuler(i)} style={{ fontSize: 11, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}>
                Annuler cet import ({i.aExaminer} encore à examiner)
              </button>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function ClassementsAppris({ regles }) {
  const router = useRouter();

  async function oublier(r) {
    if (!window.confirm(`Oublier le classement « ${r.signature} » ? Il se réapprendra au prochain ajout semblable.`)) return;
    await fetch(`/api/comptabilite/transactions-bancaires/regles/${r.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <details className="carte carte-m" style={{ marginTop: 10 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>🧠 Classements appris ({regles.length})</summary>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0" }}>
        Chaque transaction ajoutée (dépense, écriture, transfert) est retenue par ses mots significatifs. La prochaine qui lui
        ressemble est proposée avec le même classement — à confirmer, jamais comptabilisée sans toi. Valables pour tous les comptes.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {regles.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.signature} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{r.sens > 0 ? "(entrée)" : "(sortie)"}</span></div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>→ {r.classement} · utilisé {r.utilisations} fois</div>
            </div>
            <button onClick={() => oublier(r)} style={{ fontSize: 11, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}>Oublier</button>
          </div>
        ))}
        {regles.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Rien d'appris pour l'instant.</p>}
      </div>
    </details>
  );
}

function EnteteTransaction({ t }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: "anywhere" }}>{t.description}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t.date}{t.reference ? ` · chèque ${t.reference}` : ""}</div>
      </div>
      <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: t.montant >= 0 ? "var(--success)" : "var(--danger)" }}>{formaterMontant(t.montant)}</span>
    </div>
  );
}

// Validations et annulations successives de la transaction
function Journal({ t }) {
  if (!t.journal?.length) return null;
  return (
    <details style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
      <summary style={{ cursor: "pointer" }}>Historique ({t.journal.length})</summary>
      {t.journal.map((j, i) => (
        <div key={i}>{formaterDateHeure(j.le)} · {LABEL_JOURNAL[j.action] || j.action}{j.par ? ` · ${j.par}` : ""}</div>
      ))}
    </details>
  );
}

// Correspondance trouvée (sûre), possible (à vérifier), ou classement appris
const STYLE_CERTITUDE = {
  SURE: { fond: "rgba(111,169,107,0.12)", couleur: "var(--success)" },
  POSSIBLE: { fond: "rgba(201,162,39,0.14)", couleur: "#C9A227" },
  APPRISE: { fond: "rgba(79,130,192,0.14)", couleur: "#4F82C0" },
};

function Suggestion({ t, enCours, onAccepter }) {
  const s = t.suggestion;
  const [titre, bouton, corps] = s.type === "LIGNE"
    ? [`${s.certitude === "SURE" ? "Correspondance trouvée" : "Correspondance possible, à vérifier"} : ${s.numero} · ${s.date}`, "Associer", { action: "associer", ligneIds: [s.ligneId] }]
    : s.type === "DEPENSE"
      ? [`Correspondance possible : dépense impayée du ${s.date}`, "Enregistrer le paiement", { action: "payer-depense", depenseId: s.depenseId }]
      : s.type === "FACTURE"
        ? [`Correspondance possible : facture impayée ${s.numero} du ${s.date}`, "Enregistrer le paiement", { action: "payer-facture", factureId: s.factureId }]
        : [`Classement appris : ${s.action === "DEPENSE" ? "dépense" : "écriture"}`, "Confirmer", { action: "regle", regleId: s.regleId }];
  const style = STYLE_CERTITUDE[s.certitude] || STYLE_CERTITUDE.POSSIBLE;
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: style.fond, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: style.couleur }}>{titre}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", overflowWrap: "anywhere" }}>{s.description}</div>
      </div>
      <button onClick={() => onAccepter(corps)} disabled={enCours} className="bouton-3d" style={{ padding: "7px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
        {bouton}
      </button>
    </div>
  );
}

function BoutonAction({ actif, children, ...props }) {
  return (
    <button {...props} style={{
      padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "var(--text)",
      background: actif ? "var(--bg)" : "none", border: actif ? "1px solid var(--accent)" : "1px solid var(--border)",
    }}>
      {children}
    </button>
  );
}

// « Ajouter » : une sortie devient une dépense fournisseur (payée par ce
// compte), ou toute transaction une écriture vers un autre compte. Un
// classement appris remplit d'office les mêmes choix que la dernière fois.
function PanneauAjouter({ t, fournisseurs, categories, comptesGl, dernierPosteParFournisseur, tpsTaux, tvqTaux, enCours, onEnvoyer }) {
  const appris = t.suggestion?.type === "REGLE" ? t.suggestion : null;
  const devine = t.montant < 0 && !appris ? devinerFournisseur(t.description, fournisseurs) : null;
  const [mode, setMode] = useState(appris ? (appris.action === "DEPENSE" ? "depense" : "ecriture") : t.montant < 0 ? "depense" : "ecriture");
  const [fournisseurId, setFournisseurId] = useState(appris?.fournisseurId || devine?.id || "");
  const [nouveauNom, setNouveauNom] = useState(t.description.split(" — ")[0].replace(/\s+#?\d[\d\s-]*$/, "").trim());
  const [categorieDepenseId, setCategorieDepenseId] = useState(appris?.categorieDepenseId || (devine && dernierPosteParFournisseur[devine.id]) || "");
  const [taxesIncluses, setTaxesIncluses] = useState(appris ? appris.taxesIncluses : true);
  const [compteNumero, setCompteNumero] = useState(appris?.compteNumero || "");
  const [description, setDescription] = useState(t.description);

  function choisirFournisseur(id) {
    setFournisseurId(id);
    if (dernierPosteParFournisseur[id]) setCategorieDepenseId(dernierPosteParFournisseur[id]);
  }

  const pret = mode === "depense"
    ? categorieDepenseId && (fournisseurId === "__nouveau" ? nouveauNom.trim() : fournisseurId)
    : compteNumero;

  function enregistrer() {
    if (mode === "depense") {
      onEnvoyer({
        action: "depense",
        fournisseurId: fournisseurId === "__nouveau" ? null : fournisseurId,
        nouveauFournisseur: fournisseurId === "__nouveau" ? nouveauNom : null,
        categorieDepenseId, description, taxesIncluses,
      });
    } else {
      onEnvoyer({ action: "ecriture", compteNumero, description });
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
      {t.montant < 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          <BoutonAction actif={mode === "depense"} onClick={() => setMode("depense")}>Dépense fournisseur</BoutonAction>
          <BoutonAction actif={mode === "ecriture"} onClick={() => setMode("ecriture")}>Autre compte</BoutonAction>
        </div>
      )}

      {mode === "depense" ? (
        <>
          <div>
            <label style={labelStyle}>Fournisseur</label>
            <select value={fournisseurId} onChange={(e) => choisirFournisseur(e.target.value)} className="champ">
              <option value="">— Choisir —</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              <option value="__nouveau">+ Nouveau fournisseur…</option>
            </select>
          </div>
          {fournisseurId === "__nouveau" && (
            <input value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} placeholder="Nom du fournisseur" className="champ" />
          )}
          <div>
            <label style={labelStyle}>Poste de dépense</label>
            <select value={categorieDepenseId} onChange={(e) => setCategorieDepenseId(e.target.value)} className="champ">
              <option value="">— Choisir —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={taxesIncluses} onChange={(e) => setTaxesIncluses(e.target.checked)} />
            TPS ({tpsTaux} %) et TVQ ({tvqTaux} %) incluses dans le montant — récupérables
          </label>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            La banque ne dit pas si un achat est taxé, ni s'il s'agit d'inventaire : vérifie avant d'ajouter. Une réception de pièces
            en inventaire se saisit plutôt dans les comptes à payer, puis s'associe ici.
          </p>
        </>
      ) : (
        <div>
          <label style={labelStyle}>{t.montant > 0 ? "D'où vient l'argent ?" : "Où va l'argent ?"}</label>
          <select value={compteNumero} onChange={(e) => setCompteNumero(e.target.value)} className="champ">
            <option value="">— Choisir un compte —</option>
            {comptesGl.map((c) => <option key={c.numero} value={c.numero}>{c.numero} · {c.nom}</option>)}
          </select>
        </div>
      )}

      <div>
        <label style={labelStyle}>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="champ" />
      </div>
      <button onClick={enregistrer} disabled={!pret || enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
        {enCours ? "Enregistrement…" : mode === "depense" ? `Ajouter la dépense de ${Math.abs(t.montant).toFixed(2)} $` : "Ajouter l'écriture"}
      </button>
    </div>
  );
}

function PanneauTransfert({ t, autresComptes, enCours, onEnvoyer }) {
  const [compteTresorerieId, setCompteTresorerieId] = useState("");
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <label style={labelStyle}>{t.montant > 0 ? "Transfert reçu de" : "Transfert vers"}</label>
        <select value={compteTresorerieId} onChange={(e) => setCompteTresorerieId(e.target.value)} className="champ">
          <option value="">— Choisir le compte —</option>
          {autresComptes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
        Si l'autre compte a aussi ses transactions importées, la contrepartie y sera proposée d'office.
      </p>
      <button onClick={() => onEnvoyer({ action: "transfert", compteTresorerieId })} disabled={!compteTresorerieId || enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
        {enCours ? "Enregistrement…" : "Enregistrer le transfert"}
      </button>
    </div>
  );
}

// « Trouver » : lignes du compte autour de la date — plusieurs peuvent être
// cochées quand un dépôt regroupe plusieurs encaissements
function PanneauTrouver({ t, enCours, onEnvoyer }) {
  const [candidats, setCandidats] = useState(null);
  const [erreur, setErreur] = useState("");
  const [choisies, setChoisies] = useState([]);

  useEffect(() => {
    fetch(`/api/comptabilite/transactions-bancaires/${t.id}/candidats`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.erreur || "Recherche impossible.");
        setCandidats(data);
      })
      .catch((e) => setErreur(e.message));
  }, [t.id]);

  const total = (candidats || []).filter((c) => choisies.includes(c.id)).reduce((s, c) => s + c.montant, 0);
  const concorde = choisies.length > 0 && Math.abs(total - t.montant) < 0.005;

  function basculer(id) {
    setChoisies((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</p>}
      {!candidats && !erreur && <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Recherche…</p>}
      {candidats && candidats.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Aucune écriture libre sur ce compte autour du {t.date}. Utilise « Ajouter ».</p>
      )}
      {candidats && candidats.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
            {candidats.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 4px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                <input type="checkbox" checked={choisies.includes(c.id)} onChange={() => basculer(c.id)} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflowWrap: "anywhere" }}>{c.description}</span>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{c.date} · {c.numero}</span>
                </span>
                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formaterMontant(c.montant)}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, margin: "8px 0", fontWeight: 700, color: concorde ? "var(--success)" : "var(--text-muted)" }}>
            <span>Sélection : {formaterMontant(total)}</span>
            <span>Transaction : {formaterMontant(t.montant)}</span>
          </div>
          <button onClick={() => onEnvoyer({ action: "associer", ligneIds: choisies })} disabled={!concorde || enCours} className="bouton-3d" style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
            {enCours ? "Association…" : "Associer la sélection"}
          </button>
        </>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 };
