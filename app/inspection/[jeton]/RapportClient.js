"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { argent, nombre } from "@/lib/format";
import { ETATS_POINT, parSection, resume, pointsRecommandes, totauxRecommandes, avecUnite } from "@/lib/grillesInspection";
import CaseSignature from "@/app/components/CaseSignature";
import DepotEnLigne from "@/app/components/DepotEnLigne";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });
const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const pourcent = (t) => nombre(t, 3).replace(/[,.]?0+$/, "");

// Rapport d'inspection montré au client (page publique /inspection/<jeton>)
export default function RapportClient({ jeton, etat: etatInitial, rapport, taux, conditions, telephone, depotEnLigne }) {
  const router = useRouter();
  const [etat, setEtat] = useState(etatInitial);
  const recommandes = pointsRecommandes(rapport.points);
  // Cochés au départ : les travaux urgents ; après une réponse, ceux approuvés
  const [coches, setCoches] = useState(() => new Set(recommandes
    .filter((p) => (etatInitial === "A_REPONDRE" ? p.etat === "URGENT" : p.approbation === "APPROUVE"))
    .map((p) => p.id)));
  const [nom, setNom] = useState(rapport.clientNom || "");
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState(rapport.signatureClient || null);
  const [reponduLe, setReponduLe] = useState(rapport.reponseLe);
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const aRepondre = etat === "A_REPONDRE";
  const r = resume(rapport.points);
  const retenus = recommandes.filter((p) => coches.has(p.id));
  const totaux = totauxRecommandes(retenus, taux);
  const photo = (id) => `/api/inspection-client/${jeton}/photos/${id}`;

  function basculer(id) {
    setCoches((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id); else apres.add(id);
      return apres;
    });
  }

  async function envoyer(reponse) {
    setErreur("");
    if (reponse === "APPROUVEE") {
      if (coches.size === 0) return setErreur("Cochez au moins un travail à approuver.");
      if (!nom.trim()) return setErreur("Entrez votre nom.");
      if (!signature) return setErreur("Signez dans la case avant d'approuver.");
    }
    setEnCours(true);
    const res = await fetch(`/api/inspection-client/${jeton}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reponse, nom, note, signature, points: [...coches] }),
    }).catch(() => null);
    setEnCours(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      return setErreur(data?.erreur || "Envoi impossible. Vérifiez votre connexion et réessayez.");
    }
    if (reponse === "REFUSEE") setCoches(new Set());
    setReponduLe(new Date().toISOString());
    setEtat(reponse);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Dépôt en ligne : la page relue propose le dépôt sur les travaux approuvés
    if (reponse === "APPROUVEE" && depotEnLigne) router.refresh();
  }

  return (
    <div>
      {etat === "APPROUVEE" && (
        <Bandeau couleur="var(--success)" titre="Travaux approuvés — merci !">
          Approuvés{rapport.signataireNom || nom ? ` par ${rapport.signataireNom || nom}` : ""}{reponduLe ? ` le ${DATE_HEURE.format(new Date(reponduLe))}` : ""}. Nous communiquerons avec vous pour la suite.
        </Bandeau>
      )}
      {etat === "APPROUVEE" && depotEnLigne && (
        <div style={{ marginBottom: 16 }}>
          <DepotEnLigne {...depotEnLigne} route={`/api/paiement-en-ligne/inspection/${jeton}`} />
        </div>
      )}
      {etat === "REFUSEE" && (
        <Bandeau couleur="var(--text-muted)" titre="Réponse reçue : pas de travaux pour l'instant">
          Merci{reponduLe ? `, votre réponse a été transmise le ${DATE_HEURE.format(new Date(reponduLe))}` : ""}. Pour en discuter{telephone ? `, appelez-nous au ${telephone}` : ", communiquez avec nous"}.
        </Bandeau>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Rapport d&apos;inspection</h1>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{DATE.format(new Date(rapport.date))}</span>
      </div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700 }}>{rapport.clientNom}</div>
        {rapport.vehicule && <div style={{ color: "var(--text-muted)" }}>{rapport.vehicule}{rapport.kilometrage != null ? ` · ${rapport.kilometrage.toLocaleString("fr-CA")} km` : ""}</div>}
        <div style={{ color: "var(--text-muted)", fontSize: 12.5 }}>{rapport.titre}{rapport.technicienNom ? ` par ${rapport.technicienNom}` : ""}</div>
      </div>

      {/* Résumé en trois chiffres */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        <Tuile n={r.URGENT} libelle="À faire maintenant" couleur="var(--danger)" fond="var(--danger-fond)" />
        <Tuile n={r.SURVEILLER} libelle="À surveiller" couleur="var(--avertissement)" fond="var(--avertissement-fond)" />
        <Tuile n={r.OK} libelle="En bon état" couleur="var(--success)" fond="var(--success-fond)" />
      </div>

      {rapport.noteGenerale && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>Mot du technicien</div>
          <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{rapport.noteGenerale}</div>
        </div>
      )}

      {/* Travaux recommandés */}
      {recommandes.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Travaux recommandés</h2>
          {aRepondre && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
              Cochez les travaux que vous voulez faire faire : le total s&apos;ajuste. Les prix sont des estimés avant taxes.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recommandes.map((p) => {
              const e = ETATS_POINT[p.etat];
              const coche = coches.has(p.id);
              const retenu = aRepondre || coche;
              return (
                <label
                  key={p.id}
                  style={{
                    display: "block", background: "var(--surface)", borderRadius: 14, padding: 14, cursor: aRepondre ? "pointer" : "default",
                    border: `1px solid ${aRepondre && coche ? "var(--success)" : "var(--border)"}`, borderLeft: `5px solid ${e.couleur}`,
                    opacity: retenu ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {aRepondre && (
                      <input type="checkbox" checked={coche} onChange={() => basculer(p.id)} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0, accentColor: "var(--success)" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{p.recommandation}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {p.prixEstime != null ? argent(p.prixEstime) : <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Prix à confirmer</span>}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 2 }}>
                        <span style={{ color: e.couleur, fontWeight: 700 }}>{e.libelleClient}</span>
                        <span style={{ color: "var(--text-muted)" }}> · {p.libelle}{p.mesure ? ` · ${avecUnite(p.mesure, p.unite)}` : ""}</span>
                      </div>
                      {p.constat && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{p.constat}</div>}
                      <Photos ids={p.photos} src={photo} libelle={p.libelle} />
                      {!aRepondre && <div style={{ fontSize: 12, color: coche ? "var(--success)" : "var(--text-muted)", fontWeight: 700, marginTop: 6 }}>{coche ? "Approuvé" : "Pas maintenant"}</div>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {(aRepondre || retenus.length > 0) && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginTop: 12 }}>
              <Ligne libelle={aRepondre ? "Travaux cochés" : "Travaux approuvés"} montant={totaux.sousTotal} grand gras />
              <Ligne libelle={`TPS (${pourcent(taux.tpsTaux)} %)`} montant={totaux.tps} />
              <Ligne libelle={`TVQ (${pourcent(taux.tvqTaux)} %)`} montant={totaux.tvq} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Total estimé</span>
                <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(totaux.total)}</span>
              </div>
              {totaux.aPrixAConfirmer > 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
                  Plus {totaux.aPrixAConfirmer} travail{totaux.aPrixAConfirmer > 1 ? "x" : ""} dont le prix vous sera confirmé avant de commencer.
                </p>
              )}
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0 0" }}>
                Estimé : le montant final peut varier selon les travaux réellement nécessaires. Nous vous avisons avant tout travail additionnel.
              </p>
            </div>
          )}
        </>
      )}

      {aRepondre && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Approuver les travaux</h2>
          <label htmlFor="nom-signataire" style={etiquette}>Votre nom</label>
          <input id="nom-signataire" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" style={champ} />

          <span style={etiquette}>Votre signature</span>
          <CaseSignature onChange={setSignature} />

          <label htmlFor="message-client" style={etiquette}>Message (facultatif)</label>
          <textarea id="message-client" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Une précision, une disponibilité…" style={{ ...champ, resize: "vertical", fontFamily: "inherit" }} />

          {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5, margin: "0 0 10px" }}>{erreur}</p>}

          <button onClick={() => envoyer("APPROUVEE")} disabled={enCours} style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: "var(--success)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            {enCours ? "Envoi…" : `Approuver ${coches.size > 1 ? `les ${coches.size} travaux` : "le travail coché"} — ${argent(totaux.total)}`}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0 0", textAlign: "center" }}>
            En approuvant, vous autorisez les travaux cochés{conditions?.trim() ? " et acceptez les conditions ci-dessous" : ""}.
          </p>

          {refusOuvert ? (
            <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--border)", borderRadius: 14 }}>
              <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>Aucun travail pour l&apos;instant ? Vous pouvez laisser un message plus haut.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => envoyer("REFUSEE")} disabled={enCours} style={{ ...boutonSecondaire, flex: 1 }}>Oui, pas maintenant</button>
                <button onClick={() => setRefusOuvert(false)} disabled={enCours} style={{ ...boutonSecondaire, flex: 1 }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRefusOuvert(true)} style={{ ...boutonSecondaire, width: "100%", marginTop: 14, color: "var(--text-muted)" }}>Pas de travaux pour l&apos;instant</button>
          )}
        </div>
      )}

      {etat === "APPROUVEE" && signature && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Signature de {rapport.signataireNom || nom}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signature} alt="Signature" style={{ display: "block", width: "100%", maxWidth: 360, height: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 10 }} />
        </div>
      )}
      {!aRepondre && rapport.noteClient && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Votre message : « {rapport.noteClient} »</p>
      )}

      {/* Détail de tous les points */}
      <h2 style={{ fontSize: 17, margin: "26px 0 10px" }}>Détail de l&apos;inspection</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {parSection(rapport.points).map((s) => (
          <section key={s.titre} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px" }}>
            <h3 style={{ fontSize: 14.5, margin: "2px 0 6px" }}>{s.titre}</h3>
            {s.points.map((p, i) => {
              const e = p.etat ? ETATS_POINT[p.etat] : null;
              return (
                <div key={p.id} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>{p.libelle}</span>
                    {p.mesure && <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{avecUnite(p.mesure, p.unite)}</span>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: e ? e.couleur : "var(--text-muted)", whiteSpace: "nowrap" }}>{e ? e.libelleClient : "Non vérifié"}</span>
                  </div>
                  {p.constat && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{p.constat}</div>}
                  {!(p.recommandation && (p.etat === "URGENT" || p.etat === "SURVEILLER")) && <Photos ids={p.photos} src={photo} libelle={p.libelle} petit />}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {conditions?.trim() && (
        <div style={{ marginTop: 26, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11, lineHeight: 1.45, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
          {conditions.trim()}
        </div>
      )}
    </div>
  );
}

function Photos({ ids, src, libelle, petit = false }) {
  if (!ids.length) return null;
  const taille = petit ? 64 : 92;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {ids.map((id) => (
        <a key={id} href={src(id)} target="_blank" rel="noopener noreferrer" title="Voir la photo en grand" onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(id)} alt={`Photo : ${libelle}`} loading="lazy" style={{ display: "block", width: taille, height: taille, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
        </a>
      ))}
    </div>
  );
}

function Tuile({ n, libelle, couleur, fond }) {
  return (
    <div style={{ background: fond, borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{libelle}</div>
    </div>
  );
}

function Bandeau({ couleur, titre, children }) {
  return (
    <div role="status" style={{ border: `1px solid ${couleur}`, borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16, background: "var(--surface)" }}>
      <div style={{ fontSize: 15.5, fontWeight: 800, color: couleur }}>{titre}</div>
      <div style={{ fontSize: 13.5, marginTop: 3 }}>{children}</div>
    </div>
  );
}

function Ligne({ libelle, montant, grand = false, gras = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: grand ? 14 : 13, color: grand ? "var(--text)" : "var(--text-muted)", fontWeight: gras ? 700 : 400, marginTop: 4 }}>
      <span>{libelle}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(montant)}</span>
    </div>
  );
}

const etiquette = { display: "block", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 };
const champ = {
  width: "100%", padding: "12px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
  color: "var(--text)", fontSize: 16, marginBottom: 12, boxSizing: "border-box",
};
const boutonSecondaire = {
  padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
