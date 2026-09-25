"use client";

import { useState } from "react";
import Link from "next/link";
import BoutonFlottantNouveau from "../components/BoutonFlottantNouveau";
import { dateBon, bonEstAVenir, regrouperParJour, heureQuebec } from "@/lib/regroupementDates";

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

export default function ListeBonsClient({ bons, filtreActuel }) {
  const [recherche, setRecherche] = useState("");
  const [vue, setVue] = useState("tableau"); // "liste" | "tableau"
  const [filtre, setFiltre] = useState(ETAPES.includes(filtreActuel) ? filtreActuel : "TOUS");

  const bonsRecherches = bons.filter((b) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    const champs = [b.numero, b.client.nom];
    return champs.some((champ) => champ && champ.toLowerCase().includes(q));
  });
  const compte = (cle) => bonsRecherches.filter((b) => etape(b) === cle).length;
  const bonsFiltres = filtre === "TOUS" ? bonsRecherches : bonsRecherches.filter((b) => etape(b) === filtre);

  return (
    <div style={{ padding: 16, maxWidth: vue === "tableau" ? 1200 : 560, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="🔍 Rechercher par numéro ou client…"
          style={{
            flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, flexShrink: 0 }}>
          <BoutonVue actif={vue === "liste"} onClick={() => setVue("liste")}>☰ Liste</BoutonVue>
          <BoutonVue actif={vue === "tableau"} onClick={() => setVue("tableau")}>▦ Tableau</BoutonVue>
        </div>
      </div>

      {vue === "liste" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
          <FiltrePill actif={filtre === "TOUS"} onClick={() => setFiltre("TOUS")} label="Tous" nombre={bonsRecherches.length} />
          {ETAPES.map((cle) => (
            <FiltrePill
              key={cle} actif={filtre === cle} onClick={() => setFiltre(cle)}
              label={infosEtape(cle).label} nombre={compte(cle)} couleur={infosEtape(cle).color}
            />
          ))}
        </div>
      )}

      {bons.length === 0 ? (
        <EtatVide />
      ) : vue === "liste" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {regrouperParJour(bonsFiltres, dateBon).map((g) => (
            <section key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <EnTeteGroupe groupe={g} />
              {g.elements.map((b) => <CarteBon key={b.id} b={b} />)}
            </section>
          ))}
          {bonsFiltres.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
              Aucun bon {recherche ? `ne correspond à "${recherche}"` : "dans cette catégorie"}.
            </p>
          )}
        </div>
      ) : (
        <TableauBons bons={bonsRecherches} />
      )}
      <BoutonFlottantNouveau />
    </div>
  );
}

function TableauBons({ bons }) {
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
      {ETAPES.map((cle) => {
        const infos = infosEtape(cle);
        const bonsColonne = bons.filter((b) => etape(b) === cle);
        return (
          <div key={cle} style={{ flex: "1 1 240px", minWidth: 220, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px 8px", borderBottom: `2px solid ${infos.color}`, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: infos.color }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{infos.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: infos.color, background: `${infos.color}22`, borderRadius: 999, padding: "1px 8px" }}>
                {bonsColonne.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {regrouperParJour(bonsColonne, dateBon).map((g) => (
                <div key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <EnTeteGroupe groupe={g} compact />
                  {g.elements.map((b) => <CarteBonCompacte key={b.id} b={b} />)}
                </div>
              ))}
              {bonsColonne.length === 0 && (
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
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${infos.color}`, borderRadius: 8, padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{b.numero}</span>
          {b.datePrevue && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>🕒 {heureQuebec(b.datePrevue)}</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.client.nom}</div>
        {b.problemes[0] && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.problemes[0].description}{b.problemes.length > 1 ? ` (+${b.problemes.length - 1})` : ""}
          </div>
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
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
        <PastilleDate date={date} couleur={infos.color} heure={b.datePrevue ? heureQuebec(b.datePrevue) : null} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{b.numero}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: infos.color, background: `${infos.color}22`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
              {infos.label}
            </span>
          </div>
          <div style={{ fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.client.nom}</div>
          {b.problemes[0] && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {b.problemes[0].description}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {b.problemes.length} tâche{b.problemes.length !== 1 ? "s" : ""} · {nbPieces} pièce{nbPieces !== 1 ? "s" : ""}
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
    <div style={{ width: 52, flexShrink: 0, borderRadius: 8, background: `${couleur}1a`, border: `1px solid ${couleur}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
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

function BoutonVue({ actif, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: actif ? "var(--accent)" : "none", color: actif ? "#17150f" : "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}

function EtatVide() {
  return (
    <div style={{ textAlign: "center", padding: "30px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12 }}>
      <div style={{ fontSize: 30, marginBottom: 8 }}>🔧</div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Pas encore de bon de commande.</p>
      <Link href="/secretaire/nouveau" className="bouton-3d" style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "9px 16px", borderRadius: 999, textDecoration: "none" }}>
        + Créer le premier
      </Link>
    </div>
  );
}

function FiltrePill({ actif, onClick, label, nombre, couleur }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer",
        background: actif ? "var(--accent)" : "var(--surface)",
        color: actif ? "#17150f" : "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      {couleur && !actif && <span style={{ width: 7, height: 7, borderRadius: "50%", background: couleur }} />}
      {label}
      <span style={{ fontSize: 10.5, opacity: 0.75 }}>{nombre}</span>
    </button>
  );
}
