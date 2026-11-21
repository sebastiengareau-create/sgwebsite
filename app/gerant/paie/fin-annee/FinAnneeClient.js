"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CODES_DENTAIRES, nomFamilleDe, prenomDe } from "@/lib/nomsFeuillets";
import { stylePanneau, TitrePanneau, TEINTES, Pastille } from "../../../components/StyleSection";

const argent = (n) => Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const bouton = { display: "inline-block", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" };
const boutonContour = { ...bouton, border: "1px solid var(--border)", color: "var(--text)", background: "none" };

export default function FinAnneeClient({ annee, annees, bloquants, aVerifier, codeDentaireDefaut, employes, t4, rl1, nbRelevesBrouillon }) {
  const router = useRouter();
  const [codeDefaut, setCodeDefaut] = useState(codeDentaireDefaut);
  const [message, setMessage] = useState(null);
  const pret = bloquants.length === 0 && t4.nb > 0;

  async function changerCodeDefaut(valeur) {
    setCodeDefaut(Number(valeur));
    const res = await fetch("/api/paie/fin-annee/reglages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codeDentaireDefaut: Number(valeur) }) }).catch(() => null);
    setMessage(res?.ok ? { texte: "Code par défaut enregistré." } : { texte: "Le code n'a pas été enregistré.", erreur: true });
  }

  return (
    <div>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Année des feuillets</label>
        <select name="annee" defaultValue={annee} onChange={(e) => e.currentTarget.form.requestSubmit()} className="champ" style={{ width: "auto", fontSize: 14 }}>
          {(annees.includes(annee) ? annees : [annee, ...annees]).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </form>

      {/* 1. Vérifications */}
      <div style={stylePanneau}>
        <TitrePanneau icone="crochet" teinte={bloquants.length ? TEINTES.rouge : TEINTES.vert} titre="1. Vérifier" sousTitre={t4.nb === 0 ? `Aucune paie versée en ${annee}` : `${t4.nb} employé${t4.nb > 1 ? "s" : ""} payé${t4.nb > 1 ? "s" : ""} en ${annee}`} />
        {bloquants.length > 0 && (
          <div role="alert" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--danger)", marginBottom: 10 }}>
            <b>À corriger avant de produire le T4 :</b>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{bloquants.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
        )}
        {aVerifier.length > 0 && (
          <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
            <b>À vérifier :</b>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: "var(--text-muted)" }}>{aVerifier.map((b) => <li key={b}>{b}</li>)}</ul>
          </div>
        )}
        {bloquants.length === 0 && aVerifier.length === 0 && t4.nb > 0 && <p style={{ fontSize: 13, color: "var(--success)", margin: "0 0 10px" }}>Tout est prêt.</p>}

        {employes.length > 0 && (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0" }}>Noms tels qu&apos;ils iront sur les feuillets, et assurance dentaire (T4, case 45)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {employes.map((e) => <LigneEmploye key={e.id} e={e} codeDefaut={codeDefaut} onEnregistre={() => router.refresh()} />)}
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, marginTop: 10 }}>
              Assurance dentaire par défaut :
              <select value={codeDefaut} onChange={(ev) => changerCodeDefaut(ev.target.value)} className="champ" style={{ width: "auto", fontSize: 13 }}>
                {Object.entries(CODES_DENTAIRES).map(([code, libelle]) => <option key={code} value={code}>{code} — {libelle}</option>)}
              </select>
            </label>
            {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "6px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
          </>
        )}
      </div>

      {/* 2. T4 */}
      <div style={stylePanneau}>
        <TitrePanneau icone="document" teinte={TEINTES.bleu} titre="2. T4 — Agence du revenu du Canada" sousTitre="Fichier XML pour le Transfert de fichiers par Internet" />
        {t4.nb > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
            <Chiffre libelle="Feuillets" valeur={String(t4.nb)} />
            <Chiffre libelle="Revenus d'emploi (14)" valeur={argent(t4.revenus)} />
            <Chiffre libelle="Impôt fédéral (22)" valeur={argent(t4.impot)} />
            <Chiffre libelle="AE employés + employeur" valeur={argent(t4.ae + t4.aeEmployeur)} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <a href={pret ? `/api/paie/fin-annee/t4-xml?annee=${annee}` : undefined} aria-disabled={!pret} className="bouton-3d" style={{ ...bouton, opacity: pret ? 1 : 0.45, pointerEvents: pret ? "auto" : "none" }}>
            ⬇ Fichier T4 (XML)
          </a>
          <a href={t4.nb > 0 ? `/api/paie/fin-annee/t4-copies?annee=${annee}` : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={t4.nb === 0} style={{ ...boutonContour, opacity: t4.nb > 0 ? 1 : 0.45, pointerEvents: t4.nb > 0 ? "auto" : "none" }}>
            🖨 Copies des employés (PDF)
          </a>
          <Link href={`/gerant/paie/feuillets?annee=${annee}`} style={boutonContour}>Sommaire T4 / RL-1</Link>
        </div>
        <ol style={{ fontSize: 13, lineHeight: 1.55, margin: 0, paddingLeft: 18, color: "var(--text-muted)" }}>
          <li>Télécharge le fichier T4. Il contient les NAS : garde-le en lieu sûr.</li>
          <li>Ouvre le Transfert de fichiers par Internet de l&apos;ARC, depuis Mon dossier d&apos;entreprise ou avec ton numéro de compte RP et ton code d&apos;accès Web.</li>
          <li>Téléverse le fichier et garde le numéro de confirmation. Plus de 5 feuillets : la transmission en ligne est obligatoire.</li>
          <li>Remets deux copies à chaque employé (en main propre ou par la poste ; par courriel seulement avec son accord).</li>
        </ol>
      </div>

      {/* 3. RL-1 */}
      <div style={stylePanneau}>
        <TitrePanneau icone="document" teinte={TEINTES.ambre} titre="3. RL-1 — Revenu Québec" sousTitre={rl1.certifie ? "kontrolshop est certifié pour cette année" : "En attente de la certification de kontrolshop"} />
        {!rl1.numeroRqValide && <p role="alert" style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 8px" }}>Numéro d&apos;identification de Revenu Québec manquant ou invalide (10 chiffres, RS et 4 chiffres, ex. 1234567890RS0001) — Administrateur → Informations de l&apos;entreprise.</p>}
        <p style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px", color: "var(--text-muted)" }}>
          Revenu Québec n&apos;accepte le fichier XML des RL-1 que d&apos;un logiciel qu&apos;il a certifié pour l&apos;année. D&apos;ici là, saisis les RL-1 dans
          Mon dossier pour les entreprises de Revenu Québec, à partir des montants du sommaire (cases A, B.A, B.B, C, E, G, H, I) ; le service
          produit aussi les copies des employés.
        </p>
        <Link href={`/gerant/paie/feuillets?annee=${annee}`} style={boutonContour}>Sommaire RL-1 à recopier</Link>
      </div>

      {/* 4. Relevés d'emploi */}
      <div style={stylePanneau}>
        <TitrePanneau icone="utilisateurs" teinte={TEINTES.vert} titre="Relevés d'emploi" sousTitre="À produire au départ d'un employé, dans les 5 jours suivant la fin de la période de paie" droite={nbRelevesBrouillon > 0 ? <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">{nbRelevesBrouillon} brouillon{nbRelevesBrouillon > 1 ? "s" : ""}</Pastille> : null} />
        <Link href="/gerant/paie/releves-emploi" style={boutonContour}>Ouvrir les relevés d&apos;emploi</Link>
      </div>
    </div>
  );
}

function Chiffre({ libelle, valeur }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--surface-alt)" }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{libelle}</div>
      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{valeur}</div>
    </div>
  );
}

function LigneEmploye({ e, codeDefaut, onEnregistre }) {
  const [nomFamille, setNomFamille] = useState(e.nomFamille);
  const [prenom, setPrenom] = useState(e.prenom);
  const [code, setCode] = useState(e.codeDentaireT4);
  const [etat, setEtat] = useState(null);
  const modifie = nomFamille !== e.nomFamille || prenom !== e.prenom || String(code) !== String(e.codeDentaireT4);

  async function enregistrer() {
    setEtat("…");
    const res = await fetch(`/api/paie/fin-annee/employes/${e.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomFamille, prenom, codeDentaireT4: code }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setEtat(data?.erreur || "Non enregistré.");
    setEtat("✓");
    onEnregistre();
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 12 }}>
      <Link href={`/gerant/employes/${e.id}`} style={{ flex: "1 1 100%", fontSize: 13.5, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
        {e.nom}
        <span style={{ fontWeight: 400, fontSize: 12, color: e.nasOk && e.adresseOk ? "var(--text-muted)" : "var(--danger)" }}>
          {" "}· NAS {e.nasOk ? "✓" : "manquant"} · adresse {e.adresseOk ? "✓" : "incomplète"}
        </span>
      </Link>
      <input value={nomFamille} onChange={(ev) => setNomFamille(ev.target.value)} placeholder={nomFamilleDe(e.nom) || "Nom de famille"} aria-label={`Nom de famille de ${e.nom}`} className="champ" style={{ flex: "1 1 120px", minWidth: 0, fontSize: 13 }} />
      <input value={prenom} onChange={(ev) => setPrenom(ev.target.value)} placeholder={prenomDe(e.nom) || "Prénom"} aria-label={`Prénom de ${e.nom}`} className="champ" style={{ flex: "1 1 120px", minWidth: 0, fontSize: 13 }} />
      <select value={code} onChange={(ev) => setCode(ev.target.value)} aria-label={`Assurance dentaire de ${e.nom}`} className="champ" style={{ flex: "1 1 150px", minWidth: 0, fontSize: 13 }}>
        <option value="">Par défaut ({codeDefaut})</option>
        {Object.entries(CODES_DENTAIRES).map(([c, libelle]) => <option key={c} value={c}>{c} — {libelle}</option>)}
      </select>
      <button type="button" onClick={enregistrer} disabled={!modifie} style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: modifie ? "pointer" : "default", opacity: modifie ? 1 : 0.5 }}>
        Enregistrer
      </button>
      {etat && <span role="status" style={{ fontSize: 12, color: etat === "✓" ? "var(--success)" : "var(--text-muted)" }}>{etat}</span>}
    </div>
  );
}
