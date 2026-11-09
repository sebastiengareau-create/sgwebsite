"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import BoutonImporterFichier from "../../components/BoutonImporterFichier";
import ScannerCodeBarres from "../../components/ScannerCodeBarres";
import ImpressionEtiquettes from "../../components/ImpressionEtiquettes";
import RecherchePieces from "../../components/RecherchePieces";
import { useOrdreFiches } from "../../components/NavigationFiches";
import { trouverPieceParScan, pieceCorrespond, preparerRecherchePieces } from "@/lib/codesBarres";
import { libelleNumerosFournisseurs, comparateurPieces, TRIS_PIECES as TRIS } from "@/lib/rapportInventaire";
import { CLIENT } from "@/lib/client";
import { coutantKit, kitsDisponibles } from "@/lib/kits";
import FormulaireKit from "./FormulaireKit";
import ChampsPiece from "./ChampsPiece";
import { Icone, TEINTES, CarteChiffre, GrilleChiffres, BoutonPlein, BoutonContour, BoutonAction, GroupeLiens, Panneau, Pastille, TitrePanneau, stylePanneau } from "../../components/StyleSection";
import { argent } from "@/lib/format";

const CLE_TRI = "inventaire_tri";
// Choix « Pièces désactivées » du menu Trier par : seulement celles-là, par
// numéro (pas retenu sur l'appareil, ce n'est pas un tri)
const DESACTIVEES = "desactivees";
// Pièces affichées d'un coup, puis par tranche avec « Afficher plus » : des
// milliers de fiches à l'écran rendent la page lente, surtout sur cellulaire.
// La recherche, le tri et les étiquettes portent toujours sur toutes les pièces.
const TRANCHE = 100;

export default function InventaireClient({ pieces: toutes, coutHoraireDefaut, enCommande = {}, categories, comptesRevenu, fournisseurs, alignement, peutGererCategories, peutImporter, scanInitial, nouvelleInitiale, sitesPieces = null }) {
  const router = useRouter();
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [afficherFormulaireKit, setAfficherFormulaireKit] = useState(false);
  // Les kits (lib/kits.js) ont leur propre liste : pas de stock à eux
  const pieces = toutes.filter((p) => !p.estKit);
  const [afficherCategories, setAfficherCategories] = useState(false);
  const [recherche, setRecherche] = useState("");
  // Le filtrage suit la frappe sans la bloquer : le champ se met à jour
  // tout de suite, la liste juste après
  const rechercheDifferee = useDeferredValue(recherche);
  const [nombreAffiches, setNombreAffiches] = useState(TRANCHE);
  const [tri, setTri] = useState("numero");
  const [voirDesactivees, setVoirDesactivees] = useState(false);
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [codeInconnu, setCodeInconnu] = useState(null);
  const [messageScan, setMessageScan] = useState("");
  const [codeBarreNouvelle, setCodeBarreNouvelle] = useState("");
  const [modeEtiquettes, setModeEtiquettes] = useState(false);
  const [selection, setSelection] = useState(() => new Set());
  const nombreDesactivees = toutes.filter((p) => !p.actif).length;
  const seulementDesactivees = tri === DESACTIVEES;
  const visible = (p) => (seulementDesactivees ? !p.actif : p.actif || voirDesactivees);
  const kits = toutes.filter((p) => p.estKit && visible(p) && pieceCorrespond(p, rechercheDifferee));

  const nomCategorie = (code) => categories.find((c) => c.code === code)?.nom || code;

  const piecesFiltrees = useMemo(() => pieces.filter((p) => {
    if (!visible(p)) return false;
    return pieceCorrespond(p, rechercheDifferee);
  }).sort(comparateurPieces(seulementDesactivees ? "numero" : tri)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [toutes, rechercheDifferee, tri, voirDesactivees]);
  useOrdreFiches("pieces", piecesFiltrees.map((p) => p.id));
  useEffect(() => preparerRecherchePieces(toutes), [toutes]);

  // Le tri choisi est retenu sur cet appareil
  useEffect(() => {
    try {
      const memorise = localStorage.getItem(CLE_TRI);
      if (Object.hasOwn(TRIS, memorise ?? "")) setTri(memorise);
    } catch {}
  }, []);
  function choisirTri(valeur) {
    setTri(valeur);
    setNombreAffiches(TRANCHE);
    if (valeur === DESACTIVEES) return;
    try { localStorage.setItem(CLE_TRI, valeur); } catch {}
  }

  // Un scan ouvre la fiche de la pièce ; un code inconnu (boîte d'un
  // fabricant jamais scannée) propose de l'associer à une pièce.
  function scanDetecte(texte) {
    setScannerOuvert(false);
    setMessageScan("");
    const { piece, code, parEtiquette } = trouverPieceParScan(pieces, texte);
    if (piece) return router.push(`/secretaire/inventaire/${piece.id}`);
    if (parEtiquette) return setMessageScan("Cette étiquette correspond à une pièce qui n'existe plus dans l'inventaire.");
    setCodeInconnu(code);
  }

  // Code lu par le bouton « + » d'une autre page (?scan=…) : traité comme un
  // scan fait ici, puis retiré de l'adresse.
  useEffect(() => {
    if (!scanInitial) return;
    router.replace("/secretaire/inventaire");
    scanDetecte(scanInitial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanInitial]);

  // « Nouvelle pièce » du bouton « + » (?nouveau=1) : ouvre le formulaire,
  // puis retire le paramètre de l'adresse.
  useEffect(() => {
    if (!nouvelleInitiale) return;
    router.replace("/secretaire/inventaire");
    setAfficherFormulaireKit(false);
    setCodeBarreNouvelle("");
    setAfficherFormulaire(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nouvelleInitiale]);

  function basculerSelection(id) {
    setSelection((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id); else copie.add(id);
      return copie;
    });
  }
  const piecesSelectionnees = pieces.filter((p) => selection.has(p.id));

  // Chiffres du haut — pièces actives seulement (pas les kits, sans stock à eux)
  const actives = pieces.filter((p) => p.actif);
  const valeurStock = alignement ? alignement.valeurStock : actives.reduce((s, p) => s + p.qte * (p.coutant || 0), 0);
  const sousSeuil = actives.filter((p) => p.qte <= p.qteMin).length;
  const nbKits = toutes.filter((p) => p.estKit && p.actif).length;
  const nbEnCommande = Object.values(enCommande).filter((q) => q > 0).length;

  const groupes = [
    {
      titre: "Achats", teinte: TEINTES.ambre,
      liens: [
        { href: "/secretaire/inventaire/commandes", icone: "panier", label: "Commandes de pièces", detail: nbEnCommande > 0 ? `${nbEnCommande} pièce${nbEnCommande > 1 ? "s" : ""} en commande` : "Commander chez les fournisseurs" },
        ...(CLIENT.vehiculesAVendre ? [{ href: "/secretaire/inventaire/vehicules", icone: "vehicule", label: "Véhicules à vendre", detail: "Stock, coûtant et ventes" }] : []),
        ...(sitesPieces ? [{ onClick: () => setRechercheOuverte(true), icone: "loupe", label: "Rechercher chez nos fournisseurs", detail: "Prix et disponibilité en ligne" }] : []),
      ],
    },
    {
      titre: "Rapports", teinte: TEINTES.vert,
      liens: [
        { href: `/gerant/comptabilite/rapports/inventaire?tri=${seulementDesactivees ? "numero" : tri}`, target: "_blank", icone: "imprimante", label: "Rapport d'inventaire", detail: "Quantités, coûtants et marges" },
        { href: "/gerant/comptabilite/rapports/inventaire-fournisseurs", target: "_blank", icone: "immeuble", label: "Inventaire par fournisseur", detail: "Pièces regroupées par fournisseur" },
      ],
    },
    ...(peutGererCategories ? [{
      titre: "Configuration", teinte: TEINTES.neutre,
      liens: [
        { onClick: () => setAfficherCategories((v) => !v), icone: "reglages", label: afficherCategories ? "Fermer les catégories" : "Catégories d'inventaire", detail: "Classement et compte de revenu" },
      ],
    }] : []),
  ];

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📦" titre="Inventaire" sousTitre="Crée, ajuste ou retire des pièces. Le stock se déduit automatiquement quand une pièce est utilisée sur un bon de travail." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone="camera" onClick={() => { setCodeInconnu(null); setScannerOuvert(true); }}>Scanner une pièce</BoutonPlein>
        <BoutonContour icone="plus" actif={afficherFormulaire} onClick={() => { setAfficherFormulaire((v) => !v); setAfficherFormulaireKit(false); setCodeBarreNouvelle(""); }}>
          Nouvelle pièce
        </BoutonContour>
        <BoutonContour icone="outils" actif={afficherFormulaireKit} onClick={() => { setAfficherFormulaireKit((v) => !v); setAfficherFormulaire(false); }}>
          Nouveau kit
        </BoutonContour>
        <BoutonContour icone="etiquette" actif={modeEtiquettes} onClick={() => { setModeEtiquettes((v) => !v); setSelection(new Set()); }}>
          {modeEtiquettes ? "Terminer les étiquettes" : "Étiquettes"}
        </BoutonContour>
        {peutImporter && <BoutonImporterFichier apiUrl="/api/inventaire/importer" libelle="depuis Excel" libellePluriel="pièce" />}
      </div>

      {rechercheOuverte && <RecherchePieces sites={sitesPieces} onFermer={() => setRechercheOuverte(false)} />}
      {scannerOuvert && <ScannerCodeBarres titre="Scanner une pièce" onDetecte={scanDetecte} onFermer={() => setScannerOuvert(false)} />}
      {messageScan && <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 12px" }}>{messageScan}</p>}
      {codeInconnu && (
        <CodeInconnu
          code={codeInconnu}
          pieces={pieces.filter((p) => p.actif)}
          onAssociee={(id) => router.push(`/secretaire/inventaire/${id}`)}
          onNouvelle={() => { setCodeBarreNouvelle(codeInconnu); setCodeInconnu(null); setAfficherFormulaire(true); }}
          onFermer={() => setCodeInconnu(null)}
        />
      )}

      {afficherFormulaire && (
        <FormulaireCreation key={codeBarreNouvelle} codeBarreInitial={codeBarreNouvelle} categories={categories.filter((c) => c.actif)} fournisseurs={fournisseurs} onCree={() => { setAfficherFormulaire(false); router.refresh(); }} onAnnuler={() => setAfficherFormulaire(false)} />
      )}

      {afficherFormulaireKit && (
        <FormulaireKit
          pieces={pieces.filter((p) => p.actif)}
          categories={categories.filter((c) => c.actif)}
          coutHoraireDefaut={coutHoraireDefaut}
          onEnregistre={(kit) => router.push(`/secretaire/inventaire/${kit.id}`)}
          onAnnuler={() => setAfficherFormulaireKit(false)}
        />
      )}

      <div style={{ marginTop: 14 }} />
      <GrilleChiffres>
        <CarteChiffre
          titre="Valeur du stock" montant={argent(valeurStock)} couleur="var(--text)" teinte="var(--accent)"
          note="Quantité × coûtant, pièces actives"
        />
        <CarteChiffre
          titre="Pièces en stock" montant={String(actives.length)} teinte="var(--bleu)"
          note={nbKits > 0 ? `Pièces actives · plus ${nbKits} kit${nbKits > 1 ? "s" : ""}` : "Pièces actives"}
        />
        <CarteChiffre
          titre="Sous le seuil" montant={String(sousSeuil)}
          couleur={sousSeuil > 0 ? "var(--danger)" : "var(--success)"} teinte={sousSeuil > 0 ? "var(--danger)" : "var(--success)"}
          note={sousSeuil > 0 ? "À son minimum ou moins — en rouge dans la liste" : "Aucune pièce sous son minimum"}
        />
      </GrilleChiffres>

      {alignement && <AlignementInventaire alignement={alignement} />}

      {groupes.map((g) => <GroupeLiens key={g.titre} {...g} />)}

      {afficherCategories && (
        <GestionCategories categories={categories} comptesRevenu={comptesRevenu} onModifie={() => window.location.reload()} />
      )}

      <Panneau titre={modeEtiquettes ? "Étiquettes à imprimer" : "Pièces"}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setNombreAffiches(TRANCHE); }}
            placeholder="Rechercher par description, numéro ou no fournisseur…"
            style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12 }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
            Trier par
            <select value={tri} onChange={(e) => choisirTri(e.target.value)} style={{ ...champStyle, width: "auto", marginBottom: 0, padding: "6px 10px", fontSize: 13 }}>
              {Object.entries(TRIS).map(([cle, t]) => <option key={cle} value={cle}>{t.libelle}</option>)}
              <option value={DESACTIVEES}>Pièces désactivées ({nombreDesactivees})</option>
            </select>
          </label>
          {nombreDesactivees > 0 && !seulementDesactivees && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={voirDesactivees} onChange={(e) => { setVoirDesactivees(e.target.checked); setNombreAffiches(TRANCHE); }} />
              Afficher les désactivées ({nombreDesactivees})
            </label>
          )}
        </div>

        {modeEtiquettes && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 10, gap: 8 }}>
              <span style={{ color: "var(--text-muted)" }}>Touche les pièces à étiqueter — {selection.size} choisie{selection.size > 1 ? "s" : ""}</span>
              <span style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                <button onClick={() => setSelection(new Set(piecesFiltrees.map((p) => p.id)))} style={boutonLien}>Tout ({piecesFiltrees.length})</button>
                <button onClick={() => setSelection(new Set())} style={boutonLien}>Aucune</button>
              </span>
            </div>
            {piecesSelectionnees.length > 0 && (
              <ImpressionEtiquettes pieces={piecesSelectionnees.map((p) => ({ id: p.id, qte: p.qte }))} />
            )}
          </>
        )}

        {kits.length > 0 && !modeEtiquettes && (
          <>
            <EnteteListe titre={`Kits (${kits.length})`} droite="Possibles" />
            {kits.map((k, i) => <CarteKit key={k.id} kit={k} nomCategorie={nomCategorie} premier={i === 0} />)}
            <div style={{ height: 16 }} />
          </>
        )}

        {piecesFiltrees.length > 0 && <EnteteListe titre={kits.length > 0 && !modeEtiquettes ? `Pièces (${piecesFiltrees.length})` : `${piecesFiltrees.length} pièce${piecesFiltrees.length > 1 ? "s" : ""}`} droite="Stock" />}
        {piecesFiltrees.slice(0, nombreAffiches).map((p, i) => {
          const bas = p.actif && p.qte <= p.qteMin;
          const choisie = modeEtiquettes && selection.has(p.id);
          const ligne = (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 6px",
              borderTop: i === 0 ? "none" : "1px solid var(--border)", opacity: p.actif ? 1 : 0.55,
              background: choisie ? "rgba(232,163,61,0.10)" : "transparent", borderRadius: choisie ? 10 : 0,
            }}>
              {modeEtiquettes && <input type="checkbox" checked={selection.has(p.id)} readOnly style={{ flexShrink: 0, pointerEvents: "none" }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nom}{!p.actif && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}> (désactivée)</span>}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {p.numero}{libelleNumerosFournisseurs(p) && <> · {libelleNumerosFournisseurs(p)}</>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5 }}>
                  <Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.14)">{nomCategorie(p.categorie)}</Pastille>
                  {p.emplacement && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "var(--text-muted)" }}>
                      <Icone nom="epingle" taille={13} /> {p.emplacement}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: bas ? "var(--danger)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                  {p.qte}
                </div>
                <div style={{ fontSize: 11.5, color: bas ? "var(--danger)" : "var(--text-muted)", fontWeight: bas ? 700 : 400 }}>{bas ? "stock bas" : "en stock"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{argent(p.prix)}</div>
                {enCommande[p.id] > 0 && <div style={{ fontSize: 11.5, color: "var(--bleu)", fontWeight: 700 }}>+{enCommande[p.id]} en commande</div>}
              </div>
            </div>
          );
          return modeEtiquettes ? (
            <div key={p.id} onClick={() => basculerSelection(p.id)} style={{ cursor: "pointer" }}>{ligne}</div>
          ) : (
            <Link key={p.id} href={`/secretaire/inventaire/${p.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{ligne}</Link>
          );
        })}
        {piecesFiltrees.length > nombreAffiches && (
          <button
            onClick={() => setNombreAffiches((n) => n + TRANCHE)}
            style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
          >
            Afficher plus — {piecesFiltrees.length - nombreAffiches} autre{piecesFiltrees.length - nombreAffiches > 1 ? "s" : ""}
          </button>
        )}
        {piecesFiltrees.length === 0 && pieces.length > 0 && rechercheDifferee.trim() && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune pièce ne correspond à « {recherche} ».</p>
        )}
        {seulementDesactivees && nombreDesactivees === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune pièce désactivée.</p>
        )}
        {pieces.length === 0 && !afficherFormulaire && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune pièce dans l'inventaire — ajoute la première avec « Nouvelle pièce ».</p>
        )}
      </Panneau>
    </div>
  );
}

function EnteteListe({ titre, droite }) {
  return (
    <div style={{ display: "flex", padding: "0 6px 8px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", borderBottom: "2px solid var(--accent)" }}>
      <span style={{ flex: 1 }}>{titre}</span>
      <span>{droite}</span>
    </div>
  );
}

// Kit dans la liste : son prix, son coûtant actuel et combien le stock de
// ses pièces permet d'en faire
function CarteKit({ kit, nomCategorie, premier }) {
  const cout = coutantKit(kit.composantsKit);
  const possibles = kitsDisponibles(kit.composantsKit);
  const manque = possibles === 0 && kit.actif;
  return (
    <Link href={`/secretaire/inventaire/${kit.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px", borderTop: premier ? "none" : "1px solid var(--border)", opacity: kit.actif ? 1 : 0.55 }}>
        <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="outils" taille={18} couleur={TEINTES.bleu.couleur} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{kit.nom}{!kit.actif && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}> (désactivé)</span>}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {kit.numero} · {kit.composantsKit.length} élément{kit.composantsKit.length > 1 ? "s" : ""} · coûtant {argent(cout.total)}
          </div>
          <div style={{ marginTop: 5 }}>
            <Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.14)">{nomCategorie(kit.categorie)}</Pastille>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: manque ? "var(--danger)" : "var(--text)" }}>
            {possibles === null ? "—" : possibles}
          </div>
          <div style={{ fontSize: 11.5, color: manque ? "var(--danger)" : "var(--text-muted)", fontWeight: manque ? 700 : 400 }}>
            {possibles === null ? "kit" : `possible${possibles > 1 ? "s" : ""}`}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{argent(kit.prix)}</div>
        </div>
      </div>
    </Link>
  );
}

function GestionCategories({ categories, comptesRevenu, onModifie }) {
  const [nom, setNom] = useState("");
  const [modeCompte, setModeCompte] = useState("nouveau"); // "existant" | "nouveau"
  const [compteRevenuNumero, setCompteRevenuNumero] = useState(comptesRevenu[0]?.numero || "");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [editionId, setEditionId] = useState(null);
  const [nomEdition, setNomEdition] = useState("");
  const [compteEdition, setCompteEdition] = useState("");

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    if (!nom.trim()) return;
    setEnCours(true);
    const res = await fetch("/api/inventaire/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        modeCompte === "nouveau" ? { nom, nomNouveauCompte: nom } : { nom, compteRevenuNumero }
      ),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setNom("");
    onModifie();
  }

  async function desactiver(id) {
    if (!window.confirm("Retirer cette catégorie ? Les pièces déjà classées dedans garderont leur catégorie, mais elle n'apparaîtra plus dans la liste pour de nouvelles pièces.")) return;
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: false }),
    });
    onModifie();
  }

  async function reactiver(id) {
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: true }),
    });
    onModifie();
  }

  function commencerEdition(c) {
    setEditionId(c.id);
    setNomEdition(c.nom);
    setCompteEdition(c.compteRevenuNumero);
  }

  async function enregistrerEdition(id) {
    if (!nomEdition.trim()) return;
    setEnCours(true);
    await fetch(`/api/inventaire/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomEdition.trim(), compteRevenuNumero: compteEdition }),
    });
    setEnCours(false);
    setEditionId(null);
    onModifie();
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Catégories existantes</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ opacity: c.actif ? 1 : 0.55 }}>
            {editionId === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 8 }}>
                <input value={nomEdition} onChange={(e) => setNomEdition(e.target.value)} style={{ ...champStyle, marginBottom: 0, fontSize: 12.5 }} />
                <select value={compteEdition} onChange={(e) => setCompteEdition(e.target.value)} style={{ ...champStyle, marginBottom: 0, fontSize: 12.5 }}>
                  {comptesRevenu.map((co) => <option key={co.id} value={co.numero}>{co.numero} — {co.nom}</option>)}
                  {!comptesRevenu.some((co) => co.numero === c.compteRevenuNumero) && (
                    <option value={c.compteRevenuNumero}>{c.compteRevenuNumero} — (actuel)</option>
                  )}
                </select>
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <button type="button" onClick={() => enregistrerEdition(c.id)} disabled={enCours} className="bouton-3d" style={{ flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEditionId(null)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 11.5, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span>{c.nom}{!c.actif && " (inactive)"} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>→ {c.compteRevenuNumero}</span></span>
                <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => commencerEdition(c)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>✏️</button>
                  {c.actif ? (
                    <button onClick={() => desactiver(c.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>✕</button>
                  ) : (
                    <button onClick={() => reactiver(c.id)} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", fontSize: 11 }}>Réactiver</button>
                  )}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input placeholder="Nom de la catégorie (ex : Huiles)" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...champStyle, marginBottom: 0 }} />

        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3 }}>
          <button type="button" onClick={() => setModeCompte("nouveau")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "nouveau" ? "var(--accent)" : "none", color: modeCompte === "nouveau" ? "#17150f" : "var(--text-muted)" }}>
            + Nouveau compte
          </button>
          <button type="button" onClick={() => setModeCompte("existant")} style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: modeCompte === "existant" ? "var(--accent)" : "none", color: modeCompte === "existant" ? "#17150f" : "var(--text-muted)" }}>
            Compte existant
          </button>
        </div>

        {modeCompte === "nouveau" ? (
          <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "2px 0 0" }}>Un compte "{nom || "…"}" sera créé automatiquement, avec le prochain numéro disponible.</p>
        ) : (
          <select value={compteRevenuNumero} onChange={(e) => setCompteRevenuNumero(e.target.value)} style={{ ...champStyle, marginBottom: 0 }}>
            {comptesRevenu.map((c) => <option key={c.id} value={c.numero}>{c.numero} — {c.nom}</option>)}
          </select>
        )}

        {erreur && <p style={{ color: "var(--danger)", fontSize: 11.5 }}>{erreur}</p>}
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
          {enCours ? "Création…" : "+ Ajouter la catégorie"}
        </button>
      </form>
    </div>
  );
}

// Mêmes champs que « Modifier la pièce » (ChampsPiece)
function FormulaireCreation({ categories, fournisseurs, onCree, onAnnuler, codeBarreInitial = "" }) {
  const [valeurs, setValeurs] = useState({
    nom: "", numero: "", autresNumeros: "", codeBarre: codeBarreInitial, qte: "0", qteMin: "0", qteMax: "",
    coutant: "", prix: "", emplacement: "", fournisseurId: "", categorie: categories[0]?.code || "PIECE",
  });
  // Prix de vente saisi à la main : la proposition calculée du coûtant ne
  // l'écrase plus (vider le champ la rétablit)
  const [prixManuel, setPrixManuel] = useState(false);
  const marge = CLIENT.margePrixVente;
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  function changer(champ, valeur) {
    setValeurs((v) => {
      const suivant = { ...v, [champ]: valeur };
      if (champ === "coutant" && marge != null && !prixManuel) {
        const c = parseFloat(valeur);
        suivant.prix = Number.isFinite(c) && c >= 0 ? (c / (1 - marge / 100)).toFixed(2) : "";
      }
      return suivant;
    });
    if (champ === "prix") setPrixManuel(valeur !== "");
  }

  async function creer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/inventaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeurs),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la création.");
      return;
    }
    const cree = await res.json().catch(() => ({}));
    if (cree.avertissementComptable) {
      window.alert(`Pièce créée, mais aucune écriture comptable n'a été passée pour son stock de départ :\n${cree.avertissementComptable}`);
    }
    onCree();
  }

  // Marge réelle (sur le prix de vente) dès que les deux prix sont connus
  const c = parseFloat(valeurs.coutant), pv = parseFloat(valeurs.prix);
  const margeReelle = Number.isFinite(c) && Number.isFinite(pv) && pv > 0 ? ((pv - c) / pv) * 100 : null;

  return (
    <form onSubmit={creer} style={{ ...stylePanneau, border: "1.5px solid var(--accent)", marginBottom: 20 }}>
      <TitrePanneau icone="boite" titre="Nouvelle pièce" />
      <ChampsPiece
        valeurs={valeurs} onChange={changer} onErreur={setErreur} categories={categories} fournisseurs={fournisseurs} requis
        libelleCoutant="Prix coûtant ($)" libellePrix={marge == null ? "Prix de vente ($)" : `Prix de vente ($) — marge ${marge} % proposée`}
      />
      {margeReelle != null && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, marginBottom: 14, background: margeReelle < 0 ? "var(--danger-fond)" : "var(--success-fond)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: margeReelle < 0 ? "var(--danger)" : "var(--success)" }}>Marge sur le prix de vente</span>
          <span style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{margeReelle.toFixed(1).replace(".", ",")} % · {argent(pv - c)}</span>
        </div>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{erreur}</p>}
      <div style={{ display: "grid", gridTemplateColumns: onAnnuler ? "1fr 1fr" : "1fr", gap: 8 }}>
        <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
          {enCours ? "Création…" : "Ajouter la pièce"}
        </button>
        {onAnnuler && <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={onAnnuler}>Annuler</BoutonAction>}
      </div>
    </form>
  );
}

const champStyle = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, marginBottom: 8, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 3 };
const boutonLien = { background: "none", border: "none", color: "var(--accent)", textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0 };
const boutonSecondaire = {
  flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "none",
  color: "var(--text-muted)", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
};

const fmtMontant = (n) => `${argent(n)}`;

function AlignementInventaire({ alignement }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const aligne = Math.abs(alignement.ecart) < 0.005;

  async function aligner() {
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/inventaire/aligner", { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    router.refresh();
  }

  const teinte = aligne ? "var(--success)" : "var(--avertissement)";
  return (
    <div style={{
      position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, padding: "14px 16px 14px 20px", marginBottom: 24, fontSize: 13,
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: aligne ? "var(--success-fond)" : "var(--avertissement-fond)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={aligne ? "crochet" : "alerte"} taille={18} couleur={teinte} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {aligne ? "Inventaire aligné avec le grand livre" : `Écart de ${fmtMontant(alignement.ecart)} avec le grand livre`}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ color: "var(--text-muted)" }}>Valeur du stock (qté × coûtant)</span><strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMontant(alignement.valeurStock)}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>Grand livre — 1200 Inventaire de pièces</span><strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMontant(alignement.soldeGL)}</strong>
      </div>
      {alignement.surBonsNonFactures > 0.005 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4, color: "var(--text-muted)" }}>
          <span>Pièces sur bons non facturés (sorties du stock ou hors inventaire, pas encore au G/L)</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMontant(alignement.surBonsNonFactures)}</span>
        </div>
      )}
      {!aligne && (
        <>
          <p style={{ margin: "10px 0", color: "var(--text-muted)", fontSize: 12.5 }}>
            L'alignement passe une écriture entre 1200 et 3010 Soldes d'ouverture, sans toucher au bénéfice. Un solde d'ouverture déjà saisi est pris en compte.
          </p>
          <BoutonPlein icone="balance" onClick={enCours ? undefined : aligner}>
            {enCours ? "Alignement…" : "Aligner l'inventaire sur le grand livre"}
          </BoutonPlein>
        </>
      )}
      {erreur && <p style={{ color: "var(--danger)", margin: "8px 0 0" }}>{erreur}</p>}
    </div>
  );
}

// Code scanné qui ne correspond à aucune pièce (typiquement le code-barres
// d'un fabricant, la première fois) : l'associer à une pièce existante ou
// créer la pièce avec ce code.
function CodeInconnu({ code, pieces, onAssociee, onNouvelle, onFermer }) {
  const [recherche, setRecherche] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const q = recherche.trim().toLowerCase();
  const suggestions = q
    ? pieces.filter((p) => pieceCorrespond(p, q)).slice(0, 8)
    : [];

  async function associer(piece) {
    if (piece.codeBarre && !window.confirm(`« ${piece.nom} » a déjà le code ${piece.codeBarre}. Le remplacer par ${code} ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/inventaire/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codeBarre: code }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onAssociee(piece.id);
  }

  return (
    <div className="carte carte-m" style={{ marginBottom: 12, border: "1px solid var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 13 }}>
          Code inconnu : <strong style={{ fontFamily: "monospace" }}>{code}</strong>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Associe-le à une pièce : la prochaine fois, le scan la trouvera directement.</div>
        </div>
        <button onClick={onFermer} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>✕</button>
      </div>
      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Chercher la pièce par description ou numéro…"
        autoFocus
        style={{ ...champStyle, marginTop: 10 }}
      />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {suggestions.map((p) => (
            <button
              key={p.id}
              onClick={() => associer(p)}
              disabled={enCours}
              style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12.5, cursor: "pointer" }}
            >
              {p.nom} <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>— {p.numero}</span>
              {p.codeBarre && <span style={{ color: "var(--text-muted)" }}> (a déjà un code)</span>}
            </button>
          ))}
        </div>
      )}
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{erreur}</p>}
      <button onClick={onNouvelle} className="bouton-3d-sombre" style={{ width: "100%", padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
        + Nouvelle pièce avec ce code
      </button>
    </div>
  );
}
