"use client";

import { useEffect, useRef, useState } from "react";
import { argent, nombre } from "@/lib/format";
import { totauxTaches } from "@/lib/approbationCalculs";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });
const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

const heures = (h) => `${Number.isInteger(h) ? h : nombre(h, 1)} h`;

export default function ApprobationClient({ jeton, etat: etatInitial, soumission, taux, conditions, telephone }) {
  const [etat, setEtat] = useState(etatInitial);
  // Travaux cochés : tous au départ ; après une réponse, ceux qui ont été approuvés
  const [coches, setCoches] = useState(() => new Set(soumission.taches.filter((t) => etatInitial === "A_REPONDRE" || !t.refusee).map((t) => t.id)));
  const [nom, setNom] = useState(soumission.clientNom || "");
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState(soumission.signatureClient || null);
  const [reponduLe, setReponduLe] = useState(soumission.reponseLe);
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const aRepondre = etat === "A_REPONDRE";
  const retenues = soumission.taches.filter((t) => coches.has(t.id));
  const totaux = totauxTaches(etat === "REFUSEE" ? soumission.taches : retenues, taux);
  const plusieurs = soumission.taches.length > 1;

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
    const res = await fetch(`/api/soumission-client/${jeton}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reponse, nom, note, signature, taches: [...coches] }),
    }).catch(() => null);
    setEnCours(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      return setErreur(data?.erreur || "Envoi impossible. Vérifiez votre connexion et réessayez.");
    }
    setReponduLe(new Date().toISOString());
    setEtat(reponse);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div>
      {etat === "APPROUVEE" && (
        <Bandeau couleur="var(--success)" titre="Soumission approuvée — merci !">
          Approuvée{soumission.signataireNom || nom ? ` par ${soumission.signataireNom || nom}` : ""}{reponduLe ? ` le ${DATE_HEURE.format(new Date(reponduLe))}` : ""}. Nous communiquerons avec vous pour la suite.
        </Bandeau>
      )}
      {etat === "REFUSEE" && (
        <Bandeau couleur="var(--danger)" titre="Soumission refusée">
          Votre réponse a été transmise{reponduLe ? ` le ${DATE_HEURE.format(new Date(reponduLe))}` : ""}. Pour en discuter ou la faire ajuster{telephone ? `, appelez-nous au ${telephone}` : ", communiquez avec nous"}.
        </Bandeau>
      )}
      {etat === "TRAITEE" && (
        <Bandeau couleur="var(--accent-ombre)" titre="Soumission déjà traitée">
          Cette soumission a déjà été prise en charge par notre équipe{telephone ? `. Pour toute question : ${telephone}` : ""}.
        </Bandeau>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Soumission #{soumission.numero}</h1>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{DATE.format(new Date(soumission.creeLe))}</span>
      </div>
      <div style={{ fontSize: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700 }}>{soumission.clientNom}</div>
        {soumission.vehiculeInfo && <div style={{ color: "var(--text-muted)" }}>{soumission.vehiculeInfo}</div>}
      </div>

      {aRepondre && plusieurs && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Décochez un travail que vous ne voulez pas faire faire : le total s&apos;ajuste.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {soumission.taches.map((t) => {
          const retenue = etat === "REFUSEE" ? true : coches.has(t.id);
          const montant = (t.tempsEstime || 0) * taux.tauxHoraire + t.pieces.reduce((s, p) => s + p.prixEstime * p.qte, 0);
          return (
            <label
              key={t.id}
              style={{
                display: "block", background: "var(--surface)", border: `1px solid ${retenue && aRepondre ? "var(--success)" : "var(--border)"}`,
                borderRadius: 14, padding: 14, opacity: retenue ? 1 : 0.55, cursor: aRepondre && plusieurs ? "pointer" : "default",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {aRepondre && plusieurs && (
                  <input type="checkbox" checked={coches.has(t.id)} onChange={() => basculer(t.id)} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0, accentColor: "var(--success)" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, textDecoration: retenue ? "none" : "line-through" }}>{t.description}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{argent(montant)}</span>
                  </div>
                  {t.tempsEstime > 0 && (
                    <Ligne libelle={`Main-d'œuvre — ${heures(t.tempsEstime)} × ${argent(taux.tauxHoraire)}`} montant={t.tempsEstime * taux.tauxHoraire} />
                  )}
                  {t.pieces.map((p) => (
                    <Ligne key={p.id} libelle={`${p.nom}${p.qte !== 1 ? ` × ${p.qte}` : ""}`} montant={p.prixEstime * p.qte} />
                  ))}
                  {!retenue && !aRepondre && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Non retenu</div>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginTop: 14 }}>
        <Ligne libelle="Main-d'œuvre" montant={totaux.mainOeuvre} grand />
        <Ligne libelle="Pièces" montant={totaux.pieces} grand />
        <Ligne libelle="Sous-total" montant={totaux.sousTotal} grand gras />
        <Ligne libelle={`TPS (${nombre(taux.tpsTaux, 3).replace(/[,.]?0+$/, "")} %)`} montant={totaux.tps} />
        <Ligne libelle={`TVQ (${nombre(taux.tvqTaux, 3).replace(/[,.]?0+$/, "")} %)`} montant={totaux.tvq} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Total estimé</span>
          <span style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{argent(totaux.total)}</span>
        </div>
        {soumission.totalDepots > 0 && (
          <>
            <Ligne libelle="Dépôt reçu" montant={-soumission.totalDepots} />
            <Ligne libelle="Solde estimé" montant={totaux.total - soumission.totalDepots} grand gras />
          </>
        )}
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "10px 0 0" }}>
          Estimé : le montant final peut varier selon les travaux réellement nécessaires. Nous vous avisons avant tout travail additionnel.
        </p>
      </div>

      {etat === "APPROUVEE" && signature && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Signature de {soumission.signataireNom || nom}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signature} alt="Signature" style={{ display: "block", width: "100%", maxWidth: 360, height: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 10 }} />
        </div>
      )}
      {!aRepondre && soumission.noteClient && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Votre message : « {soumission.noteClient} »</p>
      )}

      {aRepondre && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 17, margin: "0 0 10px" }}>Approuver les travaux</h2>
          <label style={etiquette}>Votre nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" style={champ} />

          <label style={etiquette}>Votre signature</label>
          <CaseSignature onChange={setSignature} />

          <label style={etiquette}>Message (facultatif)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Une précision, une disponibilité…" style={{ ...champ, resize: "vertical", fontFamily: "inherit" }} />

          {erreur && <p role="alert" style={{ color: "var(--danger)", fontSize: 13.5, margin: "0 0 10px" }}>{erreur}</p>}

          <button onClick={() => envoyer("APPROUVEE")} disabled={enCours} style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: "var(--success)", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            {enCours ? "Envoi…" : `Approuver — ${argent(totaux.total)}`}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0 0", textAlign: "center" }}>
            En approuvant, vous autorisez les travaux cochés{conditions?.trim() ? " et acceptez les conditions ci-dessous" : ""}.
          </p>

          {refusOuvert ? (
            <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--danger)", borderRadius: 14 }}>
              <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>Refuser toute la soumission ? Vous pouvez laisser un message plus haut pour nous dire pourquoi.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => envoyer("REFUSEE")} disabled={enCours} style={{ ...boutonSecondaire, flex: 1, borderColor: "var(--danger)", color: "var(--danger)" }}>Oui, refuser</button>
                <button onClick={() => setRefusOuvert(false)} disabled={enCours} style={{ ...boutonSecondaire, flex: 1 }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRefusOuvert(true)} style={{ ...boutonSecondaire, width: "100%", marginTop: 14, color: "var(--text-muted)" }}>Refuser la soumission</button>
          )}
        </div>
      )}

      {conditions?.trim() && (
        <div style={{ marginTop: 26, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11, lineHeight: 1.45, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
          {conditions.trim()}
        </div>
      )}
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

// Case où signer du doigt, du stylet ou de la souris. Toujours sur fond
// blanc avec encre foncée, peu importe le thème : c'est l'image conservée.
function CaseSignature({ onChange }) {
  const canvasRef = useRef(null);
  const trace = useRef({ enCours: false, x: 0, y: 0 });
  const [vide, setVide] = useState(true);

  function preparer() {
    const canvas = canvasRef.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.strokeStyle = "#17150f";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  useEffect(preparer, []);

  function position(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function debut(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    trace.current = { enCours: true, ...position(e) };
  }
  function bouge(e) {
    if (!trace.current.enCours) return;
    const { x, y } = position(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(trace.current.x, trace.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    trace.current = { enCours: true, x, y };
    if (vide) setVide(false);
  }
  function fin() {
    if (!trace.current.enCours) return;
    trace.current.enCours = false;
    if (!vide) onChange(canvasRef.current.toDataURL("image/png"));
  }
  function effacer() {
    preparer();
    setVide(true);
    onChange(null);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={debut} onPointerMove={bouge} onPointerUp={fin} onPointerCancel={fin}
          aria-label="Case de signature"
          style={{ display: "block", width: "100%", height: 160, background: "#fff", border: "1.5px dashed var(--border)", borderRadius: 12, touchAction: "none", cursor: "crosshair" }}
        />
        {vide && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#9c978a", pointerEvents: "none" }}>
            Signez ici avec le doigt
          </span>
        )}
      </div>
      {!vide && (
        <button type="button" onClick={effacer} style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 13, color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer" }}>
          Effacer et recommencer
        </button>
      )}
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
