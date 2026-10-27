"use client";

import { useState } from "react";
import Link from "next/link";
import { remplirModele, passagesACompleter, sujetParDefaut, valeursClient } from "@/lib/documents";

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
  const visibles = terme ? admissibles.filter((c) => [c.nom, c.courriel, c.ville].some((v) => v?.toLowerCase().includes(terme))) : admissibles;
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

  return (
    <div className="conteneur-page">
      <Link href="/gerant/documents" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux documents</Link>
      <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>📢 Envoi groupé — {modele.nom}</h1>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 14px" }}>
        Chaque client reçoit la lettre remplie avec sa fiche. Les changements faits ici valent pour cet envoi seulement.
      </p>

      {!courrielConfigure && (
        <div className="carte carte-s" style={{ marginBottom: 14, color: "var(--danger)", fontSize: 13 }}>L'envoi de courriel n'est pas configuré sur cette installation (RESEND_API_KEY).</div>
      )}

      <div className="carte" style={{ marginBottom: 14 }}>
        <label className="etiquette" style={{ marginTop: 0 }}>Sujet du courriel</label>
        <input value={sujet} onChange={(e) => setSujet(e.target.value)} className="champ" />
        <label className="etiquette">Texte (les champs comme {"{nom}"} se remplissent pour chaque client)</label>
        <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} className="champ" rows={14} style={{ fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }} />
        {aCompleter.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--avertissement)", margin: "8px 0 0" }}>⚠️ À compléter avant l'envoi : {aCompleter.join(" · ")}</p>
        )}
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
          Vos coordonnées et un lien de désabonnement sont ajoutés au bas de chaque courriel (exigé par la loi anti-pourriel). Un champ vide dans la fiche d'un client est simplement retiré.
        </p>
      </div>

      <div className="carte" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Clients : {choisis.size} sur {admissibles.length}</div>
          <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
            <button onClick={() => choisirTous(true)} style={lienBouton}>Tout cocher</button>
            <button onClick={() => choisirTous(false)} style={lienBouton}>Tout décocher</button>
          </div>
        </div>
        {(nbSansCourriel > 0 || nbDesabonnes > 0) && (
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            Non offerts : {[nbSansCourriel > 0 && `${nbSansCourriel} sans courriel`, nbDesabonnes > 0 && `${nbDesabonnes} désabonné${nbDesabonnes > 1 ? "s" : ""}`].filter(Boolean).join(", ")}
          </div>
        )}
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ" placeholder="🔍 Filtrer par nom, courriel ou ville…" style={{ marginTop: 10 }} />
        <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {visibles.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={choisis.has(c.id)} onChange={() => basculer(c.id)} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.nom} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>· {c.courriel}</span>
              </span>
              <button type="button" onClick={(e) => { e.preventDefault(); setApercuId(c.id); }} style={{ ...lienBouton, fontSize: 11 }}>Aperçu</button>
            </label>
          ))}
          {visibles.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun client avec courriel{terme ? " ne correspond" : ""}.</p>}
        </div>
      </div>

      {valeursApercu && (
        <div className="carte" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Aperçu — {clientApercu.nom}</div>
          <div style={{ background: "white", color: "#17150f", borderRadius: 8, padding: 16, fontFamily: "Arial, sans-serif" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{remplirModele(sujet, valeursApercu, "CLIENT", { effacerVides: true })}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55 }}>{remplirModele(contenu, valeursApercu, "CLIENT", { effacerVides: true })}</div>
          </div>
        </div>
      )}

      {etat.erreur && <p style={{ color: "var(--danger)", fontSize: 13 }}>{etat.erreur}</p>}
      {etat.resultat && (
        <div className="carte carte-s" style={{ marginBottom: 14, fontSize: 13 }}>
          {etat.resultat.envoyes > 0 ? "✅" : "⚠️"} {etat.resultat.envoyes} courriel{etat.resultat.envoyes > 1 ? "s" : ""} envoyé{etat.resultat.envoyes > 1 ? "s" : ""}.
          {etat.resultat.echecs.length > 0 && (
            <div style={{ color: "var(--danger)", marginTop: 6 }}>
              {etat.resultat.echecs.length} en échec : {etat.resultat.echecs[0].erreur}
              <div style={{ fontSize: 11.5, marginTop: 4 }}>{etat.resultat.echecs.map((e) => e.a).join(", ")}</div>
            </div>
          )}
        </div>
      )}
      <button
        onClick={envoyer}
        disabled={etat.enCours || !!etat.resultat || !courrielConfigure || choisis.size === 0 || aCompleter.length > 0 || !sujet.trim() || !contenu.trim()}
        className="bouton-3d" style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700 }}
      >
        {etat.enCours ? "Envoi en cours…" : etat.resultat ? "Envoi terminé" : `✉️ Envoyer à ${choisis.size} client${choisis.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

const lienBouton = { background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", fontWeight: 600 };
