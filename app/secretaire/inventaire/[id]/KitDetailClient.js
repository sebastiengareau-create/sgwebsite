"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TitreSection } from "../../../components/ui";
import { coutantKit, kitsDisponibles } from "@/lib/kits";
import FormulaireKit from "../FormulaireKit";

// Fiche d'un kit (lib/kits.js) : son contenu, son coûtant et sa marge, ce
// que le stock permet d'en faire, et ses ventes sur les bons.
export default function KitDetailClient({ kit, pieces, categories, coutHoraireDefaut }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const cout = coutantKit(kit.composantsKit);
  const possibles = kitsDisponibles(kit.composantsKit);
  const marge = kit.prix - cout.total;
  const nomCategorie = categories.find((c) => c.code === kit.categorie)?.nom || kit.categorie;

  async function basculerActif() {
    const message = kit.actif
      ? `Désactiver le kit « ${kit.nom} » ? Il n'apparaîtra plus dans les choix des bons ; son historique est conservé.`
      : `Réactiver le kit « ${kit.nom} » ?`;
    if (!window.confirm(message)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${kit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !kit.actif }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le kit « ${kit.nom} » ? Ses pièces restent dans l'inventaire.`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${kit.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/inventaire");
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>

      <div style={{ background: "var(--surface)", border: possibles === 0 && kit.actif ? "1px solid var(--danger)" : "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 10, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>🧰 {kit.nom}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{kit.numero}</div>
        <span className="bouton-3d" style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Kit · {nomCategorie}</span>
        {!kit.actif && (
          <span style={{ display: "inline-block", marginTop: 8, marginLeft: 6, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "1px solid var(--border)", color: "var(--text-muted)" }}>Désactivé</span>
        )}
        {possibles !== null && (
          <div style={{ fontSize: 12, marginTop: 8, fontWeight: 700, color: possibles === 0 ? "var(--danger)" : "var(--text-muted)" }}>
            {possibles === 0 ? "⚠ Pas assez de pièces en stock pour faire ce kit" : `Le stock permet d'en faire ${possibles}`}
          </div>
        )}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <FormulaireKit
          kit={kit}
          pieces={pieces}
          categories={categories}
          coutHoraireDefaut={coutHoraireDefaut}
          onEnregistre={() => { setModeEdition(false); router.refresh(); }}
          onAnnuler={() => setModeEdition(false)}
        />
      ) : (
        <>
          <div className="carte" style={{ marginBottom: 12 }}>
            <TitreSection>Contenu du kit</TitreSection>
            {kit.composantsKit.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 6 }}>
                {c.pieceId ? (
                  <>
                    <span>
                      <Link href={`/secretaire/inventaire/${c.pieceId}`} style={{ color: "var(--text)" }}>{c.piece.nom}</Link> ×{c.qte}
                      <span style={{ display: "block", fontSize: 11, color: c.piece.qte < c.qte ? "var(--danger)" : "var(--text-muted)" }}>
                        {c.piece.numero} · {c.piece.qte} en stock{!c.piece.actif ? " · désactivée" : ""}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700 }}>{(c.qte * c.piece.coutant).toFixed(2)} $</span>
                  </>
                ) : (
                  <>
                    <span>
                      {c.description || "Main-d'œuvre"}
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{String(c.qte).replace(".", ",")} h × {(c.coutHoraire || 0).toFixed(2)} $/h</span>
                    </span>
                    <span style={{ fontWeight: 700 }}>{(c.qte * (c.coutHoraire || 0)).toFixed(2)} $</span>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="carte" style={{ marginBottom: 12 }}>
            <TitreSection>Prix et marge</TitreSection>
            <Champ label="Coûtant des pièces" valeur={`${cout.pieces.toFixed(2)} $`} />
            <Champ label="Coûtant de la main-d'œuvre" valeur={`${cout.mainOeuvre.toFixed(2)} $`} />
            <Champ label="Coûtant total" valeur={`${cout.total.toFixed(2)} $`} />
            <Champ label="Prix de vente" valeur={`${kit.prix.toFixed(2)} $`} />
            <div style={{ borderTop: "1px dashed var(--border)", marginTop: 6, paddingTop: 6 }}>
              <Champ label="Marge par kit" valeur={`${marge.toFixed(2)} $${kit.prix > 0 ? ` (${((marge / kit.prix) * 100).toFixed(0)} %)` : ""}`} accent />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
              Coûtant des pièces au coût moyen actuel. Sur un bon, la main-d'œuvre est comprise dans le prix du kit : les heures poinçonnées sur la tâche ne sont pas facturées en plus.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setModeEdition(true)} className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 12.5 }}>✏️ Modifier</button>
            <button onClick={basculerActif} disabled={enCours} className="bouton-3d-sombre" style={{ flex: 1, padding: 10, borderRadius: 8, fontWeight: 700, fontSize: 12.5 }}>
              {kit.actif ? "Désactiver" : "Réactiver"}
            </button>
            <button onClick={supprimer} disabled={enCours} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--danger)", background: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12.5 }}>
              Supprimer
            </button>
          </div>
        </>
      )}

      <div className="carte" style={{ marginBottom: 12 }}>
        <TitreSection>Ventes sur des bons de travail</TitreSection>
        {kit.utilisee.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Ce kit n'a pas encore été ajouté à un bon.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {kit.utilisee.map((u) => (
              <Link key={u.id} href={`/bons/${u.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                  <span style={{ color: "var(--text-muted)" }}>#{u.probleme.bon.numero} — {u.probleme.bon.client.nom}</span>
                  <span>{u.qte} × {u.prix.toFixed(2)} $</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {kit.historique.length > 0 && (
        <div className="carte">
          <TitreSection>Historique</TitreSection>
          {kit.historique.map((h) => (
            <div key={h.id} style={{ fontSize: 12, borderBottom: "1px solid var(--border)", padding: "4px 0" }}>
              <strong>{h.champ}</strong>{h.ancienneValeur ? ` : ${h.ancienneValeur} → ` : " : "}{h.nouvelleValeur || "—"}
              <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                {new Date(h.modifieLe).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}{h.modifiePar ? ` · ${h.modifiePar}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Champ({ label, valeur, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>{valeur}</span>
    </div>
  );
}
