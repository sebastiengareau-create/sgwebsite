"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../components/StyleSection";
import { coutantKit, kitsDisponibles } from "@/lib/kits";
import FormulaireKit from "../FormulaireKit";
import { argent, nombre } from "@/lib/format";

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

  const manque = possibles === 0 && kit.actif;
  const couleurProfil = !kit.actif ? "var(--text-muted)" : manque ? "var(--danger)" : "var(--success)";
  const nbPieces = kit.composantsKit.filter((c) => c.pieceId).length;
  const nbMainOeuvre = kit.composantsKit.length - nbPieces;

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>

      {/* Carte du kit */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleurProfil }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleurProfil, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: manque ? "var(--danger-fond)" : TEINTES.vert.fond, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom="outils" taille={28} couleur={manque ? "var(--danger)" : TEINTES.vert.couleur} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>{kit.nom}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{kit.numero}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>Kit · {nomCategorie}</Pastille>
              {!kit.actif && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Désactivé</Pastille>}
              {manque && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Pas assez de pièces en stock</Pastille>}
            </div>
          </div>
        </div>
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
          <div className="grille-trois" style={{ marginBottom: 24 }}>
            <CarteChiffre
              titre="Kits possibles" montant={possibles === null ? "—" : nombre(possibles, 0)}
              couleur={manque ? "var(--danger)" : "var(--text)"} teinte={manque ? "var(--danger)" : "var(--bleu)"}
              note={possibles === null ? "Aucune pièce dans le kit" : "Avec le stock actuel"}
            />
            <CarteChiffre titre="Prix de vente" montant={argent(kit.prix)} teinte="var(--accent)" note={`Coûtant ${argent(cout.total)}`} />
            <CarteChiffre
              titre="Marge par kit" montant={argent(marge)} teinte={marge >= 0 ? "var(--success)" : "var(--danger)"}
              couleur={marge >= 0 ? "var(--success)" : "var(--danger)"}
              note={kit.prix > 0 ? `${nombre((marge / kit.prix) * 100, 0)} % du prix de vente` : "Aucun prix de vente"}
            />
          </div>

          <div style={stylePanneau}>
            <TitrePanneau
              icone="liste" teinte={TEINTES.vert} titre="Contenu du kit"
              sousTitre={`${nbPieces} pièce${nbPieces !== 1 ? "s" : ""}${nbMainOeuvre > 0 ? ` · ${nbMainOeuvre} ligne${nbMainOeuvre !== 1 ? "s" : ""} de main-d'œuvre` : ""}`}
            />
            {kit.composantsKit.map((c, i) => {
              const ligne = { display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text)", textDecoration: "none" };
              if (c.pieceId) {
                const enManque = c.piece.qte < c.qte;
                return (
                  <Link key={c.id} href={`/secretaire/inventaire/${c.pieceId}`} style={ligne}>
                    <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: enManque ? "var(--danger-fond)" : TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icone nom="boite" taille={18} couleur={enManque ? "var(--danger)" : TEINTES.ambre.couleur} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.piece.nom} <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>×{c.qte}</span></div>
                      <div style={{ fontSize: 12, color: enManque ? "var(--danger)" : "var(--text-muted)" }}>
                        {c.piece.numero} · {c.piece.qte} en stock{!c.piece.actif ? " · désactivée" : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(c.qte * c.piece.coutant)}</span>
                    <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
                  </Link>
                );
              }
              return (
                <div key={c.id} style={ligne}>
                  <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icone nom="horloge" taille={18} couleur={TEINTES.bleu.couleur} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.description || "Main-d'œuvre"}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{String(c.qte).replace(".", ",")} h × {argent(c.coutHoraire || 0)}/h</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginRight: 22 }}>{argent(c.qte * (c.coutHoraire || 0))}</span>
                </div>
              );
            })}
          </div>

          <div style={stylePanneau}>
            <TitrePanneau icone="etiquette" teinte={TEINTES.ambre} titre="Prix et marge" />
            <LigneDetail label="Coûtant des pièces" valeur={argent(cout.pieces)} premiere />
            <LigneDetail label="Coûtant de la main-d'œuvre" valeur={argent(cout.mainOeuvre)} />
            <LigneDetail label="Coûtant total" valeur={argent(cout.total)} />
            <LigneDetail label="Prix de vente" valeur={argent(kit.prix)} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: marge >= 0 ? "var(--success-fond)" : "var(--danger-fond)", marginTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: marge >= 0 ? "var(--success)" : "var(--danger)" }}>Marge par kit</span>
              <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: marge >= 0 ? "var(--success)" : "var(--danger)" }}>
                {argent(marge)}{kit.prix > 0 ? ` · ${nombre((marge / kit.prix) * 100, 0)} %` : ""}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
              Coûtant des pièces au coût moyen actuel. Sur un bon, la main-d'œuvre est comprise dans le prix du kit : les heures poinçonnées sur la tâche ne sont pas facturées en plus.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
            <BoutonAction icone="crayon" onClick={() => setModeEdition(true)}>Modifier</BoutonAction>
            <BoutonAction icone={kit.actif ? "bloque" : "crochet"} couleur={kit.actif ? "var(--avertissement)" : "var(--success)"} onClick={basculerActif} disabled={enCours}>
              {kit.actif ? "Désactiver" : "Réactiver"}
            </BoutonAction>
            <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer} disabled={enCours}>Supprimer</BoutonAction>
          </div>
        </>
      )}

      <div style={stylePanneau}>
        <TitrePanneau icone="presse" teinte={TEINTES.ambre} titre="Ventes" sousTitre="Ajouts du kit sur des bons de travail" />
        {kit.utilisee.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Ce kit n'a pas encore été ajouté à un bon.</p>
        ) : (
          kit.utilisee.map((u, i) => (
            <Link key={u.id} href={`/bons/${u.probleme.bon.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Bon #{u.probleme.bon.numero}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.probleme.bon.client.nom}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
                {u.qte} × {argent(u.prix)} <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
              </span>
            </Link>
          ))
        )}
      </div>

      {kit.historique.length > 0 && (
        <div style={stylePanneau}>
          <TitrePanneau icone="horloge" teinte={TEINTES.neutre} titre="Historique" sousTitre="Modifications de la fiche" />
          {kit.historique.map((h, i) => (
            <div key={h.id} style={{ padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ fontSize: 13.5 }}>
                <strong>{h.champ}</strong> : {h.ancienneValeur && <><span style={{ color: "var(--text-muted)" }}>{h.ancienneValeur}</span> → </>}<strong>{h.nouvelleValeur || "—"}</strong>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {new Date(h.modifieLe).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short", timeZone: "America/Toronto" })}{h.modifiePar ? ` · ${h.modifiePar}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
