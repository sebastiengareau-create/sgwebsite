"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../components/BandeauSection";
import ActivationNotifications from "../components/ActivationNotifications";
import { depuis } from "../components/Cloche";
import { TYPES_NOTIFICATIONS, FREQUENCES_CEDULEES, JOURS_SEMAINE } from "@/lib/typesNotifications";
import { Icone, TEINTES, Pastille, TitrePanneau, BoutonAction, stylePanneau } from "../components/StyleSection";

const TYPES = Object.entries(TYPES_NOTIFICATIONS);

async function envoyer(url, methode, corps) {
  const res = await fetch(url, { method: methode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erreur || `Erreur (code ${res.status}).`);
  return data;
}

export default function NotificationsClient({ estEmploye, notificationsInitiales, coupeesInitiales, clePublique, gestion }) {
  return (
    <div className="conteneur-page">
      <BandeauSection icone="🔔" titre="Notifications" sousTitre="Tes avis récents, aussi sur ton téléphone même l'app fermée." />
      {estEmploye && (
        <>
          <ActivationNotifications clePublique={clePublique} />
          <Historique notificationsInitiales={notificationsInitiales} />
          {gestion?.peutRegler && <Preferences coupeesInitiales={coupeesInitiales} />}
        </>
      )}
      {gestion && (
        <>
          <QuiAActive abonnes={gestion.abonnes} />
          {gestion.peutEnvoyer && <EnvoiMessage gestion={gestion} />}
          {gestion.peutEnvoyer && <NotificationsCedulees gestion={gestion} />}
          {gestion.peutRegler && <QuiRecoitQuoi gestion={gestion} />}
        </>
      )}
    </div>
  );
}

function Historique({ notificationsInitiales }) {
  const [notifications, setNotifications] = useState(notificationsInitiales);
  const router = useRouter();
  const nonLues = notifications.filter((n) => !n.lue).length;

  async function ouvrir(n) {
    if (!n.lue) {
      setNotifications((liste) => liste.map((x) => (x.id === n.id ? { ...x, lue: true } : x)));
      await envoyer("/api/notifications/lues", "POST", { ids: [n.id] }).catch(() => {});
    }
    if (n.url) router.push(n.url);
    else router.refresh();
  }

  async function toutLire() {
    setNotifications((liste) => liste.map((x) => ({ ...x, lue: true })));
    await envoyer("/api/notifications/lues", "POST", { toutes: true }).catch(() => {});
    router.refresh();
  }

  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone="cloche" teinte={TEINTES.ambre} titre="Reçues"
        sousTitre={notifications.length === 0 ? undefined : nonLues > 0 ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Tout est lu"}
        droite={nonLues > 0 && <button onClick={toutLire} style={{ ...boutonLien, whiteSpace: "nowrap", marginTop: 4 }}>Tout marquer lu</button>}
      />
      {notifications.length === 0 && <Vide>Aucune notification pour l'instant.</Vide>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => ouvrir(n)}
            style={{
              position: "relative", overflow: "hidden", textAlign: "left", padding: "11px 14px 11px 16px", borderRadius: 12, cursor: "pointer", color: "var(--text)", fontFamily: "inherit",
              border: `1px solid ${n.lue ? "var(--border)" : "var(--accent)"}`, background: n.lue ? "var(--surface)" : TEINTES.ambre.fond,
            }}
          >
            {!n.lue && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--accent)" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: n.lue ? 600 : 800, minWidth: 0, overflowWrap: "anywhere" }}>{n.titre}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{depuis(n.creeLe)}</span>
            </div>
            {n.corps && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.corps}</div>}
          </button>
        ))}
      </div>
      {notifications.length > 0 && <Aide>Les notifications sont effacées après 60 jours.</Aide>}
    </div>
  );
}

function Preferences({ coupeesInitiales }) {
  const [coupees, setCoupees] = useState(coupeesInitiales);
  const [erreur, setErreur] = useState("");

  async function basculer(type) {
    const avant = coupees;
    const apres = coupees.includes(type) ? coupees.filter((t) => t !== type) : [...coupees, type];
    setCoupees(apres);
    setErreur("");
    try {
      await envoyer("/api/notifications/preferences", "PUT", { coupees: apres });
    } catch (e) {
      setCoupees(avant);
      setErreur(e.message);
    }
  }

  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="reglages" teinte={TEINTES.vert} titre="Ce que je veux recevoir" sousTitre="Tu reçois un type seulement s'il te concerne ou si ton rôle est coché dans « Qui reçoit quoi »." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TYPES.map(([type, t]) => {
          const recu = t.obligatoire || !coupees.includes(type);
          return (
            <label key={type} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 12, border: `1px solid ${recu ? "var(--success)" : "var(--border)"}`, background: recu ? TEINTES.vert.fond : "var(--surface)", cursor: t.obligatoire ? "default" : "pointer" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t.icone} {t.label}</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{t.description}</span>
                {t.obligatoire && <span style={{ display: "inline-block", marginTop: 6 }}><Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Toujours reçu</Pastille></span>}
              </span>
              <input type="checkbox" checked={recu} disabled={t.obligatoire} onChange={() => basculer(type)} style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--success)" }} />
            </label>
          );
        })}
      </div>
      <MessageInfo texte={erreur} erreur />
    </div>
  );
}

function EnvoiMessage({ gestion }) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("tous"); // "tous" | "roles" | "employes"
  const [roles, setRoles] = useState([]);
  const [employeIds, setEmployeIds] = useState([]);
  const [occupe, setOccupe] = useState(false);
  const [info, setInfo] = useState({ texte: "", erreur: false });

  const basculer = (liste, setListe, valeur) => setListe(liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]);

  async function soumettre(e) {
    e.preventDefault();
    setOccupe(true);
    setInfo({ texte: "", erreur: false });
    try {
      const data = await envoyer("/api/notifications/message", "POST", {
        message,
        tous: mode === "tous",
        roles: mode === "roles" ? roles : [],
        employeIds: mode === "employes" ? employeIds : [],
      });
      setMessage("");
      setInfo({ texte: `Envoyé à ${data.destinataires} employé${data.destinataires > 1 ? "s" : ""} — ${data.telephones} l'${data.telephones > 1 ? "ont" : "a"} reçu sur son téléphone, les autres le verront à la cloche 🔔.`, erreur: false });
    } catch (err) {
      setInfo({ texte: err.message, erreur: true });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <form style={stylePanneau} onSubmit={soumettre}>
      <TitrePanneau icone="courriel" teinte={TEINTES.ambre} titre="Envoyer un message à l'équipe" sousTitre="Reçu sur le téléphone de ceux qui ont activé les notifications, et à la cloche 🔔 pour tous." />
      <label style={{ ...labelStyle, marginTop: 0 }}>Message</label>
      <textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : Réunion d'équipe demain à 8 h." required style={{ ...champInput, resize: "vertical" }} />
      <label style={labelStyle}>Destinataires</label>
      <Puces>
        <Puce actif={mode === "tous"} onClick={() => setMode("tous")}>Toute l'équipe</Puce>
        <Puce actif={mode === "roles"} onClick={() => setMode("roles")}>Par rôle</Puce>
        <Puce actif={mode === "employes"} onClick={() => setMode("employes")}>Employés précis</Puce>
      </Puces>
      {mode === "roles" && (
        <SousChoix titre="Rôles">
          {gestion.roles.map((r) => <Puce key={r.cle} coche actif={roles.includes(r.cle)} onClick={() => basculer(roles, setRoles, r.cle)}>{r.nom}</Puce>)}
        </SousChoix>
      )}
      {mode === "employes" && (
        <SousChoix titre="Employés">
          {gestion.employes.map((e) => <Puce key={e.id} coche actif={employeIds.includes(e.id)} onClick={() => basculer(employeIds, setEmployeIds, e.id)}>{e.nom}</Puce>)}
          {gestion.employes.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Aucun autre employé actif.</span>}
        </SousChoix>
      )}
      <button type="submit" className="bouton-3d" disabled={occupe || !message.trim()} style={{ ...boutonPrincipal, marginTop: 14 }}>
        {occupe ? "Envoi…" : "Envoyer le message"}
      </button>
      <MessageInfo texte={info.texte} erreur={info.erreur} />
    </form>
  );
}

// Modèles rapides : remplissent le titre, le reste se choisit
const MODELES_CEDULES = ["☕ Début du break", "☕ Fin du break", "🍽️ Début du dîner", "🍽️ Fin du dîner"];
const CEDULEE_VIDE = { titre: "", message: "", heure: "12:00", frequence: "SEMAINE", jours: [], date: "", tous: true, roles: [], employeIds: [] };

const formatHeure = (hhmm) => `${Number(hhmm.slice(0, 2))} h ${hhmm.slice(3)}`;

function resumeFrequence(c) {
  if (c.frequence === "JOURS") return Object.keys(JOURS_SEMAINE).filter((j) => c.jours.includes(j)).map((j) => JOURS_SEMAINE[j]).join(", ");
  if (c.frequence === "UNE_FOIS") {
    const [an, mois, jour] = c.date.split("-").map(Number);
    const date = new Date(an, mois - 1, jour).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
    return `Le ${date}${!c.actif && c.dernierEnvoi ? " · envoyée" : ""}`;
  }
  return FREQUENCES_CEDULEES[c.frequence];
}

function resumeDestinataires(c, gestion) {
  if (c.tous) return "Toute l'équipe";
  const noms = [
    ...gestion.roles.filter((r) => c.roles.includes(r.cle)).map((r) => r.nom),
    ...gestion.equipe.filter((e) => c.employeIds.includes(e.id)).map((e) => e.nom),
  ];
  return noms.join(", ") || "Personne (employés retirés)";
}

function NotificationsCedulees({ gestion }) {
  const [cedulees, setCedulees] = useState(gestion.cedulees);
  const [edition, setEdition] = useState(null); // null | { id?, ...champs }
  const [aSupprimer, setASupprimer] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  const trier = (liste) => [...liste].sort((a, b) => a.heure.localeCompare(b.heure));
  const remplacer = (c) => setCedulees((liste) => trier(liste.some((x) => x.id === c.id) ? liste.map((x) => (x.id === c.id ? c : x)) : [...liste, c]));

  async function enregistrer(e) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");
    try {
      const { id, ...champs } = edition;
      const data = await envoyer(id ? `/api/notifications/cedulees/${id}` : "/api/notifications/cedulees", id ? "PUT" : "POST", champs);
      remplacer(data.cedulee);
      setEdition(null);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  }

  async function basculerActif(c) {
    setErreur("");
    try {
      const data = await envoyer(`/api/notifications/cedulees/${c.id}`, "PUT", { actif: !c.actif });
      remplacer(data.cedulee);
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimer(id) {
    setErreur("");
    try {
      await envoyer(`/api/notifications/cedulees/${id}`, "DELETE", {});
      setCedulees((liste) => liste.filter((x) => x.id !== id));
      setASupprimer(null);
    } catch (err) {
      setErreur(err.message);
    }
  }

  const modifier = (c) => {
    setErreur("");
    setEdition({ id: c.id, titre: c.titre, message: c.message || "", heure: c.heure, frequence: c.frequence, jours: c.jours, date: c.date || "", tous: c.tous, roles: c.roles, employeIds: c.employeIds });
  };
  const champ = (cle, valeur) => setEdition((ed) => ({ ...ed, [cle]: valeur }));
  const basculerDans = (cle, valeur) => setEdition((ed) => ({ ...ed, [cle]: ed[cle].includes(valeur) ? ed[cle].filter((v) => v !== valeur) : [...ed[cle], valeur] }));

  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="horloge" teinte={TEINTES.bleu} titre="Notifications cédulées" sousTitre="Envoyées toutes seules à l'heure choisie — ex. le début et la fin du break ou du dîner." />

      {cedulees.length === 0 && !edition && <Vide>Aucune notification cédulée.</Vide>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {cedulees.map((c) => {
          const envoyee = c.frequence === "UNE_FOIS" && !c.actif && c.dernierEnvoi;
          return (
            <div key={c.id} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: c.actif ? "var(--surface)" : "var(--surface-alt)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: c.actif ? 1 : 0.65 }}>
                <span style={{ flexShrink: 0, minWidth: 58, padding: "7px 6px", borderRadius: 10, background: TEINTES.bleu.fond, color: TEINTES.bleu.couleur, fontSize: 13.5, fontWeight: 800, textAlign: "center", whiteSpace: "nowrap" }}>
                  {formatHeure(c.heure)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, overflowWrap: "anywhere" }}>{c.titre}</span>
                    {!c.actif && !envoyee && <Pastille couleur="var(--avertissement)" fond={TEINTES.ambre.fond}>En pause</Pastille>}
                    {envoyee && <Pastille couleur="var(--success)" fond={TEINTES.vert.fond}>Envoyée</Pastille>}
                  </div>
                  {c.message && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.message}</div>}
                  <LigneIcone icone="echange">{resumeFrequence(c)}</LigneIcone>
                  <LigneIcone icone="utilisateurs">{resumeDestinataires(c, gestion)}</LigneIcone>
                </div>
              </div>
              {aSupprimer === c.id ? (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--danger-fond)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Supprimer cette notification cédulée ?</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <BoutonAction icone="poubelle" couleur="#fff" fond="var(--danger)" bordure="var(--danger)" compact onClick={() => supprimer(c.id)}>Oui, supprimer</BoutonAction>
                    <BoutonAction compact onClick={() => setASupprimer(null)}>Annuler</BoutonAction>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: envoyee ? "1fr 1fr" : "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
                  <BoutonAction icone="crayon" couleur="var(--accent-ombre)" compact onClick={() => modifier(c)}>Modifier</BoutonAction>
                  {!envoyee && <BoutonAction icone={c.actif ? "bloque" : "crochet"} compact onClick={() => basculerActif(c)}>{c.actif ? "Pause" : "Réactiver"}</BoutonAction>}
                  <BoutonAction icone="poubelle" couleur="var(--danger)" compact onClick={() => setASupprimer(c.id)}>Supprimer</BoutonAction>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!edition && (
        <button type="button" onClick={() => { setErreur(""); setEdition({ ...CEDULEE_VIDE }); }} style={boutonPointille}>
          + Ajouter une notification cédulée
        </button>
      )}

      {edition && (
        <form onSubmit={enregistrer} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--accent)", background: "var(--bg)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{edition.id ? "Modifier la notification" : "Nouvelle notification cédulée"}</div>
          <Puces>
            {MODELES_CEDULES.map((m) => <Puce key={m} actif={edition.titre === m} onClick={() => champ("titre", m)}>{m}</Puce>)}
          </Puces>
          <label style={labelStyle}>Titre</label>
          <input maxLength={80} value={edition.titre} onChange={(e) => champ("titre", e.target.value)} placeholder="Ex. : Début du dîner" required style={champInput} />
          <label style={labelStyle}>Message</label>
          <textarea rows={2} maxLength={500} value={edition.message} onChange={(e) => champ("message", e.target.value)} placeholder="Facultatif — ex. : Bon appétit! Retour à 12 h 30." style={{ ...champInput, resize: "vertical" }} />

          <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 8 }}>
            <div>
              <label style={labelStyle}>Heure</label>
              <input type="time" value={edition.heure} onChange={(e) => champ("heure", e.target.value)} required style={champInput} />
            </div>
            <div>
              <label style={labelStyle}>Fréquence</label>
              <select value={edition.frequence} onChange={(e) => champ("frequence", e.target.value)} style={champInput}>
                {Object.entries(FREQUENCES_CEDULEES).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
              </select>
            </div>
          </div>
          {edition.frequence === "JOURS" && (
            <SousChoix titre="Jours">
              {Object.entries(JOURS_SEMAINE).map(([cle, nom]) => <Puce key={cle} coche actif={edition.jours.includes(cle)} onClick={() => basculerDans("jours", cle)}>{nom}</Puce>)}
            </SousChoix>
          )}
          {edition.frequence === "UNE_FOIS" && (
            <>
              <label style={labelStyle}>Date</label>
              <input type="date" max="9999-12-31" value={edition.date} onChange={(e) => champ("date", e.target.value)} required style={champInput} />
            </>
          )}

          <label style={labelStyle}>Destinataires</label>
          <Puces>
            <Puce actif={edition.tous} onClick={() => champ("tous", true)}>Toute l'équipe</Puce>
            <Puce actif={!edition.tous} onClick={() => champ("tous", false)}>Rôles ou employés précis</Puce>
          </Puces>
          {!edition.tous && (
            <>
              <SousChoix titre="Rôles">
                {gestion.roles.map((r) => <Puce key={r.cle} coche actif={edition.roles.includes(r.cle)} onClick={() => basculerDans("roles", r.cle)}>{r.nom}</Puce>)}
              </SousChoix>
              <SousChoix titre="Employés">
                {gestion.equipe.map((e) => <Puce key={e.id} coche actif={edition.employeIds.includes(e.id)} onClick={() => basculerDans("employeIds", e.id)}>{e.nom}</Puce>)}
              </SousChoix>
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <button type="submit" className="bouton-3d" disabled={occupe || !edition.titre.trim()} style={{ ...boutonPrincipal, fontSize: 14 }}>
              {occupe ? "Enregistrement…" : "Enregistrer"}
            </button>
            <BoutonAction onClick={() => { setEdition(null); setErreur(""); }}>Annuler</BoutonAction>
          </div>
        </form>
      )}
      <MessageInfo texte={erreur} erreur />
    </div>
  );
}

// Nom court d'un appareil à partir de ce que le navigateur a envoyé à
// l'activation (navigator.userAgent) — ex. « iPhone · Safari »
function nomAppareil(ua) {
  if (!ua) return "Appareil inconnu";
  const systeme = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Appareil";
  const navigateur = /EdgA?\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : null;
  return navigateur ? `${systeme} · ${navigateur}` : systeme;
}

// Qui a accepté les notifications, et sur quels appareils. Un appareil où
// elles ont été coupées dans les réglages du téléphone ne disparaît de la
// liste qu'au prochain envoi qui échoue.
function QuiAActive({ abonnes }) {
  if (!abonnes) return null;
  const actives = abonnes.filter((e) => e.appareils.length > 0).length;
  const fmtDate = (d) => new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone="telephone" teinte={TEINTES.bleu} titre="Qui a activé les notifications"
        sousTitre="Sans notifications activées, les avis restent seulement dans la cloche de l'appli."
        droite={<span style={{ marginTop: 4 }}><Pastille couleur={actives === abonnes.length ? "var(--success)" : "var(--avertissement)"} fond={actives === abonnes.length ? TEINTES.vert.fond : TEINTES.ambre.fond}>{actives} / {abonnes.length}</Pastille></span>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {abonnes.map((e) => {
          const actif = e.appareils.length > 0;
          return (
            <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: actif ? TEINTES.vert.fond : "var(--surface-alt)", color: actif ? "var(--success)" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
                {e.nom.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{e.nom}</span>
                  {actif
                    ? <Pastille couleur="var(--success)" fond={TEINTES.vert.fond}>{e.appareils.length} appareil{e.appareils.length > 1 ? "s" : ""}</Pastille>
                    : <Pastille couleur="var(--avertissement)" fond={TEINTES.ambre.fond}>Pas activées</Pastille>}
                </div>
                {e.appareils.map((a) => (
                  <div key={a.id} style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    {nomAppareil(a.appareil)} — depuis le {fmtDate(a.creeLe)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuiRecoitQuoi({ gestion }) {
  const [rolesParType, setRolesParType] = useState(gestion.rolesParType);
  const [modifie, setModifie] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [info, setInfo] = useState({ texte: "", erreur: false });

  function basculer(type, role) {
    const liste = rolesParType[type] || [];
    setRolesParType({ ...rolesParType, [type]: liste.includes(role) ? liste.filter((r) => r !== role) : [...liste, role] });
    setModifie(true);
    setInfo({ texte: "", erreur: false });
  }

  async function enregistrer() {
    setOccupe(true);
    try {
      const data = await envoyer("/api/notifications/reglages", "PUT", { roles: rolesParType });
      setRolesParType(data.roles);
      setModifie(false);
      setInfo({ texte: "Réglages enregistrés.", erreur: false });
    } catch (e) {
      setInfo({ texte: e.message, erreur: true });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div style={stylePanneau}>
      <TitrePanneau icone="utilisateurs" teinte={TEINTES.neutre} titre="Qui reçoit quoi" sousTitre="Coche les rôles qui reçoivent chaque type d'avis. Les employés reçoivent ce qui est coché pour leur rôle, plus ce qui les concerne." />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TYPES.map(([type, t]) => (
          <div key={type} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.icone} {t.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{t.description}</div>
            {t.concerne && (
              <LigneIcone icone="personne">Toujours : {t.concerne.charAt(0).toLowerCase() + t.concerne.slice(1)}{t.parRole ? ", et :" : ""}</LigneIcone>
            )}
            {t.parRole && (
              <div style={{ marginTop: 8 }}>
                <Puces>
                  {gestion.roles.map((r) => <Puce key={r.cle} coche actif={(rolesParType[type] || []).includes(r.cle)} onClick={() => basculer(type, r.cle)}>{r.nom}</Puce>)}
                </Puces>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="bouton-3d" disabled={occupe || !modifie} onClick={enregistrer} style={{ ...boutonPrincipal, marginTop: 14 }}>
        {occupe ? "Enregistrement…" : "Enregistrer"}
      </button>
      <MessageInfo texte={info.texte} erreur={info.erreur} />
    </div>
  );
}

// ---------- Pièces communes de la page ----------

// Choix en puce arrondie (destinataires, rôles, jours, modèles). coche :
// choix multiple, avec un crochet quand il est sélectionné.
function Puce({ actif, coche, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={actif}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        border: `1px solid ${actif ? "var(--accent)" : "var(--border)"}`, background: actif ? TEINTES.ambre.fond : "var(--surface)", color: actif ? "var(--accent-ombre)" : "var(--text)",
      }}
    >
      {coche && actif && <Icone nom="crochet" taille={14} couleur="var(--accent-ombre)" />}
      {children}
    </button>
  );
}
const Puces = ({ children }) => <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>;

function SousChoix({ titre, children }) {
  return (
    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "var(--surface-alt)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>{titre}</div>
      <Puces>{children}</Puces>
    </div>
  );
}

function LigneIcone({ icone, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
      <span style={{ display: "flex", marginTop: 1, flexShrink: 0 }}><Icone nom={icone} taille={14} couleur="var(--text-muted)" /></span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

const Vide = ({ children }) => (
  <div style={{ padding: "14px 12px", borderRadius: 12, background: "var(--surface-alt)", color: "var(--text-muted)", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{children}</div>
);
const Aide = ({ children }) => <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0" }}>{children}</p>;

// Résultat d'un envoi ou d'un enregistrement (rien si vide)
function MessageInfo({ texte, erreur }) {
  if (!texte) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, padding: "10px 12px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: erreur ? "var(--danger-fond)" : TEINTES.vert.fond, border: `1px solid ${erreur ? "var(--danger)" : "var(--success)"}` }}>
      <span style={{ display: "flex", marginTop: 1, flexShrink: 0 }}><Icone nom={erreur ? "alerte" : "crochet"} taille={16} couleur={erreur ? "var(--danger)" : "var(--success)"} /></span>
      <span style={{ minWidth: 0 }}>{texte}</span>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 };
const champInput = {
  width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13.5, boxSizing: "border-box", fontFamily: "inherit",
};
const boutonPrincipal = { width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 15 };
const boutonLien = { fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" };
const boutonPointille = {
  width: "100%", padding: "11px 8px", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  color: "var(--accent-ombre)", background: "none", border: "1.5px dashed var(--accent)",
};
