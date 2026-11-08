"use client";

import { useState } from "react";
import Link from "next/link";
import { remplirModele, passagesACompleter, sujetParDefaut, valeursClient } from "@/lib/documents";
import { correspondRecherche } from "@/lib/recherche";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../../../components/StyleSection";

const RE_COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Choix des clients, texte ajustable pour cet envoi (le modèle ne change
// pas), aperçu pour un client, puis envoi — chaque client reçoit sa lettre
// remplie avec sa fiche.
export default function EnvoiGroupeClient({ modele, clients, communes, courrielConfigure }) {
  const admissibles = clients.filter((c) => !c.promotionsRefuseesLe && RE_COURRIEL.test(c.courriel?.trim() || ""));
  const nbDesabonnes = clients.filter((c) => c.promotionsRefuseesLe).length;
  const nbSansCourriel = clients.length - admissibles.length - nbDesabonnes;

  const [sujet, setSujet] = useState(() => sujetParDefaut(modele.contenu, modele.nom));
  const [contenu, setContenu] = useState(modele.contenu);
  const [choisis, setChoisis] = useState(() => new Set(admissibles.map((c) => c.id)));
  const [recherche, setRecherche] = useState("");
  const [apercuId, setApercuId] = useState(null);
  const [etat, setEtat] = useState({ enCours: false, resultat: null, erreur: "" });

  const aCompleter = passagesACompleter(`${sujet}\n${contenu}`);
  const terme = recherche.trim().toLowerCase();
  const visibles = terme ? admissibles.filter((c) => correspondRecherche(terme, c.nom, c.courriel, c.ville)) : admissibles;
  const clientApercu = admissibles.find((c) => c.id === apercuId) || admissibles.find((c) => choisis.has(c.id));
  const valeursApercu = clientApercu ? { ...communes, ...valeursClient(clientApercu) } : null;

  function basculer(id) {
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function choisirTous(oui) {
    setChoisis((s) => {
      const n = new Set(s);
      for (const c of visibles) { if (oui) n.add(c.id); else n.delete(c.id); }
      return n;
    });
  }

  // Une fois l'envoi fait, le bouton reste désactivé : un deuxième clic
  // renverrait tout à tous
  async function envoyer() {
    if (!window.confirm(`Envoyer « ${sujet} » par courriel à ${choisis.size} client${choisis.size > 1 ? "s" : ""} ?`)) return;
    setEtat({ enCours: true, resultat: null, erreur: "" });
    const res = await fetch("/api/documents/envoi-groupe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modeleId: modele.id, sujet, contenu, clientIds: [...choisis] }),
    });
    const donnees = await res.json().catch(() => ({}));
    setEtat(res.ok ? { enCours: false, resultat: donnees, erreur: "" } : { enCours: false, resultat: null, erreur: donnees.erreur || "Échec de l'envoi." });
  }

  const desactive = etat.enCours || !!etat.resultat || !courrielConfigure || choisis.size === 0 || aCompleter.length > 0 || !sujet.trim() || !contenu.trim();

  return (
    <div className="conteneur-page">
      <Link href="/gerant/documents" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux documents</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="📢" titre={`Envoi groupé — ${modele.nom}`} sousTitre="Chaque client reçoit la lettre remplie avec sa fiche. Les changements faits ici valent pour cet envoi seulement." />
      </div>

      {!courrielConfigure && (
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", margin: "0 0 14px", padding: "10px 12px", borderRadius: 12, background: "var(--danger-fond)" }}>
          L'envoi de courriel n'est pas configuré sur cette installation (RESEND_API_KEY).
        </p>
      )}

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="Clients choisis" montant={`${choisis.size} / ${admissibles.length}`} teinte="var(--success)" couleur={choisis.size > 0 ? "var(--success)" : "var(--text)"} note="Avec un courriel valide" />
        <CarteChiffre titre="Sans courriel" montant={String(nbSansCourriel)} teinte="var(--avertissement)" note="Non offerts pour cet envoi" />
        <CarteChiffre titre="Désabonnés" montant={String(nbDesabonnes)} teinte="var(--danger)" note="Ne reçoivent plus nos courriels" />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="courriel" teinte={TEINTES.bleu} titre="Message" sousTitre={"Les champs comme {nom} se remplissent pour chaque client ; un champ vide dans une fiche est simplement retiré."} />
        <label className="etiquette" style={{ marginTop: 0 }}>Sujet du courriel</label>
        <input value={sujet} onChange={(e) => setSujet(e.target.value)} className="champ" />
        <label className="etiquette">Texte</label>
        <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} className="champ" rows={14} style={{ fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", marginBottom: 0 }} />
        {aCompleter.length > 0 && (
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--avertissement)", margin: "10px 0 0", padding: "8px 12px", borderRadius: 12, background: "var(--avertissement-fond)" }}>⚠️ À compléter avant l'envoi : {aCompleter.join(" · ")}</p>
        )}
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>
          Vos coordonnées et un lien de désabonnement sont ajoutés au bas de chaque courriel (exigé par la loi anti-pourriel).
        </p>
      </div>

      <div style={stylePanneau}>
        <TitrePanneau
          icone="utilisateurs" teinte={TEINTES.vert} titre="Clients"
          sousTitre="Coche les clients qui recevront la lettre ; « Aperçu » montre sa version remplie."
          droite={<Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>{choisis.size} / {admissibles.length}</Pastille>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <BoutonAction icone="crochet" compact onClick={() => choisirTous(true)}>Tout cocher</BoutonAction>
          <BoutonAction icone="bloque" compact couleur="var(--text-muted)" onClick={() => choisirTous(false)}>Tout décocher</BoutonAction>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 19, transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ" placeholder="Filtrer par nom, courriel ou ville…" style={{ paddingLeft: 40 }} />
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {visibles.map((c) => {
            const coche = choisis.has(c.id);
            return (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, cursor: "pointer", background: coche ? "var(--success-fond)" : "var(--bg)", border: `1px solid ${coche ? "var(--success)" : "var(--border)"}` }}>
                <input type="checkbox" checked={coche} onChange={() => basculer(c.id)} style={{ width: 18, height: 18, accentColor: "var(--success)", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.courriel}</span>
                </span>
                <button type="button" onClick={(e) => { e.preventDefault(); setApercuId(c.id); }} style={{ background: "none", border: "none", padding: 0, color: "var(--accent-ombre)", cursor: "pointer", fontWeight: 700, fontSize: 12.5, fontFamily: "inherit" }}>Aperçu</button>
              </label>
            );
          })}
          {visibles.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun client avec courriel{terme ? " ne correspond" : ""}.</p>}
        </div>
      </div>

      {valeursApercu && (
        <div style={stylePanneau}>
          <TitrePanneau icone="document" teinte={TEINTES.ambre} titre="Aperçu" sousTitre={`Tel que le recevra ${clientApercu.nom}`} />
          <div style={{ background: "white", color: "#17150f", borderRadius: 12, border: "1px solid var(--border)", padding: 16, fontFamily: "Arial, sans-serif" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{remplirModele(sujet, valeursApercu, "CLIENT", { effacerVides: true })}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55 }}>{remplirModele(contenu, valeursApercu, "CLIENT", { effacerVides: true })}</div>
          </div>
        </div>
      )}

      {etat.erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700 }}>{etat.erreur}</p>}
      {etat.resultat && (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 12, fontSize: 13.5, background: etat.resultat.envoyes > 0 ? "var(--success-fond)" : "var(--avertissement-fond)" }}>
          <strong style={{ color: etat.resultat.envoyes > 0 ? "var(--success)" : "var(--avertissement)" }}>
            {etat.resultat.envoyes} courriel{etat.resultat.envoyes > 1 ? "s" : ""} envoyé{etat.resultat.envoyes > 1 ? "s" : ""}.
          </strong>
          {etat.resultat.echecs.length > 0 && (
            <div style={{ color: "var(--danger)", marginTop: 6 }}>
              {etat.resultat.echecs.length} en échec : {etat.resultat.echecs[0].erreur}
              <div style={{ fontSize: 12, marginTop: 4 }}>{etat.resultat.echecs.map((e) => e.a).join(", ")}</div>
            </div>
          )}
        </div>
      )}
      <button onClick={envoyer} disabled={desactive} className="bouton-3d" style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 15, fontWeight: 700, marginBottom: 16, opacity: desactive && !etat.enCours ? 0.6 : 1 }}>
        {etat.enCours ? "Envoi en cours…" : etat.resultat ? "Envoi terminé" : `Envoyer à ${choisis.size} client${choisis.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
