"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RAISONS, CODES_RAPPEL, CODES_VACANCES, CODES_AUTRES_SOMMES, LIBELLES_PERIODE, MAX_PERIODES, periodesDePaie } from "@/lib/releveEmploiCalculs";
import { stylePanneau, TitrePanneau, TEINTES, Pastille } from "../../../../components/StyleSection";

const JOUR = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });
const court = (s) => (s ? JOUR.format(new Date(`${s}T12:00:00Z`)) : "");
const argent = (n) => Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const etiquette = { display: "block", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10 };
const champ = { display: "block", width: "100%", fontSize: 14, marginTop: 4, boxSizing: "border-box" };
const petitBouton = { padding: "6px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: "pointer" };

// Formulaire du relevé d'emploi : ce que les paies ont rempli, à vérifier et
// compléter (raison, rappel, sommes versées au départ), puis le fichier pour
// RE Web
export default function FormulaireReleve({ initial, erreursInitiales, employe, employeur }) {
  const router = useRouter();
  const [r, setR] = useState(initial);
  const [erreurs, setErreurs] = useState(erreursInitiales);
  const [modifie, setModifie] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [message, setMessage] = useState(null);
  const [soumettre, setSoumettre] = useState(false);
  const [numeroSerie, setNumeroSerie] = useState(initial.numeroSerie || "");
  const transmis = r.statut === "TRANSMIS";

  const maj = (champs) => { setR((x) => ({ ...x, ...champs })); setModifie(true); setMessage(null); };
  const periodes = useMemo(
    () => (/^\d{4}-\d{2}-\d{2}$/.test(r.finDernierePeriode || "") ? periodesDePaie(r.typePeriode, r.finDernierePeriode, null) : []),
    [r.typePeriode, r.finDernierePeriode],
  );
  const totalGains = r.gainsParPeriode.reduce((s, g) => s + (Number(g) || 0), 0);
  const nbZeros = r.gainsParPeriode.filter((g) => !(Number(g) > 0)).length;

  async function appel(url, options, cle) {
    setEnCours(cle);
    setMessage(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(null);
    if (!res?.ok) {
      setMessage({ texte: data?.erreur || "Rien n'a été enregistré.", erreur: true });
      return null;
    }
    return data;
  }

  async function enregistrer() {
    const data = await appel(`/api/paie/releves-emploi/${r.id}`, { method: "PUT", body: JSON.stringify(r) }, "enregistrer");
    if (!data) return;
    setR(data.releve);
    setErreurs(data.erreurs);
    setModifie(false);
    setMessage({ texte: data.erreurs.length ? "Enregistré. Il reste des points à corriger avant le fichier." : "Enregistré. Le relevé est prêt pour RE Web." });
  }

  async function recalculer() {
    const data = await appel(`/api/paie/releves-emploi/${r.id}/recalculer`, { method: "POST", body: JSON.stringify({ dernierJourPaye: r.dernierJourPaye }) }, "recalculer");
    if (!data) return;
    maj(data);
    setMessage({ texte: "Recalculé à partir des paies. Vérifie, puis enregistre." });
  }

  async function marquerTransmis(valeur) {
    const data = await appel(`/api/paie/releves-emploi/${r.id}`, { method: "PATCH", body: JSON.stringify({ transmis: valeur, numeroSerie }) }, "transmis");
    if (!data) return;
    setR(data.releve);
    router.refresh();
  }

  async function supprimer() {
    if (!window.confirm("Supprimer ce brouillon de relevé ?")) return;
    const data = await appel(`/api/paie/releves-emploi/${r.id}`, { method: "DELETE" }, "supprimer");
    if (data) router.push("/gerant/paie/releves-emploi");
  }

  const setGain = (i, v) => maj({ gainsParPeriode: r.gainsParPeriode.map((g, n) => (n === i ? v : g)) });
  const ligne = (cle, i, champs) => maj({ [cle]: r[cle].map((x, n) => (n === i ? { ...x, ...champs } : x)) });
  const pret = !modifie && erreurs.length === 0;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...stylePanneau, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Relevé d&apos;emploi</div>
          <h1 style={{ fontSize: 20, margin: "2px 0 4px" }}>{employe.nomFamille}, {employe.prenom}</h1>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            NAS {employe.nas || "manquant"} · {employe.adresse || "adresse manquante"}<br />
            {employeur.nom} · {employeur.bn || "numéro d'employeur manquant"} · à joindre : {employeur.contact || "—"} {employeur.telephone}
          </div>
        </div>
        {transmis
          ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Transmis{r.numeroSerie ? ` · ${r.numeroSerie}` : ""}</Pastille>
          : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">Brouillon</Pastille>}
      </div>

      {erreurs.length > 0 && (
        <div role="alert" style={{ ...stylePanneau, borderColor: "var(--danger)", fontSize: 13, lineHeight: 1.5 }}>
          <b>À corriger avant le fichier :</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <fieldset disabled={transmis} style={{ border: "none", padding: 0, margin: 0 }}>
        <div style={stylePanneau}>
          <TitrePanneau icone="calendrier" teinte={TEINTES.bleu} titre="Départ" />
          <label style={etiquette}>Raison du relevé (B16)
            <select value={r.raison} onChange={(e) => maj({ raison: e.target.value })} className="champ" style={champ}>
              <option value="">Choisir…</option>
              {Object.entries(RAISONS).map(([code, libelle]) => <option key={code} value={code}>{code} — {libelle}</option>)}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0 12px" }}>
            <label style={etiquette}>Premier jour de travail (B10)
              <input type="date" value={r.premierJour} onChange={(e) => maj({ premierJour: e.target.value })} className="champ" style={champ} />
            </label>
            <label style={etiquette}>Dernier jour payé (B11)
              <input type="date" value={r.dernierJourPaye} onChange={(e) => maj({ dernierJourPaye: e.target.value })} className="champ" style={champ} />
            </label>
            <label style={etiquette}>Fin de la dernière période de paie (B12)
              <input type="date" value={r.finDernierePeriode} onChange={(e) => maj({ finDernierePeriode: e.target.value })} className="champ" style={champ} />
            </label>
            <label style={etiquette}>Périodes de paie (B6)
              <select value={r.typePeriode} onChange={(e) => maj({ typePeriode: e.target.value })} className="champ" style={champ}>
                {Object.entries(LIBELLES_PERIODE).map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={recalculer} disabled={!!enCours} style={{ ...petitBouton, marginBottom: 12 }}>
            {enCours === "recalculer" ? "Calcul…" : "↻ Recalculer heures et gains à partir des paies"}
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0 12px" }}>
            <label style={etiquette}>Profession (B13)
              <input value={r.profession} onChange={(e) => maj({ profession: e.target.value })} maxLength={40} className="champ" style={champ} />
            </label>
            <label style={etiquette}>Retour prévu (B14)
              <select value={r.rappel} onChange={(e) => maj({ rappel: e.target.value })} className="champ" style={champ}>
                {Object.entries(CODES_RAPPEL).map(([code, libelle]) => <option key={code} value={code}>{libelle}</option>)}
              </select>
            </label>
            {r.rappel === "Y" && (
              <label style={etiquette}>Date de rappel
                <input type="date" value={r.dateRappel} onChange={(e) => maj({ dateRappel: e.target.value })} className="champ" style={champ} />
              </label>
            )}
          </div>
        </div>

        <div style={stylePanneau}>
          <TitrePanneau icone="calculatrice" teinte={TEINTES.vert} titre="Heures et gains assurables" sousTitre={`Tirés des paies versées ; au plus ${MAX_PERIODES[r.typePeriode]} périodes`} />
          <label style={{ ...etiquette, maxWidth: 260 }}>Total des heures assurables (B15A)
            <input inputMode="numeric" value={r.heuresAssurables} onChange={(e) => maj({ heuresAssurables: e.target.value.replace(/\D/g, "") })} className="champ" style={champ} />
          </label>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 6px" }}>Gains assurables par période (B15C), la plus récente d&apos;abord — total {argent(totalGains)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
            {r.gainsParPeriode.map((g, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ width: 92, flexShrink: 0 }}>{i + 1}. {periodes[i] ? `${court(periodes[i].debut)} – ${court(periodes[i].fin)}` : ""}</span>
                <input inputMode="decimal" value={g} onChange={(e) => setGain(i, e.target.value.replace(",", "."))} aria-label={`Gains de la période ${i + 1}`} className="champ" style={{ flex: 1, minWidth: 0, fontSize: 13, textAlign: "right" }} />
              </label>
            ))}
          </div>
          {nbZeros > 0 && (
            <p style={{ fontSize: 12, color: "var(--avertissement)", margin: "8px 0 0" }}>
              {nbZeros} période{nbZeros > 1 ? "s" : ""} à 0,00 $ : aucune paie dans le logiciel. Si l&apos;employé a été payé autrement (avant le logiciel, par exemple), inscris ses gains.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {r.gainsParPeriode.length < MAX_PERIODES[r.typePeriode] && <button type="button" onClick={() => maj({ gainsParPeriode: [...r.gainsParPeriode, 0] })} style={petitBouton}>+ Période plus ancienne</button>}
            {r.gainsParPeriode.length > 1 && <button type="button" onClick={() => maj({ gainsParPeriode: r.gainsParPeriode.slice(0, -1) })} style={petitBouton}>− Retirer la plus ancienne</button>}
          </div>
        </div>

        <div style={stylePanneau}>
          <TitrePanneau icone="banque" teinte={TEINTES.ambre} titre="Sommes versées au départ" sousTitre="Les sommes assurables sont aussi comprises dans les gains de la période 1" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0 12px" }}>
            <label style={etiquette}>Paie de vacances (B17A)
              <select value={r.vacances?.code || ""} onChange={(e) => maj({ vacances: e.target.value ? { ...(r.vacances || {}), code: e.target.value } : null })} className="champ" style={champ}>
                <option value="">Aucune</option>
                {Object.entries(CODES_VACANCES).map(([code, libelle]) => <option key={code} value={code}>{code} — {libelle}</option>)}
              </select>
            </label>
            {r.vacances?.code && r.vacances.code !== "1" && (
              <label style={etiquette}>Montant
                <input inputMode="decimal" value={r.vacances.montant ?? ""} onChange={(e) => maj({ vacances: { ...r.vacances, montant: e.target.value.replace(",", ".") } })} className="champ" style={champ} />
              </label>
            )}
            {(r.vacances?.code === "3" || r.vacances?.code === "4") && (
              <label style={etiquette}>Début
                <input type="date" value={r.vacances.debut || ""} onChange={(e) => maj({ vacances: { ...r.vacances, debut: e.target.value } })} className="champ" style={champ} />
              </label>
            )}
            {r.vacances?.code === "3" && (
              <label style={etiquette}>Fin
                <input type="date" value={r.vacances.fin || ""} onChange={(e) => maj({ vacances: { ...r.vacances, fin: e.target.value } })} className="champ" style={champ} />
              </label>
            )}
          </div>

          <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 6px" }}>Jours fériés payés après le dernier jour payé (B17B)</div>
          {r.joursFeries.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input type="date" value={f.date} onChange={(e) => ligne("joursFeries", i, { date: e.target.value })} aria-label="Date du jour férié" className="champ" style={{ flex: 1, minWidth: 0, fontSize: 13 }} />
              <input inputMode="decimal" value={f.montant} onChange={(e) => ligne("joursFeries", i, { montant: e.target.value.replace(",", ".") })} aria-label="Montant" placeholder="Montant" className="champ" style={{ width: 110, fontSize: 13, textAlign: "right" }} />
              <button type="button" onClick={() => maj({ joursFeries: r.joursFeries.filter((_, n) => n !== i) })} aria-label="Retirer" style={petitBouton}>✕</button>
            </div>
          ))}
          {r.joursFeries.length < 10 && <button type="button" onClick={() => maj({ joursFeries: [...r.joursFeries, { date: "", montant: "" }] })} style={{ ...petitBouton, marginBottom: 12 }}>+ Jour férié</button>}

          <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "4px 0 6px" }}>Autres sommes (B17C) : primes, indemnité de départ ou de préavis…</div>
          {r.autresSommes.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <select value={a.code} onChange={(e) => ligne("autresSommes", i, { code: e.target.value })} aria-label="Type de somme" className="champ" style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <option value="">Choisir…</option>
                {Object.entries(CODES_AUTRES_SOMMES).map(([code, { libelle, assurable }]) => <option key={code} value={code}>{code} — {libelle}{assurable ? "" : " (non assurable)"}</option>)}
              </select>
              <input inputMode="decimal" value={a.montant} onChange={(e) => ligne("autresSommes", i, { montant: e.target.value.replace(",", ".") })} aria-label="Montant" placeholder="Montant" className="champ" style={{ width: 110, fontSize: 13, textAlign: "right" }} />
              <button type="button" onClick={() => maj({ autresSommes: r.autresSommes.filter((_, n) => n !== i) })} aria-label="Retirer" style={petitBouton}>✕</button>
            </div>
          ))}
          {r.autresSommes.length < 3 && <button type="button" onClick={() => maj({ autresSommes: [...r.autresSommes, { code: "", montant: "" }] })} style={{ ...petitBouton, marginBottom: 12 }}>+ Autre somme</button>}

          <label style={etiquette}>Commentaires (B18)
            <textarea value={r.commentaires} onChange={(e) => maj({ commentaires: e.target.value })} maxLength={160} rows={2} className="champ" style={{ ...champ, resize: "vertical" }} />
          </label>
        </div>
      </fieldset>

      <div style={{ ...stylePanneau, position: "sticky", bottom: 8, zIndex: 5, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
        {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 13, margin: "0 0 8px", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
        {!transmis ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={enregistrer} disabled={!!enCours} className="bouton-3d" style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700 }}>
              {enCours === "enregistrer" ? "Enregistrement…" : modifie ? "Enregistrer" : "Enregistré ✓"}
            </button>
            <a
              href={pret ? `/api/paie/releves-emploi/${r.id}/fichier${soumettre ? "?emission=S" : ""}` : undefined}
              aria-disabled={!pret}
              style={{ padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none", border: "1px solid var(--border)", color: "var(--text)", opacity: pret ? 1 : 0.45, pointerEvents: pret ? "auto" : "none" }}
            >
              ⬇ Fichier pour RE Web (.BLK)
            </a>
            <label style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={soumettre} onChange={(e) => setSoumettre(e.target.checked)} />
              Soumettre directement (sinon : brouillon à réviser dans RE Web)
            </label>
            <button type="button" onClick={supprimer} disabled={!!enCours} style={{ ...petitBouton, marginLeft: "auto", color: "var(--danger)" }}>Supprimer</button>
            {modifie && <p style={{ flexBasis: "100%", fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Enregistre pour vérifier le relevé et obtenir le fichier.</p>}
            {pret && (
              <div style={{ flexBasis: "100%", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                Téléversé dans RE Web ? Numéro de série donné par RE Web :
                <input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value.toUpperCase())} placeholder="W12345678" maxLength={9} aria-label="Numéro de série RE Web" className="champ" style={{ width: 120, fontSize: 13 }} />
                <button type="button" onClick={() => marquerTransmis(true)} disabled={!!enCours} style={petitBouton}>Marquer comme transmis</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
            Transmis à RE Web{r.numeroSerie ? ` (no ${r.numeroSerie})` : ""}. Une correction se fait dans RE Web, avec ce numéro.
            <button type="button" onClick={() => marquerTransmis(false)} disabled={!!enCours} style={{ ...petitBouton, marginLeft: "auto" }}>Remettre en brouillon</button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Dans RE Web (Service Canada, connexion avec votre CléGC ou un partenaire de connexion), choisissez de téléverser un fichier
        de relevés d&apos;emploi et sélectionnez le fichier .BLK. En brouillon, le relevé s&apos;y révise avant d&apos;être soumis ; RE Web
        donne alors son numéro de série.
      </p>
    </div>
  );
}
