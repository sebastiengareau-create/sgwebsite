"use client";

import { useState } from "react";
import { lienTexto, numeroTexto } from "@/lib/textos";

// « 💬 Texto » : ouvre l'appli Messages avec le numéro du client et un
// message déjà écrit (lib/textos.js) — sans abonnement, le texto part du
// téléphone. Le message est aussi copié : sur un ordinateur sans appli
// Messages, il reste à le coller.
// message : le texte, ou une fonction (async) qui le prépare au clic
// (ex. le lien d'une soumission, créé au besoin).
export default function BoutonTexto({ telephone, message, libelle = "💬 Texto", title, style, className }) {
  const [etat, setEtat] = useState(null); // null | "prepa" | { texte, erreur }

  if (!numeroTexto(telephone)) return null;

  async function ouvrir() {
    setEtat("prepa");
    let texte;
    try {
      texte = typeof message === "function" ? await message() : message;
    } catch (e) {
      setEtat({ texte: e.message || "Le message n'a pas pu être préparé.", erreur: true });
      return;
    }
    const copie = await navigator.clipboard?.writeText(texte).then(() => true).catch(() => false);
    window.location.href = lienTexto(telephone, texte, navigator.userAgent);
    setEtat({ texte: copie ? "Messages s'ouvre avec le texto prêt. Rien ne s'ouvre ? Le message est copié : colle-le dans un texto." : "Messages s'ouvre avec le texto prêt." });
  }

  return (
    <>
      <button
        type="button" onClick={ouvrir} disabled={etat === "prepa"}
        title={title || `Texto à ${telephone} — ouvre Messages avec le message déjà écrit`}
        className={className} style={style}
      >
        {etat === "prepa" ? "…" : libelle}
      </button>
      {etat && etat !== "prepa" && (
        <span role="status" style={{ flexBasis: "100%", fontSize: 11.5, color: etat.erreur ? "var(--danger)" : "var(--text-muted)" }}>{etat.texte}</span>
      )}
    </>
  );
}
