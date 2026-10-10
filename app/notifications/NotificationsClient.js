"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BandeauSection from "../components/BandeauSection";
import ActivationNotifications from "../components/ActivationNotifications";
import { depuis } from "../components/Cloche";
import { TYPES_NOTIFICATIONS } from "@/lib/typesNotifications";

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
      <BandeauSection icone="🔔" titre="Notifications" sousTitre="Tes avis récents, ce que tu veux recevoir, et sur ton téléphone même l'app fermée." />
      {estEmploye && (
        <>
          <ActivationNotifications clePublique={clePublique} />
          <Historique notificationsInitiales={notificationsInitiales} />
          <Preferences coupeesInitiales={coupeesInitiales} />
        </>
      )}
      {gestion && (
        <>
          <EnvoiMessage gestion={gestion} />
          <QuiRecoitQuoi gestion={gestion} />
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
        Tu reçois un type seulement s'il te concerne ou si ton rôle est choisi par le gérant.
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
        Coche les rôles qui reçoivent chaque type d'avis. Chaque employé peut ensuite couper ceux qu'il ne veut pas.
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
