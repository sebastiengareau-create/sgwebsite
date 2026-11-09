"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, LigneDetail, stylePanneau } from "../../../components/StyleSection";
import ImpressionEtiquettes from "../../../components/ImpressionEtiquettes";
import ChampsPiece from "../ChampsPiece";
import { pieceCorrespond } from "@/lib/codesBarres";
import { argent, nombre } from "@/lib/format";

const ONGLETS = [
  { code: "resume", label: "Résumé" },
  { code: "mouvements", label: "Mouvements" },
  { code: "achats", label: "Achats" },
  { code: "ventes", label: "Ventes" },
  { code: "fournisseurs", label: "Fournisseurs" },
  { code: "historique", label: "Historique" },
];

const TYPE_MOUVEMENT = {
  RECEPTION: { label: "Réception", couleur: "var(--success)", fond: "var(--success-fond)" },
  VENTE: { label: "Vente", couleur: "var(--danger)", fond: "var(--danger-fond)" },
  AJUSTEMENT: { label: "Ajustement", couleur: "var(--text-muted)", fond: "var(--surface-alt)" },
  RETOUR: { label: "Retour client", couleur: "var(--success)", fond: "var(--success-fond)" },
};
const dateCourte = (d) => new Date(d).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" });

export default function PieceDetailClient({ piece, categories, fournisseurs, autresPieces }) {
  const router = useRouter();
  const [modeEdition, setModeEdition] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("resume");
  const [afficherEtiquettes, setAfficherEtiquettes] = useState(false);
  const [afficherFusion, setAfficherFusion] = useState(false);

  const [nom, setNom] = useState(piece.nom);
  const [numero, setNumero] = useState(piece.numero);
  const [codeBarre, setCodeBarre] = useState(piece.codeBarre || "");
  const [autresNumeros, setAutresNumeros] = useState(piece.autresNumeros.join(", "));
  const [qte, setQte] = useState(piece.qte);
  const [qteMin, setQteMin] = useState(piece.qteMin);
  const [qteMax, setQteMax] = useState(piece.qteMax ?? "");
  const [emplacement, setEmplacement] = useState(piece.emplacement || "");
  const [fournisseurId, setFournisseurId] = useState(piece.fournisseurId || "");
  const [prix, setPrix] = useState(piece.prix);
  const [coutant, setCoutant] = useState(piece.coutant || 0);
  const [categorie, setCategorie] = useState(piece.categorie || "PIECE");
  const SETTERS = {
    nom: setNom, numero: setNumero, autresNumeros: setAutresNumeros, codeBarre: setCodeBarre, qte: setQte, qteMin: setQteMin,
    qteMax: setQteMax, coutant: setCoutant, prix: setPrix, emplacement: setEmplacement, fournisseurId: setFournisseurId, categorie: setCategorie,
  };

  const marge = piece.prix - (piece.coutant || 0);
  const margePct = piece.prix > 0 ? (marge / piece.prix) * 100 : 0;
  const stockBas = piece.qte <= piece.qteMin;
  const nomCategorie = categories.find((c) => c.code === piece.categorie)?.nom || piece.categorie;

  async function sauvegarder() {
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom, numero, qte, qteMin, prix, coutant, categorie, codeBarre, autresNumeros,
        qteMax: qteMax === "" ? null : qteMax,
        emplacement: emplacement.trim() || null,
        fournisseurId: fournisseurId || null,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    const misAJour = await res.json().catch(() => ({}));
    if (misAJour.avertissementComptable) {
      window.alert(`Stock ajusté, mais aucune écriture comptable n'a été passée :\n${misAJour.avertissementComptable}`);
    }
    setModeEdition(false);
    router.refresh();
  }

  async function basculerActif() {
    const message = piece.actif
      ? `Désactiver "${piece.nom}" ? Elle n'apparaîtra plus dans les choix de pièces (bons, réceptions), mais son historique est conservé. Tu pourras la réactiver en tout temps.`
      : `Réactiver "${piece.nom}" ?`;
    if (!window.confirm(message)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !piece.actif }),
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
    if (!window.confirm(`Supprimer "${piece.nom}" de l'inventaire ?`)) return;
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.push("/secretaire/inventaire");
  }

  const couleurProfil = !piece.actif ? "var(--text-muted)" : stockBas ? "var(--danger)" : "var(--accent)";

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/inventaire" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à l'inventaire</Link>

      {/* Carte de la pièce */}
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: "20px 20px 20px 24px", marginTop: 10, marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: couleurProfil }} />
        <span style={{ position: "absolute", right: -40, top: -40, width: 150, height: 150, borderRadius: "50%", background: couleurProfil, opacity: 0.08 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: stockBas && piece.actif ? "var(--danger-fond)" : TEINTES.ambre.fond, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom="boite" taille={28} couleur={stockBas && piece.actif ? "var(--danger)" : TEINTES.ambre.couleur} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em" }}>{piece.nom}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2, overflowWrap: "anywhere" }}>
              {piece.numero}{piece.emplacement && <span style={{ fontFamily: "inherit" }}> · {piece.emplacement}</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>{nomCategorie}</Pastille>
              {!piece.actif && <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Désactivée</Pastille>}
              {stockBas && piece.actif && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Stock sous le minimum</Pastille>}
            </div>
          </div>
        </div>
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}

      {modeEdition ? (
        <div style={stylePanneau}>
          <TitrePanneau icone="crayon" titre="Modifier la pièce" />
          <ChampsPiece
            valeurs={{ nom, numero, autresNumeros, codeBarre, qte, qteMin, qteMax, coutant, prix, emplacement, fournisseurId, categorie }}
            onChange={(champ, valeur) => SETTERS[champ](valeur)}
            onErreur={setErreur} categories={categories} fournisseurs={fournisseurs}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={sauvegarder} disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setModeEdition(false)}>Annuler</BoutonAction>
          </div>
        </div>
      ) : (
        <>
          <div className="grille-trois" style={{ marginBottom: 20 }}>
            <CarteChiffre
              titre="En stock" montant={nombre(piece.qte, 0)}
              couleur={stockBas && piece.actif ? "var(--danger)" : "var(--text)"} teinte={stockBas && piece.actif ? "var(--danger)" : "var(--bleu)"}
              note={`Minimum ${piece.qteMin}${piece.qteMax != null ? ` · maximum ${piece.qteMax}` : ""}`}
            />
            <CarteChiffre titre="Prix de vente" montant={argent(piece.prix)} teinte="var(--accent)" note={`Coût moyen ${argent(piece.coutant || 0)}`} />
            <CarteChiffre
              titre="Marge par unité" montant={argent(marge)} teinte={marge >= 0 ? "var(--success)" : "var(--danger)"}
              couleur={marge >= 0 ? "var(--success)" : "var(--danger)"} note={`${nombre(margePct, 0)} % du prix de vente`}
            />
          </div>

          <div className="grille-onglets-6" style={{ padding: 4, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 14 }}>
            {ONGLETS.map((o) => (
              <button
                key={o.code}
                onClick={() => setOnglet(o.code)}
                style={{
                  padding: "9px 4px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  background: onglet === o.code ? "var(--accent)" : "transparent",
                  color: onglet === o.code ? "#221f18" : "var(--text-muted)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {onglet === "resume" && (
            <OngletResume piece={piece} marge={marge} margePct={margePct} />
          )}
          {onglet === "mouvements" && <OngletMouvements mouvements={piece.mouvements} />}
          {onglet === "achats" && <OngletAchats lignesDepense={piece.lignesDepense} />}
          {onglet === "ventes" && <OngletVentes utilisee={piece.utilisee} />}
          {onglet === "fournisseurs" && <OngletFournisseurs piece={piece} fournisseurs={fournisseurs} />}
          {onglet === "historique" && <OngletHistorique historique={piece.historique} />}

          {afficherFusion && <FusionPiece piece={piece} autresPieces={autresPieces} onFermer={() => setAfficherFusion(false)} />}

          {afficherEtiquettes && (
            <div style={{ marginBottom: 16 }}>
              <ImpressionEtiquettes pieces={[{ id: piece.id, qte: piece.qte }]} uneSeule onFermer={() => setAfficherEtiquettes(false)} />
            </div>
          )}

          <div className="grille-actions" style={{ marginBottom: 16 }}>
            <BoutonAction icone="crayon" onClick={() => setModeEdition(true)}>Modifier</BoutonAction>
            <BoutonAction icone="etiquette" onClick={() => setAfficherEtiquettes((v) => !v)}>Étiquette</BoutonAction>
            <BoutonAction icone="echange" onClick={() => setAfficherFusion((v) => !v)} disabled={enCours}>Fusionner</BoutonAction>
            <BoutonAction icone={piece.actif ? "bloque" : "crochet"} couleur={piece.actif ? "var(--avertissement)" : "var(--success)"} onClick={basculerActif} disabled={enCours}>
              {piece.actif ? "Désactiver" : "Réactiver"}
            </BoutonAction>
            <BoutonAction icone="poubelle" couleur="var(--danger)" onClick={supprimer} disabled={enCours}>Supprimer</BoutonAction>
          </div>
        </>
      )}
    </div>
  );
}

function OngletResume({ piece, marge, margePct }) {
  return (
    <>
      <div style={stylePanneau}>
        <TitrePanneau icone="boite" teinte={TEINTES.bleu} titre="Stock" />
        <LigneDetail label="Stock actuel" valeur={nombre(piece.qte, 0)} premiere />
        <LigneDetail label="Seuil minimum" valeur={nombre(piece.qteMin, 0)} />
        {piece.qteMax != null && <LigneDetail label="Seuil maximum" valeur={nombre(piece.qteMax, 0)} />}
        {piece.emplacement && <LigneDetail label="Emplacement" valeur={piece.emplacement} />}
        <LigneDetail label="Code-barres fabricant" valeur={piece.codeBarre || "Aucun"} />
        {piece.autresNumeros.length > 0 && <LigneDetail label="Autres numéros" valeur={piece.autresNumeros.join(", ")} />}
        {piece.lignesCommande.length > 0 && (
          <div style={{ marginTop: 8, padding: "4px 12px", borderRadius: 12, background: "rgba(232,163,61,0.16)" }}>
            {piece.lignesCommande.map((l, i) => (
              <Link key={l.id} href={`/secretaire/inventaire/commandes/${l.commande.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", color: "inherit", textDecoration: "none", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, minWidth: 0 }}>
                  <strong>{l.commande.statut === "BROUILLON" ? "Brouillon" : "En commande"}</strong>
                  <span style={{ color: "var(--text-muted)" }}> · {l.commande.numero} · {l.commande.fournisseur.nom}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--accent-ombre)", whiteSpace: "nowrap" }}>+{Math.max(0, l.qteCommandee - l.qteRecue)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="etiquette" teinte={TEINTES.ambre} titre="Prix et marge" />
        <LigneDetail label="Coût moyen" valeur={argent(piece.coutant || 0)} premiere />
        <LigneDetail label="Prix de vente" valeur={argent(piece.prix)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: marge >= 0 ? "var(--success-fond)" : "var(--danger-fond)", marginTop: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: marge >= 0 ? "var(--success)" : "var(--danger)" }}>Marge par unité</span>
          <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: marge >= 0 ? "var(--success)" : "var(--danger)" }}>{argent(marge)} · {nombre(margePct, 0)} %</span>
        </div>
      </div>

      {piece.dansKits.length > 0 && (
        <div style={stylePanneau}>
          <TitrePanneau icone="outils" teinte={TEINTES.vert} titre="Dans les kits" />
          {piece.dansKits.map((c, i) => (
            <Link key={c.kit.id} href={`/secretaire/inventaire/${c.kit.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{c.kit.nom}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>×{c.qte} par kit <Icone nom="chevron" taille={16} /></span>
            </Link>
          ))}
        </div>
      )}

      <div style={stylePanneau}>
        <TitrePanneau icone="immeuble" teinte={TEINTES.bleu} titre="Fournisseur" />
        <LigneDetail label="Fournisseur habituel" valeur={piece.fournisseur ? <Link href={`/gerant/fournisseurs/${piece.fournisseur.id}`} style={{ color: "inherit" }}>{piece.fournisseur.nom}</Link> : "Aucun"} premiere />
      </div>
    </>
  );
}

function Vide({ children }) {
  return <div style={{ ...stylePanneau, color: "var(--text-muted)", fontSize: 13.5, textAlign: "center" }}>{children}</div>;
}

function OngletMouvements({ mouvements }) {
  if (mouvements.length === 0) {
    return <Vide>Aucun mouvement de stock enregistré pour cet article pour l'instant.</Vide>;
  }
  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="echange" teinte={TEINTES.bleu} titre="Mouvements de stock" sousTitre={`Les ${mouvements.length} plus récents`} />
      {mouvements.map((m, i) => {
        const info = TYPE_MOUVEMENT[m.type] || { label: m.type, couleur: "var(--text-muted)", fond: "var(--surface-alt)" };
        return (
          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Pastille couleur={info.couleur} fond={info.fond}>{info.label}</Pastille>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{dateCourte(m.creeLe)}</span>
              </div>
              {m.note && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{m.note}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: m.qte >= 0 ? "var(--success)" : "var(--danger)" }}>
                {m.qte >= 0 ? "+" : "−"}{Math.abs(m.qte)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Solde : {m.solde}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OngletAchats({ lignesDepense }) {
  if (lignesDepense.length === 0) {
    return <Vide>Aucun achat lié à cet article — utilise l'option « Réception d'inventaire » en créant une dépense fournisseur pour en enregistrer.</Vide>;
  }
  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="panier" teinte={TEINTES.vert} titre="Achats" sousTitre="Réceptions liées à des factures fournisseur" />
      {lignesDepense.map((l, i) => {
        const payee = l.depense.statut === "PAYEE";
        return (
          <Link key={l.id} href={`/gerant/comptabilite/comptes-a-payer/${l.depense.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{l.depense.fournisseur.nom}</div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{dateCourte(l.depense.dateFacture)} · {l.depense.description}</span>
                <Pastille couleur={payee ? "var(--success)" : "var(--danger)"} fond={payee ? "var(--success-fond)" : "var(--danger-fond)"}>{payee ? "Payée" : "Impayée"}</Pastille>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--success)" }}>+{l.qteRecue}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{argent(l.montant / l.qteRecue)} / unité</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function OngletVentes({ utilisee }) {
  if (utilisee.length === 0) {
    return <Vide>Cette pièce n'a pas encore été utilisée sur un bon de travail.</Vide>;
  }
  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="outils" teinte={TEINTES.ambre} titre="Ventes" sousTitre="Utilisations sur des bons de travail" />
      {utilisee.map((u, i) => (
        <Link key={u.id} href={`/bons/${u.probleme.bon.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Bon #{u.probleme.bon.numero}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.probleme.bon.client.nom}</div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>
            {u.qte} × {argent(u.prix)} <Icone nom="chevron" taille={16} couleur="var(--text-muted)" />
          </span>
        </Link>
      ))}
    </div>
  );
}

// Les numéros et prix de cette pièce chez chaque fournisseur — une seule
// fiche pour tous ses numéros — et commande directe chez celui choisi.
function OngletFournisseurs({ piece, fournisseurs }) {
  const router = useRouter();
  const [ajout, setAjout] = useState(false);
  const [nouveauFournisseur, setNouveauFournisseur] = useState("");
  const [nouveauNumero, setNouveauNumero] = useState("");
  const [nouveauCout, setNouveauCout] = useState("");
  const [edition, setEdition] = useState(null); // { id, numero, cout }
  const [commande, setCommande] = useState(null); // { fournisseurId, qte }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  // Quantité déjà reçue de chaque fournisseur (réceptions sur dépenses)
  const recuParFournisseur = {};
  for (const l of piece.lignesDepense) recuParFournisseur[l.depense.fournisseurId] = (recuParFournisseur[l.depense.fournisseurId] || 0) + l.qteRecue;
  const liens = [...piece.fournisseurs].sort((a, b) => (a.coutant ?? Infinity) - (b.coutant ?? Infinity));
  const moinsCher = liens.find((l) => l.coutant != null);
  const fournisseursLibres = fournisseurs.filter((f) => !piece.fournisseurs.some((l) => l.fournisseurId === f.id));

  async function appel(url, methode, corps) {
    setErreur("");
    setEnCours(true);
    const res = await fetch(url, { method: methode, headers: { "Content-Type": "application/json" }, body: corps ? JSON.stringify(corps) : undefined });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setErreur(data.erreur || "Erreur.");
      return null;
    }
    return data;
  }

  async function ajouterLien(e) {
    e.preventDefault();
    if (!nouveauFournisseur) return;
    const ok = await appel("/api/pieces-fournisseurs", "POST", { pieceId: piece.id, fournisseurId: nouveauFournisseur, numeroFournisseur: nouveauNumero, coutant: nouveauCout });
    if (!ok) return;
    setAjout(false);
    setNouveauFournisseur(""); setNouveauNumero(""); setNouveauCout("");
    router.refresh();
  }

  async function enregistrerEdition() {
    const ok = await appel(`/api/pieces-fournisseurs/${edition.id}`, "PATCH", { numeroFournisseur: edition.numero, coutant: edition.cout });
    if (!ok) return;
    setEdition(null);
    router.refresh();
  }

  async function retirerLien(lien) {
    if (!window.confirm(`Retirer ${lien.fournisseur.nom} des fournisseurs de cette pièce ?`)) return;
    if (await appel(`/api/pieces-fournisseurs/${lien.id}`, "DELETE")) router.refresh();
  }

  async function commander() {
    const data = await appel("/api/commandes-fournisseurs", "POST", {
      fournisseurId: commande.fournisseurId,
      lignes: [{ pieceId: piece.id, qte: Math.max(1, parseInt(commande.qte) || 1) }],
      ajouterAuBrouillon: true,
    });
    if (data) router.push(`/secretaire/inventaire/commandes/${data.id}`);
  }

  return (
    <>
      <div style={stylePanneau}>
        <TitrePanneau
          icone="immeuble" teinte={TEINTES.bleu} titre="Numéros et prix par fournisseur"
          sousTitre="La même pièce peut avoir un numéro différent chez chaque fournisseur. Le dernier prix se met à jour à chaque réception ; la recherche et le scan trouvent la pièce par n'importe lequel de ces numéros."
        />
        {liens.map((l, i) => {
          const leMoinsCher = moinsCher && l.id === moinsCher.id && liens.length > 1;
          return (
            <div key={l.id} style={{ padding: "12px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              {edition?.id === l.id ? (
                <div style={boiteFormulaire}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{l.fournisseur.nom}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={edition.numero} onChange={(e) => setEdition({ ...edition, numero: e.target.value })} placeholder="No chez ce fournisseur" className="champ" style={{ flex: 2, marginBottom: 0 }} />
                    <input type="number" min={0} step="0.01" value={edition.cout} onChange={(e) => setEdition({ ...edition, cout: e.target.value })} placeholder="Prix $" className="champ" style={{ flex: 1, marginBottom: 0 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={enregistrerEdition} disabled={enCours} className="bouton-3d" style={{ padding: 10, borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>Enregistrer</button>
                    <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setEdition(null)}>Annuler</BoutonAction>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{l.fournisseur.nom}</span>
                        {piece.fournisseurId === l.fournisseurId && <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>Habituel</Pastille>}
                        {leMoinsCher && <Pastille couleur="var(--success)" fond="var(--success-fond)">Le moins cher</Pastille>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 3 }}>{l.numeroFournisseur ? `No ${l.numeroFournisseur}` : "No fournisseur non saisi"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {l.dernierAchat ? `Dernier achat : ${dateCourte(l.dernierAchat)}` : "Jamais acheté ici"}
                        {recuParFournisseur[l.fournisseurId] ? ` · ${recuParFournisseur[l.fournisseurId]} reçues au total` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: leMoinsCher ? "var(--success)" : "var(--text)" }}>
                      {l.coutant != null ? argent(l.coutant) : "—"}
                    </div>
                  </div>
                  {commande?.fournisseurId === l.fournisseurId ? (
                    <div style={{ ...boiteFormulaire, flexDirection: "row", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Qté</span>
                      <input type="number" min={1} value={commande.qte} onChange={(e) => setCommande({ ...commande, qte: e.target.value })} className="champ" style={{ width: 70, marginBottom: 0 }} />
                      <button onClick={commander} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Ajouter à la commande</button>
                      <button onClick={() => setCommande(null)} aria-label="Annuler" title="Annuler" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Icone nom="bloque" taille={16} couleur="var(--text-muted)" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                      <BoutonAction icone="panier" couleur="var(--accent-ombre)" compact onClick={() => setCommande({ fournisseurId: l.fournisseurId, qte: "1" })}>Commander</BoutonAction>
                      <BoutonAction icone="crayon" compact onClick={() => setEdition({ id: l.id, numero: l.numeroFournisseur || "", cout: l.coutant ?? "" })}>Modifier</BoutonAction>
                      <BoutonAction icone="poubelle" couleur="var(--danger)" compact onClick={() => retirerLien(l)}>Retirer</BoutonAction>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {liens.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun fournisseur lié pour l'instant.</p>}

        {ajout ? (
          <form onSubmit={ajouterLien} style={boiteFormulaire}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Ajouter un fournisseur</div>
            <select value={nouveauFournisseur} onChange={(e) => setNouveauFournisseur(e.target.value)} className="champ" style={{ marginBottom: 0 }} required>
              <option value="">Choisir le fournisseur…</option>
              {fournisseursLibres.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={nouveauNumero} onChange={(e) => setNouveauNumero(e.target.value)} placeholder="No chez ce fournisseur" className="champ" style={{ flex: 2, marginBottom: 0 }} />
              <input type="number" min={0} step="0.01" value={nouveauCout} onChange={(e) => setNouveauCout(e.target.value)} placeholder="Prix $" className="champ" style={{ flex: 1, marginBottom: 0 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="submit" disabled={enCours || !nouveauFournisseur} className="bouton-3d" style={{ padding: 10, borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>Lier ce fournisseur</button>
              <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setAjout(false)}>Annuler</BoutonAction>
            </div>
          </form>
        ) : (
          fournisseursLibres.length > 0 && (
            <button onClick={() => setAjout(true)} style={boutonPointille}>+ Ajouter un fournisseur</button>
          )
        )}
        {erreur && <p style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 700, margin: "8px 0 0" }}>{erreur}</p>}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="drapeau" teinte={TEINTES.ambre} titre="Fournisseur habituel" sousTitre="Proposé en premier quand la pièce passe sous le seuil minimum." />
        <LigneDetail label="Fournisseur par défaut" valeur={piece.fournisseur?.nom || "Aucun — configurable dans Modifier"} premiere />
      </div>
    </>
  );
}

// Fusion d'un doublon : cette fiche est versée dans une autre (stock,
// historique, numéros fournisseurs), puis supprimée.
function FusionPiece({ piece, autresPieces, onFermer }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const q = recherche.trim().toLowerCase();
  const suggestions = q ? autresPieces.filter((p) => pieceCorrespond(p, q)).slice(0, 8) : [];

  async function fusionner(cible) {
    if (!window.confirm(`Fusionner « ${piece.nom} » (${piece.numero}) dans « ${cible.nom} » (${cible.numero}) ?\n\nLe stock (${piece.qte}) s'ajoute à celui de « ${cible.nom} », tout l'historique et les numéros fournisseurs suivent, puis la fiche ${piece.numero} est supprimée. C'est irréversible.`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}/fusionner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cibleId: cible.id }) });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) return setErreur(data.erreur || "Erreur.");
    router.push(`/secretaire/inventaire/${cible.id}`);
  }

  return (
    <div style={{ ...stylePanneau, border: "1.5px solid var(--accent)" }}>
      <TitrePanneau
        icone="echange" titre="Fusionner ce doublon"
        sousTitre="Pour la même pièce entrée deux fois (souvent sous les numéros de deux fournisseurs). Choisis la fiche à garder."
        droite={
          <button onClick={onFermer} aria-label="Fermer" title="Fermer" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="bloque" taille={16} couleur="var(--text-muted)" />
          </button>
        }
      />
      <div style={{ position: "relative", marginBottom: 8 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
        </span>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Fiche à garder (nom ou numéro)…" className="champ" autoFocus style={{ marginBottom: 0, paddingLeft: 40 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {suggestions.map((p, i) => (
          <button key={p.id} onClick={() => fusionner(p)} disabled={enCours} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 4px", border: "none", borderTop: i === 0 ? "none" : "1px solid var(--border)", background: "none", color: "var(--text)", font: "inherit", cursor: "pointer" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{p.nom}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{p.numero} · stock {p.qte}{!p.actif ? " · désactivée" : ""}</span>
            </span>
            <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
          </button>
        ))}
      </div>
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>{erreur}</p>}
    </div>
  );
}

const boiteFormulaire = { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 };
const boutonPointille = {
  width: "100%", marginTop: 10, padding: "10px 8px", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
  color: "var(--accent-ombre)", background: "none", border: "1.5px dashed var(--accent)",
};

function OngletHistorique({ historique }) {
  if (historique.length === 0) {
    return <Vide>Aucune modification enregistrée sur la fiche de cet article.</Vide>;
  }
  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="horloge" teinte={TEINTES.neutre} titre="Historique" sousTitre="Modifications de la fiche" />
      {historique.map((h, i) => (
        <div key={h.id} style={{ padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <div style={{ fontSize: 13.5 }}>
            <strong>{h.champ}</strong> : <span style={{ color: "var(--text-muted)" }}>{h.ancienneValeur ?? "—"}</span> → <strong>{h.nouvelleValeur ?? "—"}</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {dateCourte(h.modifieLe)}{h.modifiePar ? ` · ${h.modifiePar}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
