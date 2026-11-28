"use client";

// En-tête illustré d'un tableau de bord (Immobilier, Copropriété) : le ciel
// du moment au Québec, la salutation, une phrase sur le mois, une jauge, des
// puces de chiffres, et la rue des immeubles (RueIllustree.js) — chaque
// immeuble mène à sa fiche. Puis le conseil du mois (ConseilDuMois).

import Link from "next/link";
import { RueIllustree, CielIllustre, VOILES } from "./RueIllustree";

export const majuscule = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

const puce = { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", whiteSpace: "nowrap" };

// visuel : { moment, saison, salutation, prenom } ; badge : « 🏘️ IMMOBILIER » ;
// jauge : { valeur (0 à 1), tout, libelle } ou null ; puces : [texte…] ;
// immeubles, infos, hrefDe : la rue ; plus : lien au-delà de 6 immeubles ;
// scene : autre dessin à la place de la rue (ex. la ferme, FermeIllustree.js)
export default function HeroRue({ visuel, badge, phrase, jauge, puces = [], immeubles = [], infos, hrefDe, plus, scene }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", borderRadius: 20, marginBottom: 8, border: "1px solid var(--border)", boxShadow: "0 12px 30px rgba(40, 20, 90, 0.18)" }}>
      <CielIllustre moment={visuel.moment} saison={visuel.saison} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: VOILES[visuel.moment] || VOILES.jour }} />
      <div style={{ position: "relative", padding: "18px 20px 6px", color: "#fff", textShadow: "0 1px 10px rgba(10,5,30,0.35)" }}>
        <span style={{ ...puce, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textShadow: "none" }}>{badge}</span>
        <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: "10px 0 4px", color: "#fff" }}>{visuel.salutation}{visuel.prenom ? ` ${visuel.prenom}` : ""}</h1>
        <p style={{ margin: 0, fontSize: 14.5, maxWidth: 520, color: "rgba(255,255,255,0.95)" }}>{phrase}</p>
        {jauge && (
          <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(jauge.valeur * 100)} aria-label={jauge.libelle} style={{ width: "min(100%, 380px)", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.22)", marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(jauge.valeur * 100)}%`, borderRadius: 999, background: jauge.tout ? "linear-gradient(90deg, #7ee2a0, #3fc47a)" : "linear-gradient(90deg, #ffd36b, #ff9a5a)" }} />
          </div>
        )}
        {puces.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, fontSize: 12.5, fontWeight: 600, textShadow: "none" }}>
            {puces.map((p) => <span key={p} style={puce}>{p}</span>)}
          </div>
        )}
      </div>
      <div style={{ position: "relative", marginTop: 4 }}>
        {scene || <RueIllustree immeubles={immeubles} infos={infos} moment={visuel.moment} saison={visuel.saison} hrefDe={hrefDe} />}
      </div>
      {plus && immeubles.length > 6 && (
        <Link href={plus} style={{ position: "absolute", right: 12, bottom: 10, fontSize: 12, fontWeight: 800, color: "#fff", background: "rgba(16,10,44,0.55)", padding: "4px 10px", borderRadius: 999, textDecoration: "none" }}>
          + {immeubles.length - 6} autre{immeubles.length - 6 > 1 ? "s" : ""}
        </Link>
      )}
    </section>
  );
}

// Rappel du calendrier du mois (propriétaire, syndicat) ; etiquette :
// « En novembre, chez les proprios » ; couleur : celle du module
export function ConseilDuMois({ conseil, etiquette, couleur = "var(--immo)", fond = "var(--immo-fond)" }) {
  if (!conseil) return null;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 16, marginBottom: 16, background: `linear-gradient(120deg, ${fond}, rgba(240,150,90,0.12))`, border: "1px solid var(--border)" }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, background: `linear-gradient(135deg, ${couleur}, #ec8a5c)`, boxShadow: "0 3px 8px rgba(40,40,100,0.25)" }}>💡</span>
      <div style={{ minWidth: 0, fontSize: 13.5 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: couleur }}>{etiquette}</div>
        <div style={{ marginTop: 2 }}>
          {conseil.texte}
          {conseil.href && <> <Link href={conseil.href} style={{ fontWeight: 700, color: "var(--accent)" }}>{conseil.lien} →</Link></>}
        </div>
      </div>
    </div>
  );
}
