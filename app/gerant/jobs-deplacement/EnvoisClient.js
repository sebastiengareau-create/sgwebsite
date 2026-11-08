"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STATUTS_ENVOI, STATUTS_ACTIFS, resumeAvis } from "@/lib/statutsEnvoi";
import { dateCourteQuebec, heureQuebec } from "@/lib/regroupementDates";
import { correspondRecherche } from "@/lib/recherche";
import { Icone, TEINTES, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../../components/StyleSection";

function texteVehicule(v) {
  return v ? [v.annee, v.marque, v.modele].filter(Boolean).join(" ") : "";
}

export default function EnvoisClient({ bons, employes, envois, bonInitial }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [bonId, setBonId] = useState(bons.some((b) => b.id === bonInitial) ? bonInitial : "");
  const [choisis, setChoisis] = useState([]);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultats, setResultats] = useState(null);

  const q = recherche.trim().toLowerCase();
  const bonsFiltres = bons.filter((b) => correspondRecherche(q, b.numero, b.client.nom));
  const bon = bons.find((b) => b.id === bonId);

  function basculer(id) {
    setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  async function envoyer() {
    setErreur("");
    setResultats(null);
    setEnvoi(true);
    const res = await fetch("/api/envois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonId, employeIds: choisis, message }),
    });
    const data = await res.json().catch(() => ({}));
    setEnvoi(false);
    if (!res.ok) {
      setErreur(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    setResultats(data.resultats);
    setChoisis([]);
    setMessage("");
    router.refresh();
  }

  const actifs = envois.filter((e) => STATUTS_ACTIFS.includes(e.statut));
  const fermes = envois.filter((e) => !STATUTS_ACTIFS.includes(e.statut));

  const adresseBon = bon ? [bon.client.adresse, bon.client.ville].filter(Boolean).join(", ") : "";

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "16px 16px 0" }}>
      <div style={stylePanneau}>
        <TitrePanneau
          icone="presse" teinte={TEINTES.ambre} titre="Envoyer un bon à des employés"
          sousTitre="L'employé est averti par une notification sur son téléphone (gratuit — il l'active une fois dans « Mes tâches »). Sans notification, il reçoit un courriel."
        />

        <Etape numero={1} titre="Bon" />
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 19, transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
            <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
          </span>
          <input className="champ champ-espace" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Filtrer par numéro ou client…" style={{ paddingLeft: 40 }} />
        </div>
        <select className="champ champ-espace" value={bonId} onChange={(e) => setBonId(e.target.value)}>
          <option value="">— Choisir un bon non facturé —</option>
          {bonsFiltres.map((b) => (
            <option key={b.id} value={b.id}>
              #{b.numero} — {b.client.nom}{texteVehicule(b.vehicule) ? ` — ${texteVehicule(b.vehicule)}` : ""}
            </option>
          ))}
        </select>
        {bon && (
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 14.5 }}>Bon #{bon.numero} — {bon.client.nom}</strong>
              {bon.datePrevue && <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{dateCourteQuebec(bon.datePrevue)} à {heureQuebec(bon.datePrevue)}</Pastille>}
            </div>
            {adresseBon && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}><Icone nom="epingle" taille={14} couleur="var(--text-muted)" /> {adresseBon}</div>}
            {bon.problemes.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {bon.problemes.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 13 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                    <span>{p.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Etape numero={2} titre="Employé(s)" droite={choisis.length > 0 && <Pastille couleur="var(--success)" fond="var(--success-fond)">{choisis.length} choisi{choisis.length > 1 ? "s" : ""}</Pastille>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 14 }}>
          {employes.map((e) => {
            const coche = choisis.includes(e.id);
            const notif = e._count.abonnementsPush > 0;
            return (
              <label
                key={e.id}
                style={{
                  display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                  border: `1px solid ${coche ? "var(--success)" : "var(--border)"}`, background: coche ? "var(--success-fond)" : "var(--bg)",
                }}
              >
                <input type="checkbox" checked={coche} onChange={() => basculer(e.id)} style={{ width: 18, height: 18, accentColor: "var(--success)", flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, display: "block" }}>{e.nom}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: notif ? "var(--success)" : "var(--avertissement)", fontWeight: 600 }}>
                    <Icone nom="cloche" taille={13} couleur={notif ? "var(--success)" : "var(--avertissement)"} />
                    {notif ? "Notifications activées" : "Pas de notifications"}
                  </span>
                  {e.assignation && <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{e.assignation}</span>}
                </span>
              </label>
            );
          })}
        </div>

        <Etape numero={3} titre="Note (facultative, incluse dans l'avis)" />
        <textarea
          className="champ champ-espace"
          rows={2}
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="ex. Client disponible après 13 h, apporter le cric hydraulique"
          style={{ resize: "vertical" }}
        />

        <button
          className="bouton-3d"
          onClick={envoyer}
          disabled={envoi || !bonId || choisis.length === 0}
          style={{ width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, opacity: !bonId || choisis.length === 0 ? 0.55 : 1 }}
        >
          {envoi ? "Envoi…" : choisis.length > 1 ? `Envoyer aux ${choisis.length} employés` : "Envoyer le bon"}
        </button>
        {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, marginTop: 8 }}>{erreur}</p>}
        {resultats && (
          <div style={{ marginTop: 12, padding: "4px 12px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)" }}>
            {resultats.map((r, i) => {
              const ok = resumeAvis(r).ok;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <Icone nom={ok ? "crochet" : "alerte"} taille={15} couleur={ok ? "var(--success)" : "var(--avertissement)"} />
                  <span><strong>{r.employe}</strong> : {r.dejaEnvoye ? "avait déjà ce bon — " : "envoyé — "}{resumeAvis(r).texte}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau
          icone="vehicule" teinte={TEINTES.ambre} titre="En cours"
          sousTitre={actifs.length === 0 ? "Aucun bon envoyé en attente." : "Bons envoyés, pas encore terminés."}
          droite={<Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.16)">{actifs.length}</Pastille>}
        />
        <div style={{ display: "grid", gap: 10 }}>{actifs.map((e) => <LigneEnvoi key={e.id} envoi={e} />)}</div>
      </div>

      {fermes.length > 0 && (
        <div style={stylePanneau}>
          <TitrePanneau
            icone="crochet" teinte={TEINTES.vert} titre="Fermés — 7 derniers jours"
            droite={<Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>{fermes.length}</Pastille>}
          />
          <div style={{ display: "grid", gap: 10 }}>{fermes.map((e) => <LigneEnvoi key={e.id} envoi={e} />)}</div>
        </div>
      )}
    </div>
  );
}

// Titre d'une étape du formulaire d'envoi, avec son numéro en tuile
function Etape({ numero, titre, droite }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }}>
      <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: "var(--accent)", color: "#221f18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800 }}>{numero}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{titre}</span>
      {droite}
    </div>
  );
}

function LigneEnvoi({ envoi }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [info, setInfo] = useState("");
  const statut = STATUTS_ENVOI[envoi.statut];
  const actif = STATUTS_ACTIFS.includes(envoi.statut);

  async function action(url, options, confirmation) {
    if (confirmation && !confirm(confirmation)) return;
    setOccupe(true);
    setInfo("");
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    setOccupe(false);
    if (!res.ok) {
      setInfo(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    if (data.avisPar) setInfo(resumeAvis(data).texte);
    router.refresh();
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 12px 12px 16px", opacity: actif ? 1 : 0.8 }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: statut.color }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
          {envoi.employe.nom.charAt(0).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>{envoi.employe.nom}</span>
            <Pastille couleur={statut.color} fond="var(--surface)">{statut.label}</Pastille>
          </div>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            <Link href={`/bons/${envoi.bon.id}`} style={{ color: "var(--accent-ombre)", fontWeight: 700, textDecoration: "none" }}>Bon #{envoi.bon.numero}</Link> — {envoi.bon.client.nom}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Envoyé le {dateCourteQuebec(envoi.envoyeLe)} à {heureQuebec(envoi.envoyeLe)}{envoi.envoyePar ? ` par ${envoi.envoyePar}` : ""}
            {" · "}
            <span style={{ color: resumeAvis(envoi).ok ? "var(--text-muted)" : "var(--avertissement)", fontWeight: resumeAvis(envoi).ok ? 400 : 700 }}>{resumeAvis(envoi).texte}</span>
            {envoi.termineLe && ` · fermé à ${heureQuebec(envoi.termineLe)}`}
          </div>
          {envoi.message && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, padding: "6px 10px", borderRadius: 10, background: "rgba(232,163,61,0.12)" }}>« {envoi.message} »</div>}
          {info && <div style={{ fontSize: 12.5, color: "var(--avertissement)", fontWeight: 600, marginTop: 4 }}>{info}</div>}
        </div>
      </div>
      {actif && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <BoutonAction icone="cloche" compact disabled={occupe} onClick={() => action(`/api/envois/${envoi.id}/avis`, { method: "POST" })}>Aviser de nouveau</BoutonAction>
          <BoutonAction
            icone="bloque" compact couleur="var(--danger)" disabled={occupe}
            onClick={() => action(`/api/envois/${envoi.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "ANNULE" }) }, `Annuler l'envoi du bon #${envoi.bon.numero} à ${envoi.employe.nom} ?`)}
          >
            Annuler l'envoi
          </BoutonAction>
        </div>
      )}
    </div>
  );
}
