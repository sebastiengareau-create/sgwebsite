"use client";

import { useState } from "react";
import { lienTexto, numeroTexto, numeroLisible, numeroE164, segmentsTexto, MENTION_ARRET, TYPES_AVEC_MENTION } from "@/lib/textos";
import { useTextos } from "./ContexteTextos";

// « 💬 Texto » au client, avec un message déjà écrit (lib/textos.js).
//  - Sans le module Textos automatiques : ouvre l'appli Messages avec le
//    numéro et le message — le texto part du téléphone, sans abonnement. Le
//    message est aussi copié : sur un ordinateur sans appli Messages, il
//    reste à le coller.
//  - Avec le module et l'envoi direct (lib/textosAuto.js) : le message
//    s'affiche, modifiable, et part du numéro de l'atelier par Twilio.
// message : le texte, ou une fonction (async) qui le prépare au clic
// (ex. le lien d'une soumission, créé au besoin).
// type, clientId, bonId, rendezVousId : rangent le texto au journal et dans
// la conversation du client (envoi direct seulement).
export default function BoutonTexto({ telephone, message, libelle = "💬 Texto", title, style, className, type = "LIEN", clientId, bonId, rendezVousId, onEnvoye }) {
  const { direct } = useTextos();
  const [etat, setEtat] = useState(null); // null | "prepa" | { texte, erreur }
  const [brouillon, setBrouillon] = useState(null); // envoi direct : texte à envoyer
  const [envoi, setEnvoi] = useState(false);

  if (!numeroTexto(telephone)) return null;
  const parTwilio = direct && !!numeroE164(telephone);

  async function preparer() {
    setEtat("prepa");
    try {
      return typeof message === "function" ? await message() : message;
    } catch (e) {
      setEtat({ texte: e.message || "Le message n'a pas pu être préparé.", erreur: true });
      return null;
    }
  }

  async function ouvrirMessages(texteDeja) {
    const texte = texteDeja ?? (await preparer());
    if (texte == null) return;
    setBrouillon(null);
    const copie = await navigator.clipboard?.writeText(texte).then(() => true).catch(() => false);
    window.location.href = lienTexto(telephone, texte, navigator.userAgent);
    setEtat({ texte: copie ? "Messages s'ouvre avec le texto prêt. Rien ne s'ouvre ? Le message est copié : colle-le dans un texto." : "Messages s'ouvre avec le texto prêt." });
  }

  async function cliquer() {
    if (!parTwilio) return ouvrirMessages();
    const texte = await preparer();
    if (texte == null) return;
    setEtat(null);
    setBrouillon(texte);
  }

  async function envoyer() {
    setEnvoi(true);
    setEtat(null);
    const res = await fetch("/api/textos/envoyer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telephone, corps: brouillon, type, clientId, bonId, rendezVousId }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnvoi(false);
    if (!res?.ok) {
      setEtat({ texte: data?.erreur || "Le texto n'a pas pu être envoyé.", erreur: true });
      return;
    }
    setBrouillon(null);
    setEtat({ texte: `Texto envoyé au ${numeroLisible(data.texto.telephone)} ✓` });
    onEnvoye?.(data.texto);
  }

  const avecMention = TYPES_AVEC_MENTION.includes(type);
  const segments = brouillon != null ? segmentsTexto(avecMention ? `${brouillon}\n${MENTION_ARRET}` : brouillon) : 0;

  return (
    <>
      <button
        type="button" onClick={cliquer} disabled={etat === "prepa" || envoi}
        title={title || (parTwilio ? `Texto à ${telephone}, envoyé depuis l'appli` : `Texto à ${telephone} — ouvre Messages avec le message déjà écrit`)}
        className={className} style={style}
      >
        {etat === "prepa" ? "…" : libelle}
      </button>
      {brouillon != null && (
        <div style={{ flexBasis: "100%", width: "100%", display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", textAlign: "left" }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Texto à {numeroLisible(numeroE164(telephone))}, du numéro de l&apos;atelier
            <textarea
              value={brouillon} onChange={(e) => setBrouillon(e.target.value)} rows={4} maxLength={900}
              className="champ" style={{ display: "block", width: "100%", fontSize: 14, marginTop: 4, resize: "vertical", boxSizing: "border-box" }}
            />
          </label>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {avecMention ? `« ${MENTION_ARRET} » est ajouté sur une ligne à la fin. ` : ""}
            {segments > 1 ? `Compté comme ${segments} textos.` : "Compté comme 1 texto."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={envoyer} disabled={envoi || !brouillon.trim()} className="bouton-3d" style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              {envoi ? "Envoi…" : "Envoyer le texto"}
            </button>
            <button type="button" onClick={() => { setBrouillon(null); setEtat(null); }} disabled={envoi} style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: "pointer" }}>
              Annuler
            </button>
            <button type="button" onClick={() => ouvrirMessages(brouillon)} disabled={envoi} style={{ fontSize: 12, border: "none", background: "none", color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
              Ouvrir plutôt Messages
            </button>
          </div>
        </div>
      )}
      {etat && etat !== "prepa" && (
        <span role={etat.erreur ? "alert" : "status"} style={{ flexBasis: "100%", fontSize: 11.5, color: etat.erreur ? "var(--danger)" : "var(--text-muted)" }}>{etat.texte}</span>
      )}
    </>
  );
}
