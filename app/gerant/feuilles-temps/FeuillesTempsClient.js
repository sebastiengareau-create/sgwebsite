"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BandeauSection from "../../components/BandeauSection";
import { TEINTES, CarteChiffre, Pastille, BoutonAction, stylePanneau } from "../../components/StyleSection";

const FUSEAU = "America/Toronto";
const LIBELLES_TYPE = { TRAVAIL: "Travail", DINER: "Dîner", PAUSE: "Pause" };
const ARRONDIS = [[0, "À la minute (aucun arrondi)"], [5, "Aux 5 minutes"], [6, "Aux 6 minutes (dixième d'heure)"], [10, "Aux 10 minutes"], [15, "Au quart d'heure"]];
const ACTIONS_JOURNAL = { AJOUT: "Ajout", MODIFICATION: "Correction", SUPPRESSION: "Suppression", VERROUILLAGE: "Verrouillage", REOUVERTURE: "Réouverture", PRIME: "Prime" };

const nombre = (n) => (Number(n) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const heures = (n) => `${nombre(n)} h`;
const pourcent = (ratio) => (ratio == null ? "—" : `${Math.round(ratio * 100)} %`);
const heure = (iso) => (iso ? new Date(iso).toLocaleTimeString("fr-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(" h ", ":") : "en cours");
// Champ <input type="datetime-local">, en heure du Québec
const pourChamp = (iso) => new Date(iso).toLocaleString("sv-SE", { timeZone: FUSEAU }).slice(0, 16).replace(" ", "T");
const dateDe = (dateStr) => new Date(`${dateStr}T12:00:00Z`);
const jourLong = (dateStr) => dateDe(dateStr).toLocaleDateString("fr-CA", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const jourCourt = (dateStr) => dateDe(dateStr).toLocaleDateString("fr-CA", { timeZone: "UTC", day: "numeric", month: "short" });
const decaler = (dateStr, jours) => new Date(dateDe(dateStr).getTime() + jours * 86400000).toISOString().slice(0, 10);
const horodatage = (iso) => new Date(iso).toLocaleString("fr-CA", { timeZone: FUSEAU, dateStyle: "medium", timeStyle: "short" });
// Efficacité : vert à partir de 80 %, ambre à partir de 60 %, rouge en dessous
const teinteEfficacite = (ratio) => (ratio == null ? TEINTES.neutre : ratio >= 0.8 ? TEINTES.vert : ratio >= 0.6 ? TEINTES.ambre : TEINTES.rouge);

const styleCellule = { padding: "9px 8px", fontSize: 13.5, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const styleEntete = { ...styleCellule, fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3 };
const styleBouton = { padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)" };

async function envoyer(url, methode, corps) {
  const res = await fetch(url, { method: methode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? null : data.erreur || `Erreur (code ${res.status}).`;
}

export default function FeuillesTempsClient({ periode, verrou, reglages, feuilles, journal, employes, aujourdhui }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(null); // employé déployé
  const [formulaire, setFormulaire] = useState(null); // quart en correction ou en ajout
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [debut, setDebut] = useState(periode.debut);
  const [fin, setFin] = useState(periode.fin);

  const nbJours = Math.round((dateDe(periode.fin) - dateDe(periode.debut)) / 86400000) + 1;
  const allerA = (d, f) => router.push(`/gerant/feuilles-temps?debut=${d}&fin=${f}`);
  const total = feuilles.reduce((t, f) => ({ payees: t.payees + f.total.payees, bons: t.bons + f.total.bons, internes: t.internes + f.total.internes, sup: t.sup + f.heuresSupplementaires, anomalies: t.anomalies + f.nbAnomalies, bloquantes: t.bloquantes + f.nbBloquantes }), { payees: 0, bons: 0, internes: 0, sup: 0, anomalies: 0, bloquantes: 0 });
  const efficacite = total.payees > 0 ? total.bons / total.payees : null;
  const terminee = periode.fin < aujourdhui;

  async function agir(url, methode, corps) {
    setErreur(""); setOccupe(true);
    const probleme = await envoyer(url, methode, corps);
    setOccupe(false);
    if (probleme) { setErreur(probleme); return false; }
    router.refresh();
    return true;
  }
  const actionPeriode = (corps) => agir("/api/feuilles-temps/periode", "POST", { debut: periode.debut, fin: periode.fin, ...corps });

  async function verrouiller() {
    const avertissement = total.anomalies > 0 ? `Il reste ${total.anomalies} anomalie${total.anomalies > 1 ? "s" : ""} signalée${total.anomalies > 1 ? "s" : ""}. ` : "";
    if (!window.confirm(`${avertissement}Approuver et verrouiller la période du ${jourCourt(periode.debut)} au ${jourCourt(periode.fin)} ? Les pointages ne pourront plus être corrigés.`)) return;
    await actionPeriode({ action: "verrouiller" });
  }
  async function rouvrir() {
    const raison = window.prompt("Raison de la réouverture (consignée au journal) :");
    if (raison) await actionPeriode({ action: "rouvrir", raison });
  }
  async function supprimer(quart) {
    const raison = window.prompt(`Supprimer ce pointage (${LIBELLES_TYPE[quart.type]} ${heure(quart.debut)} – ${heure(quart.fin)}) ? Raison (consignée au journal) :`);
    if (raison) await agir(`/api/quarts/${quart.id}`, "DELETE", { raison });
  }
  async function enregistrerQuart(e) {
    e.preventDefault();
    const { id, employeId, type, debut: d, fin: f, raison } = formulaire;
    const reussi = id
      ? await agir(`/api/quarts/${id}`, "PATCH", { debut: d, fin: f, raison })
      : await agir("/api/quarts", "POST", { employeId, type, debut: d, fin: f, raison });
    if (reussi) setFormulaire(null);
  }
  const corriger = (quart, jour) => setFormulaire({
    id: quart.id, employeId: quart.employeId, type: quart.type, raison: "",
    debut: pourChamp(quart.debut), fin: quart.fin ? pourChamp(quart.fin) : `${jour}T17:00`,
  });
  const ajouter = (employeId, jour) => setFormulaire({ id: null, employeId, type: "TRAVAIL", debut: `${jour}T08:00`, fin: `${jour}T17:00`, raison: "" });

  const lienExport = (format) => `/api/feuilles-temps/export?debut=${periode.debut}&fin=${periode.fin}&format=${format}`;

  return (
    <div className="conteneur-page" style={{ maxWidth: 1180 }}>
      <BandeauSection icone="🕒" titre="Feuilles de temps" sousTitre="Présence pointée par quart — heures de la paie, efficacité, approbation et export." />

      {/* Période */}
      <div style={{ ...stylePanneau, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <button type="button" style={styleBouton} onClick={() => allerA(decaler(periode.debut, -nbJours), decaler(periode.debut, -1))}>← Précédente</button>
        <input type="date" className="champ" style={{ width: "auto" }} value={debut} onChange={(e) => setDebut(e.target.value)} aria-label="Début de la période" />
        <span style={{ color: "var(--text-muted)" }}>au</span>
        <input type="date" className="champ" style={{ width: "auto" }} value={fin} onChange={(e) => setFin(e.target.value)} aria-label="Fin de la période" />
        {(debut !== periode.debut || fin !== periode.fin) && <button type="button" style={styleBouton} disabled={!debut || !fin || fin < debut} onClick={() => allerA(debut, fin)}>Afficher</button>}
        <button type="button" style={styleBouton} onClick={() => allerA(decaler(periode.fin, 1), decaler(periode.fin, nbJours))}>Suivante →</button>
        <span style={{ marginLeft: "auto" }}>
          {verrou
            ? <Pastille couleur="var(--success)" fond="var(--success-fond)">🔒 Approuvée par {verrou.par}{verrou.le ? ` le ${horodatage(verrou.le)}` : ""}</Pastille>
            : <Pastille couleur={TEINTES.ambre.couleur} fond={TEINTES.ambre.fond}>{terminee ? "À approuver" : "En cours"}</Pastille>}
        </span>
      </div>

      <div className="grille-trois" style={{ marginBottom: 16 }}>
        <CarteChiffre titre="Présence payée" montant={heures(total.payees)} teinte="var(--accent)" note={total.sup > 0 ? `dont ${heures(total.sup)} supplémentaires` : "Aucune heure supplémentaire"} />
        <CarteChiffre
          titre="Efficacité" montant={pourcent(efficacite)} teinte={teinteEfficacite(efficacite).couleur} couleur={teinteEfficacite(efficacite).couleur}
          note={`${heures(total.bons)} sur des bons · ${heures(total.internes)} en tâches internes · ${heures(Math.max(0, total.payees - total.bons - total.internes))} non attribuées`}
        />
        <CarteChiffre
          titre="Anomalies" montant={String(total.anomalies)} teinte={total.anomalies > 0 ? "var(--danger)" : "var(--success)"} couleur={total.anomalies > 0 ? "var(--danger)" : "var(--text)"}
          note={total.bloquantes > 0 ? `${total.bloquantes} à corriger avant d'approuver` : total.anomalies > 0 ? "À vérifier" : "Rien à signaler"}
        />
      </div>

      {erreur && <div role="alert" style={{ ...stylePanneau, borderColor: "var(--danger)", color: "var(--danger)", fontSize: 13.5, fontWeight: 600 }}>{erreur}</div>}

      {/* Une ligne par employé */}
      <div style={{ ...stylePanneau, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ ...styleEntete, textAlign: "left", paddingLeft: 16 }}>Employé</th>
                <th style={styleEntete}>Payées</th>
                <th style={styleEntete}>Régulières</th>
                <th style={styleEntete}>Supp.</th>
                <th style={styleEntete}>Fériés</th>
                <th style={styleEntete}>Sur bons</th>
                <th style={styleEntete}>Internes</th>
                <th style={styleEntete}>Non attr.</th>
                <th style={styleEntete}>Efficacité</th>
                <th style={styleEntete}>Prime ($)</th>
                <th style={{ ...styleEntete, paddingRight: 16 }}>Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {feuilles.length === 0 && (
                <tr><td colSpan={11} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>Aucun pointage dans cette période.</td></tr>
              )}
              {feuilles.map((f) => {
                const deploye = ouvert === f.employe.id;
                const teinte = teinteEfficacite(f.total.efficacite);
                return [
                  <tr key={f.employe.id} onClick={() => setOuvert(deploye ? null : f.employe.id)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer", background: deploye ? "var(--bg)" : "transparent" }}>
                    <td style={{ ...styleCellule, textAlign: "left", paddingLeft: 16, fontWeight: 700, whiteSpace: "normal" }}>
                      <span style={{ display: "inline-block", width: 14, color: "var(--text-muted)" }}>{deploye ? "▾" : "▸"}</span>{f.employe.nom}
                      {f.employe.numeroEmploye && <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12 }}> · {f.employe.numeroEmploye}</span>}
                    </td>
                    <td style={{ ...styleCellule, fontWeight: 700 }}>{nombre(f.total.payees)}</td>
                    <td style={styleCellule}>{nombre(f.heuresRegulieres)}</td>
                    <td style={{ ...styleCellule, color: f.heuresSupplementaires > 0 ? "var(--accent-ombre)" : "var(--text-muted)", fontWeight: f.heuresSupplementaires > 0 ? 700 : 400 }}>{nombre(f.heuresSupplementaires)}</td>
                    <td style={{ ...styleCellule, color: f.heuresFeries > 0 ? "var(--text)" : "var(--text-muted)" }}>{nombre(f.heuresFeries)}</td>
                    <td style={styleCellule}>{nombre(f.total.bons)}</td>
                    <td style={styleCellule}>{nombre(f.total.internes)}</td>
                    <td style={styleCellule}>{nombre(f.total.nonAttribue)}</td>
                    <td style={styleCellule}><Pastille couleur={teinte.couleur} fond={teinte.fond}>{pourcent(f.total.efficacite)}</Pastille></td>
                    <td style={styleCellule} onClick={(e) => e.stopPropagation()}>
                      {verrou ? nombre(f.prime) : (
                        <input
                          type="number" min="0" step="0.01" defaultValue={f.prime || ""} placeholder="0,00" aria-label={`Prime de ${f.employe.nom}`}
                          className="champ champ-sans-fleches" style={{ width: 84, textAlign: "right", padding: "5px 8px" }}
                          onBlur={(e) => { if ((Number(e.target.value) || 0) !== f.prime) actionPeriode({ action: "prime", employeId: f.employe.id, prime: e.target.value }); }}
                        />
                      )}
                    </td>
                    <td style={{ ...styleCellule, paddingRight: 16 }}>
                      {f.nbAnomalies > 0
                        ? <Pastille couleur="var(--danger)" fond="var(--danger-fond)">{f.nbAnomalies}</Pastille>
                        : <span style={{ color: "var(--success)" }}>✓</span>}
                    </td>
                  </tr>,
                  deploye && (
                    <tr key={`${f.employe.id}-detail`}>
                      <td colSpan={11} style={{ padding: "4px 16px 16px", background: "var(--bg)" }}>
                        <DetailEmploye feuille={f} verrou={verrou} occupe={occupe} corriger={corriger} supprimer={supprimer} ajouter={ajouter} />
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approbation et export */}
      <div style={{ ...stylePanneau, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        {verrou
          ? <BoutonAction icone="cadenas" onClick={rouvrir} disabled={occupe}>Rouvrir la période</BoutonAction>
          : <BoutonAction icone="cadenas" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={verrouiller} disabled={occupe || !terminee} style={{ padding: "10px 16px" }}>Approuver et verrouiller</BoutonAction>}
        {!verrou && !terminee && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>La période se verrouille une fois terminée.</span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!verrou && feuilles.length > 0 && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Pas encore approuvée</span>}
          <BoutonAction icone="document" href={lienExport("csv")} target="_blank" style={{ padding: "10px 14px" }}>Export CSV</BoutonAction>
          <BoutonAction icone="document" href={lienExport("xlsx")} target="_blank" style={{ padding: "10px 14px" }}>Export Excel</BoutonAction>
        </span>
      </div>

      <Reglages reglages={reglages} agir={agir} occupe={occupe} />

      {/* Journal des corrections */}
      <details style={stylePanneau}>
        <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 800 }}>Journal des corrections ({journal.length})</summary>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0" }}>Chaque correction de pointage, prime, verrouillage et réouverture de la période : qui, quand, ancienne et nouvelle valeur. Rien ne s'efface.</p>
        {journal.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune correction dans cette période.</p>}
        {journal.map((c) => (
          <div key={c.id} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>
              {ACTIONS_JOURNAL[c.action] || c.action}{c.employeNom ? ` — ${c.employeNom}` : ""}
              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · par {c.parNom}, {horodatage(c.creeLe)}</span>
            </div>
            {c.ancienne && <div style={{ color: "var(--text-muted)" }}>Avant : {c.ancienne}</div>}
            {c.nouvelle && <div>Après : {c.nouvelle}</div>}
            {c.raison && <div style={{ fontStyle: "italic" }}>Raison : {c.raison}</div>}
          </div>
        ))}
      </details>

      {/* Correction ou ajout d'un quart */}
      {formulaire && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setFormulaire(null)}>
          <form onSubmit={enregistrerQuart} onClick={(e) => e.stopPropagation()} style={{ ...stylePanneau, marginBottom: 0, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{formulaire.id ? `Corriger — ${LIBELLES_TYPE[formulaire.type]}` : "Ajouter un pointage"}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{employes.find((e) => e.id === formulaire.employeId)?.nom || feuilles.find((f) => f.employe.id === formulaire.employeId)?.employe.nom}</div>
            {!formulaire.id && (
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>Type
                <select className="champ" value={formulaire.type} onChange={(e) => setFormulaire({ ...formulaire, type: e.target.value })}>
                  {Object.entries(LIBELLES_TYPE).map(([cle, libelle]) => <option key={cle} value={cle}>{libelle}</option>)}
                </select>
              </label>
            )}
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Début
              <input type="datetime-local" className="champ" required value={formulaire.debut} onChange={(e) => setFormulaire({ ...formulaire, debut: e.target.value })} />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Fin
              <input type="datetime-local" className="champ" required value={formulaire.fin} onChange={(e) => setFormulaire({ ...formulaire, fin: e.target.value })} />
            </label>
            <label style={{ fontSize: 12.5, fontWeight: 700 }}>Raison (consignée au journal)
              <input type="text" className="champ" required maxLength={200} placeholder="Ex. départ non pointé, confirmé avec l'employé" value={formulaire.raison} onChange={(e) => setFormulaire({ ...formulaire, raison: e.target.value })} />
            </label>
            {erreur && <div style={{ color: "var(--danger)", fontSize: 13 }}>{erreur}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={styleBouton} onClick={() => { setFormulaire(null); setErreur(""); }}>Annuler</button>
              <button type="submit" disabled={occupe} style={{ ...styleBouton, background: "var(--accent)", borderColor: "var(--accent)", color: "#221f18" }}>{occupe ? "…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Détail d'un employé : chaque jour de la période, puis ses semaines
function DetailEmploye({ feuille, verrou, occupe, corriger, supprimer, ajouter }) {
  return (
    <div>
      {feuille.jours.map((j) => {
        const vide = j.quarts.length === 0 && j.segments.length === 0 && j.anomalies.length === 0 && j.bons + j.internes === 0;
        const teinte = teinteEfficacite(j.efficacite);
        return (
          <div key={j.dateStr} style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline", padding: "8px 0", borderTop: "1px solid var(--border)", opacity: vide ? 0.55 : 1 }}>
            <div style={{ width: 96, fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{jourLong(j.dateStr)}</div>
            <div style={{ flex: "1 1 320px", minWidth: 0, fontSize: 13 }}>
              {vide && <span style={{ color: "var(--text-muted)" }}>—</span>}
              {[...j.quarts, ...j.segments].sort((a, b) => a.debut.localeCompare(b.debut)).map((q) => (
                <div key={q.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: q.type === "TRAVAIL" ? 700 : 400, color: q.type === "TRAVAIL" ? "var(--text)" : "var(--text-muted)" }}>
                    {LIBELLES_TYPE[q.type]} {heure(q.debut)} – {heure(q.fin)}
                  </span>
                  {q.type === "TRAVAIL" && q.debutPaye && (heure(q.debutPaye) !== heure(q.debut) || (q.fin && heure(q.finPaye) !== heure(q.fin))) && (
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>payé {heure(q.debutPaye)} – {heure(q.finPaye)}</span>
                  )}
                  {q.ouvertAuto && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>arrivée non pointée (ouvert par une tâche)</span>}
                  {q.ajoutePar && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>ajouté par {q.ajoutePar}</span>}
                  {q.modifiePar && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>corrigé par {q.modifiePar}{q.debutOriginal ? ` (pointé ${heure(q.debutOriginal)} – ${heure(q.finOriginal)})` : ""}</span>}
                  {!verrou && (
                    <>
                      <button type="button" style={{ ...styleBouton, padding: "3px 8px", fontSize: 12 }} disabled={occupe} onClick={() => corriger(q, j.dateStr)}>Corriger</button>
                      <button type="button" style={{ ...styleBouton, padding: "3px 8px", fontSize: 12, color: "var(--danger)" }} disabled={occupe} onClick={() => supprimer(q)}>Supprimer</button>
                    </>
                  )}
                </div>
              ))}
              {j.anomalies.map((a, i) => (
                <div key={i} style={{ color: a.bloquante ? "var(--danger)" : "var(--accent-ombre)", fontSize: 12.5, fontWeight: 600 }}>⚠ {a.texte}</div>
              ))}
              {!verrou && <button type="button" style={{ ...styleBouton, padding: "3px 8px", fontSize: 12, marginTop: 2 }} disabled={occupe} onClick={() => ajouter(feuille.employe.id, j.dateStr)}>+ Ajouter</button>}
            </div>
            <div style={{ fontSize: 13, textAlign: "right", minWidth: 190, fontVariantNumeric: "tabular-nums" }}>
              {!vide && (
                <>
                  <strong>{heures(j.payees)}</strong>{j.enCours && <span style={{ color: "var(--success)" }}> · en cours</span>}
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {heures(j.bons)} sur bons{j.internes > 0 ? ` · ${heures(j.internes)} internes` : ""}{j.diner > 0 ? ` · dîner ${heures(j.diner)}` : ""}
                    {j.efficacite != null && <> · <span style={{ color: teinte.couleur, fontWeight: 700 }}>{pourcent(j.efficacite)}</span></>}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
        {feuille.semaines.map((s) => (
          <div key={s.dimanche}>
            Semaine du {jourCourt(s.dimanche)} au {jourCourt(s.samedi)} : <strong style={{ color: "var(--text)" }}>{heures(s.heures)}</strong>
            {s.supplementaires > 0 && <span style={{ color: "var(--accent-ombre)", fontWeight: 700 }}> · {heures(s.supplementaires)} supplémentaires (au-delà de 40 h)</span>}
            {!s.complete && " · semaine à cheval : ses heures supplémentaires se règlent à la période suivante"}
          </div>
        ))}
        {feuille.feries.map((f) => (
          <div key={f.dateStr}>Jour férié — {f.nom} ({jourCourt(f.dateStr)}) : indemnité de {heures(f.heures)}{f.travaille ? ", en plus des heures travaillées" : ""}</div>
        ))}
      </div>
    </div>
  );
}

function Reglages({ reglages, agir, occupe }) {
  const [valeurs, setValeurs] = useState(reglages);
  const change = JSON.stringify(valeurs) !== JSON.stringify(reglages);
  const ligne = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, marginTop: 10 };
  return (
    <details style={stylePanneau}>
      <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 800 }}>Règles de calcul</summary>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0 0" }}>Les heures pointées sont toujours gardées telles quelles : ces règles ne touchent que le temps payé. À choisir au départ, et à annoncer aux employés.</p>
      <label style={{ ...ligne, flexDirection: "column", gap: 4 }}>
        <span style={{ fontWeight: 700 }}>Arrondi des pointages</span>
        <select className="champ" style={{ maxWidth: 320 }} value={valeurs.arrondiMinutes} onChange={(e) => setValeurs({ ...valeurs, arrondiMinutes: Number(e.target.value) })}>
          {ARRONDIS.map(([minutes, libelle]) => <option key={minutes} value={minutes}>{libelle}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Toujours au plus proche (7 h 53 → 8 h, 8 h 08 → 8 h 15) : l'arrondi joue autant pour l'employé que contre lui.</span>
      </label>
      <label style={ligne}>
        <input type="checkbox" checked={valeurs.calerOuverture} onChange={(e) => setValeurs({ ...valeurs, calerOuverture: e.target.checked })} />
        <span><strong>Arrivée avant l'ouverture : payer à partir de l'ouverture du commerce</strong><br /><span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sauf si une tâche a été poinçonnée plus tôt (le temps payé part alors de cette tâche), ou si le gérant a corrigé le quart. Heures d'ouverture : Paramètres.</span></span>
      </label>
      <label style={ligne}>
        <input type="checkbox" checked={valeurs.dinerPaye} onChange={(e) => setValeurs({ ...valeurs, dinerPaye: e.target.checked })} />
        <span><strong>Dîner payé</strong><br /><span style={{ fontSize: 12, color: "var(--text-muted)" }}>Décoché : le dîner pointé est retranché du temps payé. Les pauses, elles, sont toujours payées.</span></span>
      </label>
      {change && <button type="button" disabled={occupe} style={{ ...styleBouton, marginTop: 12, background: "var(--accent)", borderColor: "var(--accent)", color: "#221f18" }} onClick={() => agir("/api/feuilles-temps/reglages", "PUT", valeurs)}>Enregistrer les règles</button>}
    </details>
  );
}
