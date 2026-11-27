"use client";

import { useState } from "react";
import CaseSignature from "@/app/components/CaseSignature";
import { argent } from "@/lib/format";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

const REPONSES = (avis) => [
  { code: "ACCEPTE", label: "J'accepte la modification", detail: avis ? `Nouveau loyer de ${argent(avis.nouveauLoyer)} par mois à compter du ${DATE.format(new Date(avis.debut))}.` : null },
  { code: "REFUSE", label: "Je refuse la modification et je reste", detail: "Le propriétaire pourra demander au Tribunal administratif du logement de fixer le loyer." },
  { code: "QUITTE", label: "Je quitte le logement à la fin du bail", detail: avis ? `Le ${DATE.format(new Date(avis.finBail))}.` : null },
];

const LIBELLES_STATUT = { EN_ATTENTE: "en attente", SIGNE: "signé", REFUSE: "refusé" };

// Signature d'un document (bail, document déposé) ou réponse signée à un
// avis de modification (mode « AVIS »)
export default function SignatureClient({ jeton, mode, demande, document, parties, avis, reglementRemisLe, telephone }) {
  const avisMode = mode === "AVIS";
  const [statut, setStatut] = useState(demande.statut);
  const [nom, setNom] = useState(demande.nom || "");
  const [signature, setSignature] = useState(null);
  const [consentement, setConsentement] = useState(false);
  const [reglementRecu, setReglementRecu] = useState(false);
  const [reponseAvis, setReponseAvis] = useState("");
  const [note, setNote] = useState("");
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [reponduLe, setReponduLe] = useState(demande.reponduLe);
  const aRepondre = statut === "EN_ATTENTE";
  const lienPdf = `/api/signature/${jeton}/document`;
  const choix = REPONSES(avis);

  async function envoyer(action) {
    setErreur("");
    if (action === "SIGNER") {
      if (avisMode && !reponseAvis) return setErreur("Choisissez votre réponse.");
      if (!nom.trim()) return setErreur("Entrez votre nom.");
      if (!signature) return setErreur("Signez dans la case.");
      if (reglementRemisLe && !reglementRecu) return setErreur("Cochez la case confirmant que vous avez reçu le règlement de l'immeuble.");
      if (!consentement) return setErreur("Cochez la case de consentement.");
    }
    setEnCours(true);
    const res = await fetch(`/api/signature/${jeton}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, nom, signature, consentement, reglementRecu, reponseAvis, note }),
    }).catch(() => null);
    setEnCours(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      return setErreur(data?.erreur || "Envoi impossible. Vérifiez votre connexion et réessayez.");
    }
    setReponduLe(new Date().toISOString());
    setStatut(action === "SIGNER" ? "SIGNE" : "REFUSE");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const reponseFinale = demande.reponseAvis || reponseAvis;
  return (
    <div>
      {statut === "SIGNE" && (
        <Bandeau couleur="var(--success)" titre={avisMode ? "Réponse transmise — merci !" : "Document signé — merci !"}>
          {avisMode && reponseFinale ? `${choix.find((c) => c.code === reponseFinale)?.label}. ` : ""}
          Signé{demande.signataireNom || nom ? ` par ${demande.signataireNom || nom}` : ""}{reponduLe ? ` le ${DATE_HEURE.format(new Date(reponduLe))}` : ""}.
          {demande.role === "LOCATAIRE" && !document.signe && " Une copie signée vous sera transmise une fois toutes les signatures reçues."}
        </Bandeau>
      )}
      {statut === "REFUSE" && (
        <Bandeau couleur="var(--danger)" titre="Signature refusée">
          Votre réponse a été transmise{reponduLe ? ` le ${DATE_HEURE.format(new Date(reponduLe))}` : ""}. Pour en discuter{telephone ? `, appelez au ${telephone}` : ", communiquez avec votre propriétaire"}.
        </Bandeau>
      )}

      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{document.titre}</h1>
      {document.adresse && <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 12 }}>{document.adresse}</div>}

      {avisMode && avis && aRepondre && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 14 }}>
          À compter du <strong>{DATE.format(new Date(avis.debut))}</strong>, votre loyer passerait de <strong>{argent(avis.loyer)}</strong> à <strong>{argent(avis.nouveauLoyer)}</strong> par mois.
          {avis.limite && <> Répondez d&apos;ici le <strong>{DATE.format(new Date(avis.limite))}</strong> : sans réponse dans le mois suivant la réception de l&apos;avis, vous êtes réputé accepter.</>}
        </div>
      )}

      {demande.message && (
        <div style={{ background: "rgba(232,163,61,0.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 14, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
          <strong>Message du propriétaire :</strong> {demande.message}
        </div>
      )}

      {/* Aperçu intégré sur grand écran seulement : les téléphones affichent
          mal un PDF dans la page — ils l'ouvrent avec le bouton */}
      <style>{`.apercu-pdf{display:block}@media (max-width:700px){.apercu-pdf{display:none}}`}</style>
      <div className="apercu-pdf" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
        <iframe src={lienPdf} title={document.titre} style={{ display: "block", width: "100%", height: "65vh", border: "none", background: "#fff" }} />
      </div>
      <a href={lienPdf} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", padding: 14, borderRadius: 14, border: "1.5px solid var(--accent)", background: "var(--surface)", color: "var(--text)", fontSize: 15, fontWeight: 800, textDecoration: "none", marginBottom: 10 }}>
        📄 Lire le document{avisMode ? " (avis)" : ""} en plein écran
      </a>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 18 }}>
        <a href={`${lienPdf}?telecharger`} style={lien}>⬇️ Télécharger</a>
        {document.signe && <a href={`${lienPdf}?version=signee`} target="_blank" rel="noreferrer" style={lien}>✅ Version signée</a>}
      </div>
      {document.signe && document.empreinteSignee && (
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", textAlign: "center", margin: "-8px 0 18px", overflowWrap: "anywhere" }}>
          Empreinte SHA-256 de la version signée : <code>{document.empreinteSignee}</code>
        </p>
      )}

      {parties.length > 1 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Signataires : {parties.map((p, i) => (
            <span key={p.id}>{i > 0 && " · "}<strong style={{ color: p.moi ? "var(--text)" : undefined }}>{p.moi ? "vous" : p.nom}</strong> ({LIBELLES_STATUT[p.moi ? statut : p.statut] || p.statut})</span>
          ))}
        </div>
      )}

      {!aRepondre && demande.signature && statut === "SIGNE" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Signature de {demande.signataireNom}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={demande.signature} alt="Signature" style={{ display: "block", width: "100%", maxWidth: 360, height: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 10 }} />
        </div>
      )}

      {aRepondre && (
        <div>
          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>{avisMode ? "Votre réponse" : "Signer le document"}</h2>
          {avisMode && (
            <div style={{ display: "grid", gap: 8, marginBottom: 14 }} role="radiogroup">
              {choix.map((c) => (
                <label key={c.code} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, cursor: "pointer", background: "var(--surface)", border: `1.5px solid ${reponseAvis === c.code ? "var(--accent)" : "var(--border)"}` }}>
                  <input type="radio" name="reponse" checked={reponseAvis === c.code} onChange={() => setReponseAvis(c.code)} style={{ width: 20, height: 20, marginTop: 1, accentColor: "var(--accent)" }} />
                  <span>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{c.label}</span>
                    {c.detail && <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>{c.detail}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          <label style={etiquette}>Votre nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" style={champ} />
          <label style={etiquette}>Votre signature</label>
          <CaseSignature onChange={setSignature} />
          <label style={etiquette}>Message (facultatif)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} style={{ ...champ, resize: "vertical", fontFamily: "inherit" }} />
          {reglementRemisLe && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={reglementRecu} onChange={(e) => setReglementRecu(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--success)" }} />
              <span>J&apos;ai reçu le règlement de l&apos;immeuble (remis le {DATE.format(new Date(reglementRemisLe))}) avant de signer ce bail.</span>
            </label>
          )}
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--success)" }} />
            <span>J&apos;ai lu le document au complet et je consens à {avisMode ? "signer ma réponse" : "le signer"} électroniquement. Ma signature électronique a la même valeur que ma signature à la main.</span>
          </label>
          {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5, margin: "0 0 10px" }}>{erreur}</p>}
          <button onClick={() => envoyer("SIGNER")} disabled={enCours} style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: "var(--success)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            {enCours ? "Envoi…" : avisMode ? "Signer et transmettre ma réponse" : "Signer le document"}
          </button>
          {!avisMode && (refusOuvert ? (
            <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--danger)", borderRadius: 14 }}>
              <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>Refuser de signer ? Dites-nous pourquoi dans le message plus haut : le propriétaire pourra corriger le document.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => envoyer("REFUSER")} disabled={enCours} style={{ ...boutonSecondaire, flex: 1, borderColor: "var(--danger)", color: "var(--danger)" }}>Oui, refuser</button>
                <button onClick={() => setRefusOuvert(false)} disabled={enCours} style={{ ...boutonSecondaire, flex: 1 }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRefusOuvert(true)} style={{ ...boutonSecondaire, width: "100%", marginTop: 14, color: "var(--text-muted)" }}>Refuser de signer</button>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: "24px 0 0" }}>🔒 Ce lien vous est personnel : ne le partagez pas.</p>
    </div>
  );
}

function Bandeau({ couleur, titre, children }) {
  return (
    <div role="status" style={{ border: `1px solid ${couleur}`, borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, background: "var(--surface)" }}>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: couleur }}>{titre}</div>
      <div style={{ fontSize: 13.5, marginTop: 3 }}>{children}</div>
    </div>
  );
}

const lien = { fontSize: 13.5, fontWeight: 700, color: "var(--accent-ombre)" };
const etiquette = { display: "block", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 };
const champ = {
  width: "100%", padding: "12px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
  color: "var(--text)", fontSize: 16, marginBottom: 12, boxSizing: "border-box",
};
const boutonSecondaire = {
  padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
