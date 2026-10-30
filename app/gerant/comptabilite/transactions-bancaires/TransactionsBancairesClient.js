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

const formaterMontant = (m) => `${m < 0 ? "−" : "+"}${Math.abs(m).toFixed(2)} $`;
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
  comptesTresorerie, compte, aExaminer, examinees, exclues, dernierImport,
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
  const avecSuggestion = aExaminer.filter((t) => t.suggestion);
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

  async function accepterTout() {
    const paiements = avecSuggestion.filter((t) => t.suggestion.type !== "LIGNE").length;
    const texte = `Accepter les ${avecSuggestion.length} correspondance(s) trouvée(s) ?`
      + (paiements > 0 ? ` ${paiements} dépense(s) ou facture(s) impayée(s) seront marquées payées.` : "");
    if (!window.confirm(texte)) return;
    setEnCours("tout");
    setMessage(null);
    const res = await fetch("/api/comptabilite/transactions-bancaires/associer-tout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestions: avecSuggestion.map((t) => ({ transactionId: t.id, ...t.suggestion })) }),
    });
    setEnCours(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ erreur: true, texte: data.erreur || "Erreur inattendue." });
      return;
    }
    setMessage({
      erreur: data.erreurs.length > 0,
      texte: `${data.acceptees} correspondance(s) acceptée(s).` + (data.erreurs.length > 0 ? ` ${data.erreurs.length} restée(s) à examiner : ${data.erreurs[0]}` : ""),
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
        saisi, ajoute ce qui manque, ou exclus-la. Tout ce qui est relié est coché d'avance dans la conciliation bancaire.
      </p>

      <select value={compte.id} onChange={(e) => router.push(`/gerant/comptabilite/transactions-bancaires?compte=${e.target.value}`)} className="champ" style={{ marginBottom: 16, fontWeight: 700 }}>
        {comptesTresorerie.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>

      <div className="carte carte-m" style={{ marginBottom: 16 }}>
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
        <Importation compte={compte} dernierImport={dernierImport} />
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
          {avecSuggestion.length > 0 && (
            <button onClick={accepterTout} disabled={enCours === "tout"} className="bouton-3d" style={{ width: "100%", padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              {enCours === "tout" ? "Association…" : `✓ Accepter les ${avecSuggestion.length} correspondance(s) trouvée(s)`}
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aExaminer.slice(0, limite).map((t) => (
              <div key={t.id} className="carte carte-s" style={{ opacity: enCours === t.id ? 0.6 : 1 }}>
                <EnteteTransaction t={t} />
                {t.suggestion && <Suggestion t={t} enCours={enCours === t.id} onAccepter={(corps) => envoyer(t.id, corps)} />}
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
              </div>
            ))}
            {aExaminer.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {dernierImport ? "Tout est examiné ✓" : "Aucune transaction pour l'instant — importe un fichier de ta banque ci-dessus."}
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
            </div>
          ))}
          {examinees.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction examinée pour l'instant.</p>}
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
            </div>
          ))}
          {exclues.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune transaction exclue.</p>}
        </div>
      )}

      <Link href={`/gerant/comptabilite/rapprochement?compte=${compte.id}`} className="bouton-3d-sombre" style={{ display: "block", textAlign: "center", marginTop: 20, padding: 10, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
        🏦 Passer à la conciliation bancaire
      </Link>
    </div>
  );
}

function Importation({ compte, dernierImport }) {
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

  async function annulerImport() {
    if (!window.confirm(`Retirer les ${dernierImport.aExaminer} transaction(s) de ce fichier encore à examiner ?`)) return;
    await fetch(`/api/comptabilite/transactions-bancaires/imports/${dernierImport.importId}`, { method: "DELETE" });
    setResultat(null);
    router.refresh();
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div className="titre-section">Importer un fichier de la banque</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          key={cleChamp} type="file" accept=".ofx,.qfx,.qbo,.csv,.txt"
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
          {resultat.dejaImportees > 0 && ` · ${resultat.dejaImportees} déjà importée(s), ignorée(s)`}
          {resultat.solde && ` · solde de la banque mis à jour`}
        </p>
      )}
      {dernierImport && !resultat && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Dernier import : {dernierImport.fichier || "fichier"} le {new Date(dernierImport.importeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          {dernierImport.aExaminer > 0 && (
            <> · <button onClick={annulerImport} style={{ fontSize: 11, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}>annuler cet import</button></>
          )}
        </p>
      )}

      <details style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10 }}>
        <summary style={{ cursor: "pointer" }}>Où trouver le fichier ?</summary>
        <p style={{ marginTop: 6 }}>
          Dans la banque en ligne pour entreprises (RBC, CIBC…), ouvre le compte, choisis la période, puis télécharge les transactions.
          Préfère le format <strong>OFX</strong>, <strong>QFX (Quicken)</strong> ou <strong>QBO (QuickBooks)</strong> : il donne aussi le solde du compte.
          Le format <strong>CSV</strong> fonctionne aussi. Garde le même format d'un import à l'autre : réimporter une période qui chevauche la précédente
          ne crée pas de doublons.
        </p>
      </details>
    </div>
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

function Suggestion({ t, enCours, onAccepter }) {
  const s = t.suggestion;
  const [titre, bouton, corps] = s.type === "LIGNE"
    ? [`Correspondance : ${s.numero} · ${s.date}`, "Associer", { action: "associer", ligneIds: [s.ligneId] }]
    : s.type === "DEPENSE"
      ? [`Dépense impayée du ${s.date}`, "Enregistrer le paiement", { action: "payer-depense", depenseId: s.depenseId }]
      : [`Facture impayée ${s.numero} du ${s.date}`, "Enregistrer le paiement", { action: "payer-facture", factureId: s.factureId }];
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(111,169,107,0.12)", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--success)" }}>{titre}</div>
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
// compte), ou toute transaction une écriture vers un autre compte
function PanneauAjouter({ t, fournisseurs, categories, comptesGl, dernierPosteParFournisseur, tpsTaux, tvqTaux, enCours, onEnvoyer }) {
  const devine = t.montant < 0 ? devinerFournisseur(t.description, fournisseurs) : null;
  const [mode, setMode] = useState(t.montant < 0 ? "depense" : "ecriture");
  const [fournisseurId, setFournisseurId] = useState(devine?.id || "");
  const [nouveauNom, setNouveauNom] = useState(t.description.split(" — ")[0].replace(/\s+#?\d[\d\s-]*$/, "").trim());
  const [categorieDepenseId, setCategorieDepenseId] = useState((devine && dernierPosteParFournisseur[devine.id]) || "");
  const [taxesIncluses, setTaxesIncluses] = useState(true);
  const [compteNumero, setCompteNumero] = useState("");
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
