"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../components/BandeauSection";
import ActivationNotifications from "../components/ActivationNotifications";
import { depuis } from "../components/Cloche";
import { TYPES_NOTIFICATIONS, FREQUENCES_CEDULEES, JOURS_SEMAINE } from "@/lib/typesNotifications";

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
    <div className="carte" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="titre-section" style={{ margin: 0 }}>Reçues {nonLues > 0 && `· ${nonLues} non lue${nonLues > 1 ? "s" : ""}`}</div>
        {nonLues > 0 && (
          <button onClick={toutLire} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0 }}>
            Tout marquer lu
          </button>
        )}
      </div>
      {notifications.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Aucune notification pour l'instant.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => ouvrir(n)}
            style={{
              textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer", color: "var(--text)",
              border: `1px solid ${n.lue ? "var(--border)" : "var(--accent-ombre)"}`, background: n.lue ? "transparent" : "var(--bg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: n.lue ? 500 : 700 }}>{n.titre}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{depuis(n.creeLe)}</span>
            </div>
            {n.corps && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, whiteSpace: "pre-wrap" }}>{n.corps}</div>}
          </button>
        ))}
      </div>
      {notifications.length > 0 && <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "10px 0 0" }}>Les notifications sont effacées après 60 jours.</p>}
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
    <div className="carte" style={{ marginBottom: 12 }}>
      <div className="titre-section">Ce que je veux recevoir</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TYPES.map(([type, t]) => (
          <label key={type} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: t.obligatoire ? "default" : "pointer", opacity: t.obligatoire ? 0.7 : 1 }}>
            <input type="checkbox" checked={t.obligatoire || !coupees.includes(type)} disabled={t.obligatoire} onChange={() => basculer(type)} style={{ marginTop: 3 }} />
            <span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.icone} {t.label}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>
                {t.description}{t.obligatoire && " Toujours reçu."}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 0" }}>
        Tu reçois un type seulement s'il te concerne ou si ton rôle est coché dans « Qui reçoit quoi ».
      </p>
      {erreur && <p style={{ fontSize: 12, color: "var(--danger)", margin: "8px 0 0" }}>{erreur}</p>}
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

  const choix = (valeur, libelle) => (
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
      <input type="radio" name="mode-destinataires" checked={mode === valeur} onChange={() => setMode(valeur)} /> {libelle}
    </label>
  );

  return (
    <form className="carte" style={{ marginBottom: 12 }} onSubmit={soumettre}>
      <div className="titre-section">📣 Envoyer un message à l'équipe</div>
      <textarea className="champ champ-espace" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : Réunion d'équipe demain à 8 h." required />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        {choix("tous", "Toute l'équipe")}
        {choix("roles", "Par rôle")}
        {choix("employes", "Employés précis")}
      </div>
      {mode === "roles" && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          {gestion.roles.map((r) => (
            <label key={r.cle} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={roles.includes(r.cle)} onChange={() => basculer(roles, setRoles, r.cle)} /> {r.nom}
            </label>
          ))}
        </div>
      )}
      {mode === "employes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, marginBottom: 8 }}>
          {gestion.employes.map((e) => (
            <label key={e.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={employeIds.includes(e.id)} onChange={() => basculer(employeIds, setEmployeIds, e.id)} /> {e.nom}
            </label>
          ))}
          {gestion.employes.length === 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun autre employé actif.</span>}
        </div>
      )}
      <button type="submit" className="bouton-3d" disabled={occupe || !message.trim()} style={{ width: "100%", padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
        {occupe ? "Envoi…" : "Envoyer le message"}
      </button>
      {info.texte && <p style={{ fontSize: 12, color: info.erreur ? "var(--danger)" : "var(--text-muted)", margin: "8px 0 0" }}>{info.texte}</p>}
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
  const petitBouton = { background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0 };
  const caseACocher = { display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" };

  return (
    <div className="carte" style={{ marginBottom: 12 }}>
      <div className="titre-section">⏰ Notifications cédulées</div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Envoyées toutes seules à l'heure choisie — ex. le début et la fin du break ou du dîner.
      </p>

      {cedulees.length === 0 && !edition && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>Aucune notification cédulée.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {cedulees.map((c) => (
          <div key={c.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", opacity: c.actif ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{formatHeure(c.heure)} · {c.titre}</span>
              {!c.actif && c.frequence !== "UNE_FOIS" && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>En pause</span>}
            </div>
            {c.message && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, whiteSpace: "pre-wrap" }}>{c.message}</div>}
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>🔁 {resumeFrequence(c)} · 👥 {resumeDestinataires(c, gestion)}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              {aSupprimer === c.id ? (
                <>
                  <span style={{ fontSize: 12 }}>Supprimer ?</span>
                  <button onClick={() => supprimer(c.id)} style={{ ...petitBouton, color: "var(--danger)" }}>Oui, supprimer</button>
                  <button onClick={() => setASupprimer(null)} style={petitBouton}>Annuler</button>
                </>
              ) : (
                <>
                  <button onClick={() => modifier(c)} style={petitBouton}>Modifier</button>
                  {!(c.frequence === "UNE_FOIS" && !c.actif && c.dernierEnvoi) && (
                    <button onClick={() => basculerActif(c)} style={petitBouton}>{c.actif ? "Mettre en pause" : "Réactiver"}</button>
                  )}
                  <button onClick={() => setASupprimer(c.id)} style={{ ...petitBouton, color: "var(--danger)" }}>Supprimer</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {!edition && (
        <button className="bouton-3d" onClick={() => { setErreur(""); setEdition({ ...CEDULEE_VIDE }); }} style={{ width: "100%", padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
          + Ajouter une notification cédulée
        </button>
      )}

      {edition && (
        <form onSubmit={enregistrer} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{edition.id ? "Modifier la notification" : "Nouvelle notification cédulée"}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {MODELES_CEDULES.map((m) => (
              <button key={m} type="button" onClick={() => champ("titre", m)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid var(--border)", background: edition.titre === m ? "var(--bg)" : "transparent", color: "var(--text)", cursor: "pointer" }}>
                {m}
              </button>
            ))}
          </div>
          <input className="champ champ-espace" maxLength={80} value={edition.titre} onChange={(e) => champ("titre", e.target.value)} placeholder="Titre — ex. : Début du dîner" required />
          <textarea className="champ champ-espace" rows={2} maxLength={500} value={edition.message} onChange={(e) => champ("message", e.target.value)} placeholder="Message (facultatif) — ex. : Bon appétit! Retour à 12 h 30." />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <label style={{ fontSize: 12, flex: "1 1 120px" }}>
              Heure
              <input type="time" className="champ" value={edition.heure} onChange={(e) => champ("heure", e.target.value)} required />
            </label>
            <label style={{ fontSize: 12, flex: "2 1 180px" }}>
              Fréquence
              <select className="champ" value={edition.frequence} onChange={(e) => champ("frequence", e.target.value)}>
                {Object.entries(FREQUENCES_CEDULEES).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}
              </select>
            </label>
          </div>
          {edition.frequence === "JOURS" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              {Object.entries(JOURS_SEMAINE).map(([cle, nom]) => (
                <label key={cle} style={caseACocher}>
                  <input type="checkbox" checked={edition.jours.includes(cle)} onChange={() => basculerDans("jours", cle)} /> {nom}
                </label>
              ))}
            </div>
          )}
          {edition.frequence === "UNE_FOIS" && (
            <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
              Date
              <input type="date" className="champ" value={edition.date} onChange={(e) => champ("date", e.target.value)} required />
            </label>
          )}

          <div style={{ fontSize: 12, marginBottom: 4 }}>Destinataires</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
            {[["tous", "Toute l'équipe"], ["choix", "Rôles ou employés précis"]].map(([valeur, libelle]) => (
              <label key={valeur} style={caseACocher}>
                <input type="radio" name="destinataires-cedulee" checked={edition.tous === (valeur === "tous")} onChange={() => champ("tous", valeur === "tous")} /> {libelle}
              </label>
            ))}
          </div>
          {!edition.tous && (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                {gestion.roles.map((r) => (
                  <label key={r.cle} style={caseACocher}>
                    <input type="checkbox" checked={edition.roles.includes(r.cle)} onChange={() => basculerDans("roles", r.cle)} /> {r.nom}
                  </label>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6, marginBottom: 8 }}>
                {gestion.equipe.map((e) => (
                  <label key={e.id} style={caseACocher}>
                    <input type="checkbox" checked={edition.employeIds.includes(e.id)} onChange={() => basculerDans("employeIds", e.id)} /> {e.nom}
                  </label>
                ))}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="bouton-3d" disabled={occupe || !edition.titre.trim()} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              {occupe ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={() => { setEdition(null); setErreur(""); }} style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </form>
      )}
      {erreur && <p style={{ fontSize: 12, color: "var(--danger)", margin: "8px 0 0" }}>{erreur}</p>}
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
    <div className="carte" style={{ marginBottom: 12 }}>
      <div className="titre-section">⚙️ Qui reçoit quoi</div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Coche les rôles qui reçoivent chaque type d'avis. Les employés n'ont aucun choix : ils reçoivent ce qui est coché pour leur rôle, plus ce qui les concerne.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {TYPES.map(([type, t]) => (
          <div key={type} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t.icone} {t.label}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 6 }}>{t.description}</div>
            {t.concerne && <div style={{ fontSize: 11.5, marginBottom: 6 }}>👤 Toujours : {t.concerne.charAt(0).toLowerCase() + t.concerne.slice(1)}{t.parRole ? ", et :" : ""}</div>}
            {t.parRole && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {gestion.roles.map((r) => (
                  <label key={r.cle} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={(rolesParType[type] || []).includes(r.cle)} onChange={() => basculer(type, r.cle)} /> {r.nom}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="bouton-3d" disabled={occupe || !modifie} onClick={enregistrer} style={{ width: "100%", padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, marginTop: 12 }}>
        {occupe ? "Enregistrement…" : "Enregistrer"}
      </button>
      {info.texte && <p style={{ fontSize: 12, color: info.erreur ? "var(--danger)" : "var(--text-muted)", margin: "8px 0 0" }}>{info.texte}</p>}
    </div>
  );
}
