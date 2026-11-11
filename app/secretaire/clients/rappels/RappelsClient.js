"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { Panneau, Pastille } from "../../../components/StyleSection";
import { nombre } from "@/lib/format";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Toronto" });
const moisDepuis = (date) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (30.44 * 86400000)));

const ETATS = {
  SANS_COURRIEL: { label: "Pas de courriel", couleur: "var(--text-muted)" },
  DESABONNE: { label: "Désabonné", couleur: "var(--danger)" },
};

export default function RappelsClient({ vehicules, reglages, apercu, courrielConfigure, peutRegler }) {
  const router = useRouter();
  const prets = vehicules.filter((v) => v.etat === "PRET");
  const autres = vehicules.filter((v) => v.etat !== "PRET");
  const [coches, setCoches] = useState(() => new Set(prets.map((v) => v.id)));
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null); // { texte, erreur }
  const [apercuOuvert, setApercuOuvert] = useState(false);

  const nbClients = new Set(prets.filter((v) => coches.has(v.id)).map((v) => v.client.id)).size;

  function basculer(id) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id); else apres.add(id);
      return apres;
    });
  }

  async function envoyer() {
    if (!window.confirm(`Envoyer un rappel d'entretien par courriel à ${nbClients} client${nbClients > 1 ? "s" : ""} ?`)) return;
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/rappels-entretien", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehiculeIds: [...coches] }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "L'envoi a échoué.", erreur: true });
    const refuses = data.echecs.length;
    setMessage({
      texte: `${data.envoyes} rappel${data.envoyes > 1 ? "s" : ""} envoyé${data.envoyes > 1 ? "s" : ""}.${refuses ? ` ${refuses} refusé${refuses > 1 ? "s" : ""} : ${data.echecs.map((e) => e.a).join(", ")}.` : ""}`,
      erreur: refuses > 0,
    });
    router.refresh();
  }

  return (
    <div className="conteneur-page">
      <Link href="/secretaire/clients" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux clients</Link>
      <div style={{ marginTop: 10 }}>
        <BandeauSection
          icone="🔔" titre="Rappels d'entretien"
          sousTitre={`Véhicules qui ne sont pas revenus depuis ${reglages.mois} mois ou plus. Un courriel invite le client à reprendre rendez-vous — un seul rappel par visite.`}
        />
      </div>

      <Reglages reglages={reglages} peutRegler={peutRegler} courrielConfigure={courrielConfigure} />

      {!courrielConfigure && (
        <p role="alert" style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 12px" }}>
          L&apos;envoi de courriel n&apos;est pas configuré sur cette installation : les rappels ne peuvent pas partir.
        </p>
      )}

      <Panneau
        titre={`À relancer par courriel (${prets.length})`}
        action={prets.length > 0 && (
          <button onClick={() => setCoches(coches.size === prets.length ? new Set() : new Set(prets.map((v) => v.id)))} style={lienBouton}>
            {coches.size === prets.length ? "Tout décocher" : "Tout cocher"}
          </button>
        )}
      >
        {prets.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>Aucun véhicule à relancer pour l&apos;instant.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {prets.map((v) => <Ligne key={v.id} v={v} coche={coches.has(v.id)} onBasculer={() => basculer(v.id)} />)}
            </div>
            <button onClick={() => setApercuOuvert((o) => !o)} style={{ ...lienBouton, marginTop: 12 }}>
              {apercuOuvert ? "Masquer le courriel" : "Voir le courriel qui sera envoyé"}
            </button>
            {apercuOuvert && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Objet : {apercu.sujet}</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{apercu.texte}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>Suivi des coordonnées de l&apos;entreprise et du lien de désabonnement.</div>
              </div>
            )}
            {message && <p role="status" style={{ fontSize: 13, color: message.erreur ? "var(--danger)" : "var(--success)", margin: "12px 0 0" }}>{message.texte}</p>}
            <button
              onClick={envoyer} disabled={enCours || nbClients === 0 || !courrielConfigure} className="bouton-3d"
              style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, fontSize: 14, fontWeight: 700, opacity: nbClients === 0 || !courrielConfigure ? 0.5 : 1 }}
            >
              {enCours ? "Envoi…" : nbClients === 0 ? "Coche au moins un véhicule" : `Envoyer le rappel à ${nbClients} client${nbClients > 1 ? "s" : ""}`}
            </button>
          </>
        )}
        {prets.length === 0 && message && <p role="status" style={{ fontSize: 13, color: message.erreur ? "var(--danger)" : "var(--success)", margin: "12px 0 0" }}>{message.texte}</p>}
      </Panneau>

      {autres.length > 0 && (
        <Panneau titre={`À joindre autrement (${autres.length})`}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 6px" }}>
            Sans courriel au dossier, ou désabonnés des courriels : aucun rappel ne part. Un appel fait le même travail.
          </p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {autres.map((v) => <Ligne key={v.id} v={v} />)}
          </div>
        </Panneau>
      )}
    </div>
  );
}

function Ligne({ v, coche, onBasculer }) {
  const etat = ETATS[v.etat];
  const mois = moisDepuis(v.derniereVisite);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      {onBasculer && (
        <input type="checkbox" checked={coche} onChange={onBasculer} aria-label={`Rappel pour ${v.client.nom}, ${v.vehicule}`} style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/secretaire/clients/${v.client.id}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>{v.client.nom}</Link>
          <span style={{ fontSize: 12.5, color: mois >= 12 ? "var(--danger)" : "var(--text-muted)", fontWeight: mois >= 12 ? 700 : 400 }}>il y a {mois} mois</span>
        </div>
        <div style={{ fontSize: 13 }}>
          {v.vehicule}{v.plaque ? ` · ${v.plaque}` : ""}{v.kilometrage ? ` · ${nombre(v.kilometrage, 0)} km` : ""}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Dernière visite le {DATE.format(new Date(v.derniereVisite))} — <Link href={`/bons/${v.bon.id}`} style={{ color: "var(--accent-ombre)" }}>bon #{v.bon.numero}</Link>
          {v.bon.travaux.length > 0 && ` : ${v.bon.travaux.join(" ; ")}`}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {etat ? <Pastille couleur={etat.couleur} fond="var(--bg)">{etat.label}</Pastille> : <span>{v.client.courriel}</span>}
          {v.client.telephone && <a href={`tel:${v.client.telephone.replace(/[^\d+]/g, "")}`} style={{ color: "var(--accent-ombre)" }}>{v.client.telephone}</a>}
        </div>
      </div>
    </div>
  );
}

// Délai, lien de réservation et envoi automatique — modifiables par un gérant
function Reglages({ reglages, peutRegler, courrielConfigure }) {
  const router = useRouter();
  const [mois, setMois] = useState(String(reglages.mois));
  const [lien, setLien] = useState(reglages.lien);
  const [auto, setAuto] = useState(reglages.auto);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function enregistrer(corps) {
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/rappels-entretien", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) {
      setMessage({ texte: data?.erreur || "Le réglage n'a pas pu être enregistré.", erreur: true });
      return false;
    }
    setMessage({ texte: "Enregistré ✓" });
    router.refresh();
    return true;
  }

  async function basculerAuto() {
    const nouveau = !auto;
    if (nouveau && !window.confirm(`Activer l'envoi automatique ? Chaque jour, les clients dont le véhicule n'est pas revenu depuis ${reglages.mois} mois reçoivent le rappel par courriel, sans intervention (au plus 40 clients par jour).`)) return;
    if (await enregistrer({ auto: nouveau })) setAuto(nouveau);
  }

  if (!peutRegler) {
    return (
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Envoi automatique : {reglages.auto ? "actif, chaque jour" : "inactif — les rappels partent seulement d'ici"}. Réglages modifiables par un gérant.
      </p>
    );
  }

  return (
    <Panneau titre="Réglages">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 150px" }}>
          <label htmlFor="rappel-mois" style={etiquette}>Relancer après (mois)</label>
          <input id="rappel-mois" type="number" min={1} max={36} value={mois} onChange={(e) => setMois(e.target.value)} style={champ} />
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <label htmlFor="rappel-lien" style={etiquette}>Lien de réservation en ligne (facultatif)</label>
          <input id="rappel-lien" type="url" placeholder="https://…" value={lien} onChange={(e) => setLien(e.target.value)} style={champ} />
        </div>
        <button onClick={() => enregistrer({ mois, lien })} disabled={enCours} className="bouton-3d" style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          Enregistrer
        </button>
      </div>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 13.5, cursor: "pointer" }}>
        <input type="checkbox" checked={auto} onChange={basculerAuto} disabled={enCours || (!auto && !courrielConfigure)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
        <span>
          <strong>Envoyer automatiquement chaque jour</strong>
          <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>
            Inactif : les rappels partent seulement quand tu les envoies d&apos;ici. Actif : ils partent seuls, en journée, au plus 40 clients par jour.
          </span>
        </span>
      </label>
      {message && <p role="status" style={{ fontSize: 12.5, color: message.erreur ? "var(--danger)" : "var(--success)", margin: "8px 0 0" }}>{message.texte}</p>}
    </Panneau>
  );
}

const etiquette = { display: "block", fontSize: 11.5, color: "var(--text-muted)", marginBottom: 3 };
const champ = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" };
const lienBouton = { background: "none", border: "none", padding: 0, fontSize: 12.5, color: "var(--accent-ombre)", textDecoration: "underline", cursor: "pointer" };
