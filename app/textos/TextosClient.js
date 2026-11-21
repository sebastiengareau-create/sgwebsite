"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { numeroLisible, numeroE164, segmentsTexto } from "@/lib/textos";
import { Pastille } from "../components/StyleSection";
import { LIBELLES_TYPES, STATUTS_TEXTO } from "../gerant/parametres/TextosSection";

const FUSEAU = "America/Toronto";
const HEURE = new Intl.DateTimeFormat("fr-CA", { hour: "numeric", minute: "2-digit", timeZone: FUSEAU });
const JOUR = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: FUSEAU });
const JOUR_CLE = new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: FUSEAU });
const JOUR_LONG = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: FUSEAU });

// « 14 h 05 » aujourd'hui, sinon « 12 nov. »
function quand(iso) {
  const d = new Date(iso);
  return JOUR_CLE.format(d) === JOUR_CLE.format(new Date()) ? HEURE.format(d) : JOUR.format(d);
}
const lien = (numero, recherche) => `/textos?${new URLSearchParams({ ...(numero && { numero }), ...(recherche && { q: recherche }) })}`;
const bouton = { padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 };
const boutonSecondaire = { ...bouton, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: "pointer" };

export default function TextosClient({ conversations, fil, recherche }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState(false);

  // Nouvelles réponses : la page se met à jour toute seule, à l'écran seulement
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => clearInterval(minuterie);
  }, [router]);

  return (
    <div className="textos-grille" data-ouverte={fil || nouveau ? "1" : "0"}>
      <div className="textos-liste" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <form action="/textos" style={{ display: "flex", gap: 6 }}>
          <input name="q" defaultValue={recherche} placeholder="Client ou numéro" aria-label="Chercher une conversation" className="champ" style={{ flex: 1, minWidth: 0, fontSize: 14 }} />
          <button type="submit" style={boutonSecondaire}>Chercher</button>
        </form>
        <button type="button" onClick={() => { setNouveau(true); if (fil) router.push(lien(null, recherche)); }} className="bouton-3d" style={bouton}>
          + Nouveau texto
        </button>
        {conversations.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0" }}>{recherche ? "Aucune conversation trouvée." : "Aucun texto pour l'instant."}</p>
        ) : (
          conversations.map((c) => {
            const ouverte = fil?.numero === c.telephone;
            return (
              <Link
                key={c.telephone} href={lien(c.telephone, recherche)} onClick={() => setNouveau(false)}
                aria-current={ouverte ? "true" : undefined}
                style={{
                  display: "block", padding: "10px 12px", borderRadius: 12, textDecoration: "none", color: "var(--text)",
                  border: `1px solid ${ouverte ? "var(--text)" : "var(--border)"}`, background: ouverte ? "var(--surface-alt)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: c.nonLus ? 800 : 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.clientNom || numeroLisible(c.telephone)}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>{quand(c.dernier.creeLe)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: c.nonLus ? "var(--text)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.dernier.direction === "SORTANT" ? "Vous : " : ""}{c.dernier.corps}
                  </span>
                  {c.nonLus > 0 && (
                    <span aria-label={`${c.nonLus} non lu${c.nonLus > 1 ? "s" : ""}`} style={{ minWidth: 20, height: 20, borderRadius: 10, background: "var(--accent)", color: "#221f18", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                      {c.nonLus}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="textos-fil" style={{ minWidth: 0 }}>
        {nouveau && !fil ? (
          <NouveauTexto recherche={recherche} onAnnuler={() => setNouveau(false)} />
        ) : fil ? (
          <Conversation key={fil.numero} fil={fil} recherche={recherche} />
        ) : (
          <div style={{ padding: 24, border: "1px dashed var(--border)", borderRadius: 14, fontSize: 13.5, color: "var(--text-muted)", textAlign: "center" }}>
            Choisis une conversation, ou écris un nouveau texto.
          </div>
        )}
      </div>
    </div>
  );
}

function Conversation({ fil, recherche }) {
  const router = useRouter();
  const [corps, setCorps] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const finRef = useRef(null);
  const nonLus = fil.textos.some((t) => t.direction === "ENTRANT" && !t.lu);

  // Ouverte : les réponses sont lues (le compteur du menu se met à jour)
  useEffect(() => {
    if (!nonLus) return;
    fetch("/api/textos/lus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telephone: fil.numero }) })
      .then((r) => r.ok && router.refresh())
      .catch(() => {});
  }, [fil.numero, nonLus, router]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "nearest" });
  }, [fil.textos.length]);

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const res = await fetch("/api/textos/envoyer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telephone: fil.numero, corps, type: "MESSAGE", clientId: fil.client?.id }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnvoi(false);
    if (!res?.ok) {
      setErreur(data?.erreur || "Le texto n'a pas pu être envoyé.");
      return;
    }
    setCorps("");
    router.refresh();
  }

  let jourPrecedent = null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
        <Link href={lien(null, recherche)} className="textos-retour" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>← Conversations</Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{fil.client?.nom || numeroLisible(fil.numero)}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            <a href={`tel:${fil.numero}`} style={{ color: "inherit" }}>{numeroLisible(fil.numero)}</a>
            {fil.client && <> · <Link href={`/secretaire/clients/${fil.client.id}`} style={{ color: "inherit" }}>Dossier du client</Link></>}
          </div>
        </div>
      </div>

      <div role="log" aria-label="Textos de la conversation" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto", padding: "2px 2px 4px" }}>
        {fil.textos.map((t) => {
          const sortant = t.direction === "SORTANT";
          const jour = JOUR_CLE.format(new Date(t.creeLe));
          const separateur = jour !== jourPrecedent;
          jourPrecedent = jour;
          const statut = sortant && t.statut !== "ENVOYE" ? STATUTS_TEXTO[t.statut] : null;
          return (
            <div key={t.id} style={{ display: "contents" }}>
              {separateur && <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-muted)", margin: "6px 0 2px" }}>{JOUR_LONG.format(new Date(t.creeLe))}</div>}
              <div style={{ alignSelf: sortant ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{
                  padding: "8px 11px", borderRadius: 14, fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                  background: sortant ? "var(--accent)" : "var(--surface-alt)", color: sortant ? "#221f18" : "var(--text)",
                  borderBottomRightRadius: sortant ? 4 : 14, borderBottomLeftRadius: sortant ? 14 : 4,
                }}>
                  {t.corps}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: sortant ? "flex-end" : "flex-start", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  <span>{HEURE.format(new Date(t.creeLe))}</span>
                  {sortant && <span>· {t.employeNom || "automatique"}</span>}
                  {sortant && t.type !== "MESSAGE" && <span>· {LIBELLES_TYPES[t.type] || t.type}</span>}
                  {t.bonId && fil.bons[t.bonId] && <Link href={`/bons/${t.bonId}`} style={{ color: "inherit" }}>· bon {fil.bons[t.bonId]}</Link>}
                  {statut && <Pastille couleur={statut.couleur} fond={statut.fond}>{statut.libelle}</Pastille>}
                </div>
                {t.erreur && <div style={{ fontSize: 11.5, color: "var(--danger)", textAlign: sortant ? "right" : "left" }}>{t.erreur}</div>}
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {fil.refuse ? (
        <p role="status" style={{ fontSize: 13, margin: 0, padding: "8px 10px", borderRadius: 10, background: "var(--surface-alt)", color: "var(--text-muted)" }}>
          Ce client a répondu ARRET : il ne reçoit plus nos textos. Il peut répondre RETOUR pour les recevoir de nouveau.
        </p>
      ) : (
        <form onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={corps} onChange={(e) => setCorps(e.target.value)} rows={3} maxLength={900} placeholder="Écrire un texto…" aria-label="Texto à envoyer"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && corps.trim()) e.currentTarget.form.requestSubmit(); }}
            className="champ" style={{ width: "100%", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>
              {corps.trim() ? `Compté comme ${segmentsTexto(corps)} texto${segmentsTexto(corps) > 1 ? "s" : ""}.` : "Le texto part du numéro de l'atelier."}
            </span>
            <button type="submit" disabled={envoi || !corps.trim()} className="bouton-3d" style={bouton}>{envoi ? "Envoi…" : "Envoyer"}</button>
          </div>
          {erreur && <p role="alert" style={{ fontSize: 12.5, color: "var(--danger)", margin: 0 }}>{erreur}</p>}
        </form>
      )}
    </div>
  );
}

function NouveauTexto({ recherche, onAnnuler }) {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [corps, setCorps] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const valide = !!numeroE164(numero);

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const res = await fetch("/api/textos/envoyer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telephone: numero, corps, type: "MESSAGE" }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnvoi(false);
    if (!res?.ok) {
      setErreur(data?.erreur || "Le texto n'a pas pu être envoyé.");
      return;
    }
    onAnnuler();
    router.push(lien(data.texto.telephone, recherche));
  }

  return (
    <form onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={onAnnuler} className="textos-retour" style={{ fontSize: 13, color: "var(--text-muted)", border: "none", background: "none", padding: 0, cursor: "pointer" }}>← Conversations</button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Nouveau texto</div>
      </div>
      <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Numéro du client
        <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" placeholder="514 555-1234" className="champ" style={{ display: "block", width: "100%", fontSize: 14, marginTop: 4, boxSizing: "border-box" }} />
      </label>
      <label style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Texto
        <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={4} maxLength={900} className="champ" style={{ display: "block", width: "100%", fontSize: 14, marginTop: 4, resize: "vertical", boxSizing: "border-box" }} />
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-muted)" }}>
          {numero && !valide ? "Numéro à 10 chiffres (ou avec l'indicatif +)." : corps.trim() ? `Compté comme ${segmentsTexto(corps)} texto${segmentsTexto(corps) > 1 ? "s" : ""}.` : ""}
        </span>
        <button type="button" onClick={onAnnuler} style={boutonSecondaire}>Annuler</button>
        <button type="submit" disabled={envoi || !valide || !corps.trim()} className="bouton-3d" style={bouton}>{envoi ? "Envoi…" : "Envoyer"}</button>
      </div>
      {erreur && <p role="alert" style={{ fontSize: 12.5, color: "var(--danger)", margin: 0 }}>{erreur}</p>}
    </form>
  );
}
