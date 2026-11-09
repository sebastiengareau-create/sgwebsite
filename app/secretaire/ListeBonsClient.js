"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import BanderoleBo from "../components/BanderoleBo";
import DossiersParMois, { DossiersParMoisACharger } from "../components/DossiersParMois";
import { dateBon, bonEstAVenir, regrouperParJour, cleMoisQuebec, heureQuebec, dateCourteQuebec, cleJourQuebec } from "@/lib/regroupementDates";
import { correspondRecherche } from "@/lib/recherche";
import { Icone, BoutonPlein, Pastille } from "../components/StyleSection";

const STATUTS = {
  EN_ATTENTE: { label: "En attente", color: "#C9A227" },
  EN_COURS: { label: "En cours", color: "#4F82C0" },
  TERMINE: { label: "Facturé", color: "#6FA96B" },
};
const PLANIFIE = { label: "Planifié", color: "#9A7FC7" };

// "Planifié" n'est pas un statut en base : c'est un bon en attente dont la
// date prévue tombe après aujourd'hui (créé d'avance, manuellement ou depuis
// le calendrier). Il rejoint "En attente" le jour venu.
function etape(b) {
  return bonEstAVenir(b) ? "PLANIFIE" : b.statut;
}
function infosEtape(cle) {
  return cle === "PLANIFIE" ? PLANIFIE : STATUTS[cle];
}

const ETAPES = ["PLANIFIE", "EN_ATTENTE", "EN_COURS", "TERMINE"];

// Bons facturés : ceux facturés ce mois-ci restent affichés un par un ; les
// plus anciens vont dans un dossier repliable par mois de facturation. Hors
// recherche, la page ne reçoit que le nombre de bons de ces mois passés
// (moisAnciens) : chaque dossier se charge à son ouverture (lib/listeBons.js).
function dateFacturation(b) {
  return b.facture?.dateEmission || dateBon(b);
}
function separerFactures(bons) {
  const moisCourant = cleMoisQuebec(new Date());
  const anciens = bons.filter((b) => b.statut === "TERMINE" && cleMoisQuebec(dateFacturation(b)) < moisCourant);
  return { recents: bons.filter((b) => !anciens.includes(b)), anciens };
}

export default function ListeBonsClient({ bons, moisAnciens, filtreActuel }) {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState(null); // { q, bons, tronque } — réponse du serveur pour la recherche q
  const [vue, setVue] = useState("tableau"); // "liste" | "tableau"
  const [filtre, setFiltre] = useState(ETAPES.includes(filtreActuel) ? filtreActuel : "TOUS");
  const moisCharges = useRef(new Map()); // cle du mois → promesse de ses bons

  const q = recherche.trim().toLowerCase();

  // Recherche : les bons déjà chargés sont filtrés tout de suite, puis le
  // serveur répond avec tout l'historique (mois passés compris).
  useEffect(() => {
    if (!q) return;
    let annule = false;
    const minuterie = setTimeout(() => {
      fetch(`/api/bons?recherche=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => { if (!annule) setResultats({ q, bons: d.bons, tronque: d.tronque }); })
        .catch(() => { if (!annule) setResultats({ q, bons: null }); });
    }, 300);
    return () => { annule = true; clearTimeout(minuterie); };
  }, [q]);

  function chargerMois(cle) {
    if (!moisCharges.current.has(cle)) {
      const promesse = fetch(`/api/bons?mois=${cle}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => d.bons);
      promesse.catch(() => moisCharges.current.delete(cle));
      moisCharges.current.set(cle, promesse);
    }
    return moisCharges.current.get(cle);
  }

  const serveur = q && resultats?.q === q ? resultats : null;
  const rechercheEnCours = !!q && !serveur;
  const bonsRecherches = !q ? bons : serveur?.bons || bons.filter((b) => correspondRecherche(q, b.numero, b.client.nom, b.clientNomAffiche));
  // Pendant une recherche, les mois passés trouvés arrivent avec les résultats
  const moisACharger = q ? [] : moisAnciens;
  const nombreACharger = moisACharger.reduce((s, m) => s + m.nombre, 0);
  const compte = (cle) => bonsRecherches.filter((b) => etape(b) === cle).length + (cle === "TERMINE" ? nombreACharger : 0);
  const bonsFiltres = filtre === "TOUS" ? bonsRecherches : bonsRecherches.filter((b) => etape(b) === filtre);
  const { recents, anciens } = separerFactures(bonsFiltres);
  const dossiersACharger = filtre === "TOUS" || filtre === "TERMINE" ? moisACharger : [];

  return (
    <div className="conteneur-page-large" style={{ padding: 16, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <BoutonPlein href="/secretaire/nouveau" icone="plus">Nouveau bon</BoutonPlein>
        <BoutonPlein href="/secretaire/comptoir" icone="document">Facture comptoir</BoutonPlein>
        <div style={{ position: "relative", flex: "1 1 100%", minWidth: 0, order: 3 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Numéro ou client…"
            style={{
              width: "100%", padding: "11px 12px 11px 40px", borderRadius: 12, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 4, flexShrink: 0, marginLeft: "auto", order: 2 }}>
          <BoutonVue actif={vue === "liste"} onClick={() => setVue("liste")} icone="listePlate">Liste</BoutonVue>
          <BoutonVue actif={vue === "tableau"} onClick={() => setVue("tableau")} icone="grille">Tableau</BoutonVue>
        </div>
      </div>

      {vue === "liste" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 14 }}>
          <FiltrePill actif={filtre === "TOUS"} onClick={() => setFiltre("TOUS")} label="Tous" nombre={bonsRecherches.length + nombreACharger} />
          {ETAPES.map((cle) => (
            <FiltrePill
              key={cle} actif={filtre === cle} onClick={() => setFiltre(cle)}
              label={infosEtape(cle).label} nombre={compte(cle)} couleur={infosEtape(cle).color}
            />
          ))}
        </div>
      )}

      {serveur?.tronque && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          Seuls les {serveur.bons.length} bons les plus récents qui correspondent sont affichés — précise la recherche pour trouver un bon plus ancien.
        </p>
      )}

      {bons.length === 0 && moisAnciens.length === 0 ? (
        <EtatVide />
      ) : vue === "liste" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {regrouperParJour(recents, dateBon).map((g) => (
            <section key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <EnTeteGroupe groupe={g} />
              {g.elements.map((b) => <CarteBon key={b.id} b={b} />)}
            </section>
          ))}
          <DossiersParMois elements={anciens} obtenirDate={dateFacturation} ouvert={!!q} carte={(b) => <CarteBon key={b.id} b={b} />} />
          <DossiersParMoisACharger mois={dossiersACharger} charger={chargerMois} carte={(b) => <CarteBon key={b.id} b={b} />} />
          {bonsFiltres.length === 0 && dossiersACharger.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
              {rechercheEnCours ? "Recherche dans tout l'historique…" : `Aucun bon ${q ? `ne correspond à "${recherche.trim()}"` : "dans cette catégorie"}.`}
            </p>
          )}
        </div>
      ) : (
        <TableauBons bons={bonsRecherches} ouvert={!!q} moisACharger={moisACharger} nombreACharger={nombreACharger} chargerMois={chargerMois} />
      )}
    </div>
  );
}

function TableauBons({ bons, ouvert, moisACharger, nombreACharger, chargerMois }) {
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
      {ETAPES.map((cle) => {
        const infos = infosEtape(cle);
        const bonsColonne = bons.filter((b) => etape(b) === cle);
        const { recents, anciens } = separerFactures(bonsColonne);
        const dossiersACharger = cle === "TERMINE" ? moisACharger : [];
        return (
          <div key={cle} style={{ flex: "1 1 0", minWidth: 170, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 10px", borderBottom: `2px solid ${infos.color}`, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: infos.color }} />
              <span style={{ fontSize: 14, fontWeight: 800 }}>{infos.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: infos.color, background: `${infos.color}22`, borderRadius: 999, padding: "2px 9px" }}>
                {bonsColonne.length + (cle === "TERMINE" ? nombreACharger : 0)}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {regrouperParJour(recents, dateBon).map((g) => (
                <div key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <EnTeteGroupe groupe={g} compact />
                  {g.elements.map((b) => <CarteBonCompacte key={b.id} b={b} />)}
                </div>
              ))}
              <DossiersParMois elements={anciens} obtenirDate={dateFacturation} ouvert={ouvert} compact carte={(b) => <CarteBonCompacte key={b.id} b={b} />} />
              <DossiersParMoisACharger mois={dossiersACharger} charger={chargerMois} compact carte={(b) => <CarteBonCompacte key={b.id} b={b} />} />
              {bonsColonne.length === 0 && dossiersACharger.length === 0 && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>
                  {cle === "PLANIFIE" ? "Aucun bon à venir" : "Vide"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CarteBonCompacte({ b }) {
  const infos = infosEtape(etape(b));
  return (
    <Link href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ position: "relative", overflow: "hidden", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 10px 9px 14px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: infos.color }} />
        <BanderoleBo bon={b} compact style={{ marginBottom: 6 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{b.comptoir ? "🧾 " : ""}#{b.numero}</span>
          {b.datePrevue && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--text-muted)" }}><Icone nom="horloge" taille={13} /> {heureQuebec(b.datePrevue)}</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.client.nom}</div>
        {b.problemes[0] && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.problemes[0].description}{b.problemes.length > 1 ? ` (+${b.problemes.length - 1})` : ""}
          </div>
        )}
        {b.datePrevue && cleJourQuebec(b.datePrevue) !== cleJourQuebec(b.creeLe) && (
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>Créé le {dateCourteQuebec(b.creeLe)}</div>
        )}
      </div>
    </Link>
  );
}

function CarteBon({ b }) {
  const infos = infosEtape(etape(b));
  const date = new Date(dateBon(b));
  const nbPieces = b.problemes.reduce((s, p) => s + p.pieces.length, 0);
  return (
    <Link href={`/bons/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 12 }}>
        <PastilleDate date={date} couleur={infos.color} heure={b.datePrevue ? heureQuebec(b.datePrevue) : null} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{b.comptoir ? "🧾 Comptoir " : ""}#{b.numero}</span>
            <Pastille couleur={infos.color} fond={`${infos.color}22`}>{infos.label}</Pastille>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.client.nom}</div>
          {b.problemes[0] && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.problemes[0].description}
            </div>
          )}
          <BanderoleBo bon={b} compact style={{ marginTop: 6 }} />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {b.problemes.length} tâche{b.problemes.length !== 1 ? "s" : ""} · {nbPieces} pièce{nbPieces !== 1 ? "s" : ""} · Créé le {dateCourteQuebec(b.creeLe)}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Petit bloc calendrier : jour de la semaine, numéro, mois (et heure prévue)
function PastilleDate({ date, couleur, heure }) {
  const partie = (options) => date.toLocaleDateString("fr-CA", { timeZone: "America/Toronto", ...options }).replace(".", "");
  return (
    <div style={{ width: 54, flexShrink: 0, borderRadius: 12, background: `${couleur}1a`, border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: couleur }}>{partie({ weekday: "short" })}</span>
      <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{partie({ day: "numeric" })}</span>
      <span style={{ fontSize: 9.5, textTransform: "uppercase", color: "var(--text-muted)" }}>{partie({ month: "short" })}</span>
      {heure && <span style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 1 }}>{heure}</span>}
    </div>
  );
}

// Titre d'une journée — les jours à venir sont marqués pour distinguer les
// bons planifiés d'avance.
function EnTeteGroupe({ groupe, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: compact ? 2 : 8, padding: "0 2px" }}>
      <span style={{ fontSize: compact ? 10.5 : 12, fontWeight: 700, color: groupe.aVenir ? PLANIFIE.color : "var(--text-muted)", textTransform: compact ? "none" : "uppercase", letterSpacing: compact ? 0 : 0.4 }}>
        {groupe.aVenir ? "📅 " : ""}{groupe.libelle}
      </span>
      <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>({groupe.elements.length})</span>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function BoutonVue({ actif, onClick, icone, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 9, border: "none", cursor: "pointer",
        background: actif ? "var(--accent)" : "transparent", color: actif ? "#221f18" : "var(--text-muted)",
      }}
    >
      <Icone nom={icone} taille={15} />
      {children}
    </button>
  );
}

function EtatVide() {
  return (
    <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 16 }}>
      <span style={{ display: "inline-flex", width: 52, height: 52, borderRadius: 14, background: "rgba(232,163,61,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icone nom="outils" taille={26} couleur="var(--accent-ombre)" />
      </span>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 14 }}>Pas encore de bon de commande.</p>
      <BoutonPlein href="/secretaire/nouveau">Créer le premier</BoutonPlein>
    </div>
  );
}

function FiltrePill({ actif, onClick, label, nombre, couleur }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        fontSize: 13, fontWeight: 700, padding: "8px 10px", borderRadius: 9, whiteSpace: "nowrap", cursor: "pointer", border: "none",
        background: actif ? "var(--accent)" : "transparent",
        color: actif ? "#221f18" : "var(--text-muted)",
      }}
    >
      {couleur && <span style={{ width: 7, height: 7, borderRadius: "50%", background: actif ? "#221f18" : couleur }} />}
      {label}
      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: actif ? "rgba(0,0,0,0.12)" : "var(--surface-alt)" }}>{nombre}</span>
    </button>
  );
}
