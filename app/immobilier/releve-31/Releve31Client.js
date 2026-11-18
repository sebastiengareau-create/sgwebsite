"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { bailAu31Decembre, donneesReleve31, echeanceReleve31, dateLisible, nomLogement } from "@/lib/immobilierCalculs";
import { NavImmo, Section, Statistique, Vide, Alerte, BoutonTexte, useApi, Erreur, champStyle, lien } from "../ui";

export default function Releve31Client({ baux, annee, defaut }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const lignes = baux
    .filter((b) => bailAu31Decembre(b, annee))
    .map((b) => ({ ...b, rl: donneesReleve31(b), suivi: b.releves31[0] || {} }))
    .sort((a, b) => a.logement.immeuble.nom.localeCompare(b.logement.immeuble.nom) || a.logement.numero.localeCompare(b.logement.numero, "fr", { numeric: true }));
  const prets = lignes.filter((l) => l.rl.problemes.length === 0);
  const produits = lignes.filter((l) => l.suivi.produitLe);
  const remis = lignes.filter((l) => l.suivi.remisLe);
  const echeance = echeanceReleve31(annee);
  const anneeFinie = new Date() > new Date(Date.UTC(annee, 11, 31, 23));
  const enRetard = new Date() > new Date(echeance.getTime() + 86400000) && produits.length < lignes.length;
  const aProduire = prets.filter((l) => !l.suivi.produitLe);

  const suivre = (bailIds, champs) => appeler("/api/immobilier/releves31", "POST", { annee, bailIds, ...champs });

  function exporter() {
    const e = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const entetes = ["Immeuble", "Logement", "Case A - Numéro de logement", "Case B - Nombre de locataires", "C1 - Appartement", "C2 - Numéro municipal", "C3 - Rue", "C4 - Ville", "C5 - Code postal", "Locataires", "À corriger", "Produit le", "Remis le"];
    const csv = [entetes.join(";"), ...lignes.map((l) => [
      l.logement.immeuble.nom, nomLogement(l.logement), l.rl.caseA, l.rl.caseB, l.rl.c1, l.rl.c2, l.rl.c3, l.rl.c4, l.rl.c5, l.rl.locataires.join(", "),
      l.rl.problemes.join(" ; "), l.suivi.produitLe ? String(l.suivi.produitLe).slice(0, 10) : "", l.suivi.remisLe ? String(l.suivi.remisLe).slice(0, 10) : "",
    ].map(e).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `releves-31-${annee}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🧾" titre="Relevé 31" sousTitre="Renseignements sur l'occupation d'un logement au 31 décembre, à produire pour Revenu Québec." />
      <NavImmo actif="/immobilier/releve-31" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <select value={annee} onChange={(e) => router.push(`/immobilier/releve-31?annee=${e.target.value}`)} style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
          {[defaut + 1, defaut, defaut - 1, defaut - 2, defaut - 3].map((a) => <option key={a} value={a}>Logements occupés au 31 décembre {a}</option>)}
        </select>
        {lignes.length > 0 && <BoutonTexte onClick={exporter}>⬇️ Exporter (CSV)</BoutonTexte>}
        {lignes.length > 0 && <BoutonTexte onClick={() => window.print()}>🖨️ Imprimer</BoutonTexte>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={lignes.length} label="Relevés à produire" teinte="var(--bleu)" />
        <Statistique valeur={lignes.length - prets.length} label="Renseignements à compléter" teinte={lignes.length - prets.length > 0 ? "var(--accent)" : "var(--success)"} />
        <Statistique valeur={`${produits.length} / ${lignes.length}`} label="Produits à Revenu Québec" teinte={produits.length === lignes.length && lignes.length ? "var(--success)" : "var(--accent)"} />
        <Statistique valeur={`${remis.length} / ${lignes.length}`} label="Copies remises aux locataires" teinte={remis.length === lignes.length && lignes.length ? "var(--success)" : "var(--accent)"} />
      </div>

      {enRetard && <Alerte>La date limite du {dateLisible(echeance)} est passée : {lignes.length - produits.length} relevé{lignes.length - produits.length > 1 ? "s" : ""} pas encore produit{lignes.length - produits.length > 1 ? "s" : ""}.</Alerte>}

      <Section titre="Comment faire">
        <ol style={{ fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Un relevé par logement occupé {anneeFinie ? "le" : "au"} 31 décembre {annee} (bail en cours ce jour-là), avec tous les locataires qui ont signé le bail. Les locaux commerciaux, stationnements et rangements ne sont pas visés.</li>
          <li>Complète ce qui manque ci-dessous : surtout le <strong>numéro de logement (case A)</strong>, déterminé par Revenu Québec et le même d'une année à l'autre, et l'adresse propre à chaque logement d'un plex.</li>
          <li>Produis les relevés dans le service en ligne de Revenu Québec « Produire et consulter des relevés 31 » (obligatoire par Internet au-delà de 5 relevés), en recopiant ces données ou à partir de l'export.</li>
          <li>Remets une copie à chaque locataire et transmets-les à Revenu Québec au plus tard le <strong>{dateLisible(echeance)}</strong>. Coche « Produit » et « Remis » ici pour suivre où tu en es.</li>
        </ol>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>L'appli prépare et suit les relevés ; elle ne les transmet pas elle-même (un logiciel doit être autorisé chaque année par Revenu Québec pour le faire).</p>
      </Section>

      <Erreur texte={erreur} />
      {aProduire.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <button type="button" disabled={enCours} onClick={() => suivre(aProduire.map((l) => l.id), { produit: true })} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>
            {enCours ? "…" : `✅ Marquer les ${aProduire.length} relevés complets comme produits aujourd'hui`}
          </button>
        </div>
      )}

      {lignes.length === 0 ? <Vide>Aucun logement loué {anneeFinie ? "n'était occupé" : "ne sera occupé"} au 31 décembre {annee} selon les baux inscrits.</Vide> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lignes.map((l) => <Fiche key={l.id} l={l} suivre={suivre} enCours={enCours} />)}
        </div>
      )}
    </div>
  );
}

function Fiche({ l, suivre, enCours }) {
  const { rl, suivi } = l;
  const complet = rl.problemes.length === 0;
  const [caseA, setCaseA] = useState(l.logement.numeroLogementRq || "");
  const [adresse, setAdresse] = useState(l.logement.adresseCivique || "");
  const { appeler, enCours: enreg, erreur } = useApi();
  const modifie = caseA !== (l.logement.numeroLogementRq || "") || adresse !== (l.logement.adresseCivique || "");
  const plusieursNumeros = !l.logement.adresseCivique && /[-–]/.test(rl.c2);
  return (
    <div className="carte" style={{ borderLeft: `4px solid ${suivi.produitLe ? "var(--success)" : complet ? "var(--bleu)" : "var(--accent)"}`, marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <Link href={`/immobilier/logements/${l.logement.id}`} style={{ ...lien, fontWeight: 800, fontSize: 15 }}>{l.logement.immeuble.nom} · {nomLogement(l.logement)}</Link>
          <div style={{ fontSize: 13 }}><Link href={`/immobilier/baux/${l.id}`} style={{ color: "inherit" }}>{rl.locataires.join(", ") || "—"}</Link></div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 13 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={Boolean(suivi.produitLe)} disabled={enCours} onChange={(e) => suivre([l.id], { produit: e.target.checked })} />
            Produit{suivi.produitLe && <span style={{ color: "var(--text-muted)" }}> {dateLisible(suivi.produitLe)}</span>}
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={Boolean(suivi.remisLe)} disabled={enCours} onChange={(e) => suivre([l.id], { remis: e.target.checked })} />
            Remis au locataire{suivi.remisLe && <span style={{ color: "var(--text-muted)" }}> {dateLisible(suivi.remisLe)}</span>}
          </label>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "4px 14px", fontSize: 12.5, marginBottom: 8 }}>
        <Case lettre="A" titre="N° de logement" valeur={rl.caseA} />
        <Case lettre="B" titre="Nombre de locataires" valeur={rl.caseB} />
        <Case lettre="C1" titre="Appartement" valeur={rl.c1 || "—"} />
        <Case lettre="C2" titre="Numéro municipal" valeur={rl.c2} />
        <Case lettre="C3" titre="Rue" valeur={rl.c3} />
        <Case lettre="C4" titre="Ville" valeur={rl.c4} />
        <Case lettre="C5" titre="Code postal" valeur={rl.c5} />
      </div>
      {rl.problemes.length > 0 && <div style={{ fontSize: 12.5, color: "var(--accent-ombre)", fontWeight: 700, marginBottom: 6 }}>⚠️ {rl.problemes.join(" · ")}{(!rl.c4 || !rl.c5) && <> — <Link href={`/immobilier/immeubles/${l.logement.immeuble.id}`} style={lien}>fiche de l'immeuble</Link></>}</div>}
      {(!l.logement.numeroLogementRq || plusieursNumeros || modifie) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input value={caseA} onChange={(e) => setCaseA(e.target.value)} placeholder="N° de logement (case A)" style={{ ...champStyle, width: 200, marginBottom: 0 }} />
          {(plusieursNumeros || l.logement.adresseCivique) && <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder={`Adresse du logement (ex. ${l.logement.numero} ${rl.c3})`} style={{ ...champStyle, width: 240, marginBottom: 0 }} />}
          <button type="button" disabled={!modifie || enreg} onClick={() => appeler(`/api/immobilier/logements/${l.logement.id}`, "PATCH", { numeroLogementRq: caseA, adresseCivique: adresse })} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{enreg ? "…" : "Enregistrer"}</button>
          <Erreur texte={erreur} />
        </div>
      )}
    </div>
  );
}

function Case({ lettre, titre, valeur }) {
  const vide = valeur === "" || valeur == null;
  return (
    <div>
      <span style={{ color: "var(--text-muted)" }}>{lettre} · {titre}</span>
      <div style={{ fontWeight: 700, color: vide ? "var(--danger)" : undefined }}>{vide ? "à inscrire" : valeur}</div>
    </div>
  );
}
