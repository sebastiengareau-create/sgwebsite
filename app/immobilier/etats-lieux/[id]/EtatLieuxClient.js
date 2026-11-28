"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEINTES, Icone } from "../../../components/StyleSection";
import { compresserImage } from "@/lib/images";
import { dateLisible, nomLogement, nomsLocataires } from "@/lib/immobilierCalculs";
import { ETATS_ELEMENT, avancement, comparerAEntree, dommagesDepuisEntree, nouvelleCle, pieceVide } from "@/lib/etatsLieuxCalculs";
import { Retour, Panneau, Erreur, champStyle, labelStyle, boutonPrincipal, lien } from "../../ui";
import { ChampAdresse } from "../../../components/ChampsAdresse";
import { adresseComplete } from "@/lib/adresse";

const ETAT = Object.fromEntries(ETATS_ELEMENT.map((e) => [e.code, e]));
const COURT = { BON: "Bon", USURE: "Usure", DOMMAGE: "Endommagé", NA: "S. O." };

async function appel(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erreur || "Erreur.");
  return data;
}

export default function EtatLieuxClient({ etat, entree, document, courriel }) {
  const router = useRouter();
  const sortie = etat.moment === "SORTIE";
  const termine = etat.statut === "TERMINE";
  const [pieces, setPieces] = useState(etat.pieces);
  const [compteurs, setCompteurs] = useState(() => ({ electricite: "", clesPorte: "", clesBoite: "", autresCles: "", avertisseurTeste: false, adresseSuivante: "", ...(etat.compteurs || {}) }));
  const [notes, setNotes] = useState(etat.notes || "");
  const [date, setDate] = useState(String(etat.date).slice(0, 10));
  const [photos, setPhotos] = useState(etat.photos);
  const [sauvegarde, setSauvegarde] = useState("");
  const [erreur, setErreur] = useState("");
  const [faireSigner, setFaireSigner] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const modifie = useRef(false);
  const premier = useRef(true);

  // Enregistrement automatique, 0,7 s après la dernière modification
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    if (termine) return;
    modifie.current = true;
    setSauvegarde("…");
    const t = setTimeout(async () => {
      try {
        await appel(`/api/immobilier/etats-lieux/${etat.id}`, { method: "PATCH", body: JSON.stringify({ pieces, compteurs, notes, date }) });
        modifie.current = false;
        setSauvegarde("Enregistré");
        setErreur("");
      } catch (e) {
        setSauvegarde("");
        setErreur(e.message);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [pieces, compteurs, notes, date, etat.id, termine]);
  useEffect(() => {
    const avertir = (e) => { if (modifie.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, []);

  const comparaison = useMemo(() => (sortie && entree ? comparerAEntree(entree.pieces, pieces) : {}), [sortie, entree, pieces]);
  const dommages = useMemo(() => (sortie && entree ? dommagesDepuisEntree(entree.pieces, pieces) : []), [sortie, entree, pieces]);
  const { notes: notesFaites, total } = avancement(pieces);

  const majElement = (pcle, ecle, champs) => setPieces((ps) => ps.map((p) => (p.cle !== pcle ? p : { ...p, elements: p.elements.map((e) => (e.cle === ecle ? { ...e, ...champs } : e)) })));
  const majPiece = (pcle, champs) => setPieces((ps) => ps.map((p) => (p.cle === pcle ? { ...p, ...champs } : p)));

  async function ajouterPhotos(element, fichiers) {
    setErreur("");
    for (const f of fichiers) {
      try {
        const dataUrl = await compresserImage(f);
        const ph = await appel(`/api/immobilier/etats-lieux/${etat.id}/photos`, { method: "POST", body: JSON.stringify({ element, dataUrl }) });
        setPhotos((l) => [...l, ph]);
      } catch (e) {
        setErreur(e.message);
      }
    }
  }
  async function retirerPhoto(id) {
    try {
      await appel(`/api/immobilier/etats-lieux/${etat.id}/photos/${id}`, { method: "DELETE" });
      setPhotos((l) => l.filter((p) => p.id !== id));
    } catch (e) {
      setErreur(e.message);
    }
  }
  async function action(url, corps, apres) {
    setErreur("");
    setEnCours(true);
    try {
      const data = await appel(url, { method: "POST", body: JSON.stringify(corps || {}) });
      apres?.(data);
      router.refresh();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }
  async function terminer() {
    if (modifie.current) await appel(`/api/immobilier/etats-lieux/${etat.id}`, { method: "PATCH", body: JSON.stringify({ pieces, compteurs, notes, date }) }).catch(() => {});
    await action(`/api/immobilier/etats-lieux/${etat.id}/terminer`, { faireSigner });
  }
  async function supprimer() {
    if (!window.confirm("Supprimer cet état des lieux et ses photos ?")) return;
    try {
      const data = await appel(`/api/immobilier/etats-lieux/${etat.id}`, { method: "DELETE" });
      router.push(`/immobilier/baux/${data.bailId || etat.bail.id}`);
    } catch (e) {
      setErreur(e.message);
    }
  }

  const bail = etat.bail;
  const signatures = (document?.signatures || []).filter((s) => s.statut !== "ANNULE");
  return (
    <div className="conteneur-page">
      <Retour href={`/immobilier/baux/${bail.id}`}>Bail — {nomLogement(bail.logement)}, {bail.logement.immeuble.nom}</Retour>
      <h1 style={{ fontSize: 21, margin: "10px 0 4px" }}>📋 État des lieux {sortie ? "de sortie" : "d'entrée"}</h1>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        {nomsLocataires(bail)} · {nomLogement(bail.logement)}{bail.logement.pieces ? ` · ${bail.logement.pieces}` : ""}
      </div>

      {/* Avancement */}
      <div style={{ padding: "4px 0 10px", marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
          <strong>{notesFaites} / {total} éléments notés</strong>
          <span style={{ color: erreur ? "var(--danger)" : "var(--text-muted)" }}>{termine ? "Terminé" : erreur ? "Non enregistré" : sauvegarde}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--success-fond)" }}>
          <div style={{ height: 6, borderRadius: 3, width: `${total ? Math.round((notesFaites / total) * 100) : 0}%`, background: "var(--success)" }} />
        </div>
      </div>
      <Erreur texte={erreur} />

      {termine && <Termine etat={etat} document={document} signatures={signatures} enCours={enCours} rouvrir={() => action(`/api/immobilier/etats-lieux/${etat.id}/rouvrir`)} />}

      {!termine && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
          <label htmlFor="date-visite">Visite du</label>
          <input id="date-visite" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...champStyle, width: "auto", marginBottom: 0 }} />
        </div>
      )}
      {sortie && (
        <p style={{ fontSize: 13, margin: "0 0 12px", color: entree ? "var(--text)" : "var(--avertissement)" }}>
          {entree ? <>Comparé à l'état des lieux d'entrée du <strong>{dateLisible(entree.date)}</strong>{entree.statut !== "TERMINE" && " (pas terminé)"} : ce qui avait été noté s'affiche sous chaque élément.</> : "Aucun état des lieux d'entrée pour ce bail dans l'appli : rien à comparer."}
        </p>
      )}
      {sortie && dommages.length > 0 && (
        <div style={{ border: "1.5px solid var(--danger)", background: "var(--danger-fond)", borderRadius: 12, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
          <strong style={{ color: "var(--danger)" }}>{dommages.length} dommage{dommages.length > 1 ? "s" : ""} depuis l'entrée</strong>
          {dommages.map((d) => <div key={`${d.piece}${d.element}`}>{d.piece} — {d.element}{d.note ? ` : ${d.note}` : ""}</div>)}
        </div>
      )}

      {pieces.map((p) => (
        <Piece
          key={p.cle} piece={p} photos={photos} comparaison={comparaison} lecture={termine} etatId={etat.id}
          majPiece={(c) => majPiece(p.cle, c)} majElement={(ecle, c) => majElement(p.cle, ecle, c)}
          retirer={() => window.confirm(`Retirer la pièce « ${p.nom} » et ses photos ?`) && setPieces((ps) => ps.filter((x) => x.cle !== p.cle))}
          ajouterPhotos={ajouterPhotos} retirerPhoto={retirerPhoto}
        />
      ))}
      {!termine && (
        <button type="button" onClick={() => { const nom = window.prompt("Nom de la pièce (ex. Bureau, Sous-sol) :"); if (nom?.trim()) setPieces((ps) => [...ps, pieceVide(nom.trim())]); }} style={{ ...lienBouton, marginBottom: 16 }}>
          + Ajouter une pièce
        </button>
      )}

      <Panneau icone="cadenas" teinte={TEINTES.bleu} titre="Compteurs et clés">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {[["electricite", "Compteur d'électricité"], ["clesPorte", "Clés de porte remises"], ["clesBoite", "Clés de boîte, casier"], ["autresCles", "Autres clés, cartes, télécommandes"]].map(([k, l]) => (
            <div key={k}><label style={labelStyle}>{l}</label><input value={compteurs[k]} disabled={termine} onChange={(e) => setCompteurs((c) => ({ ...c, [k]: e.target.value }))} style={champStyle} /></div>
          ))}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "4px 0 8px", cursor: "pointer" }}>
          <input type="checkbox" checked={compteurs.avertisseurTeste} disabled={termine} onChange={(e) => setCompteurs((c) => ({ ...c, avertisseurTeste: e.target.checked }))} /> Avertisseur de fumée testé et fonctionnel
        </label>
        {sortie && <div><label style={labelStyle}>Adresse du locataire après son départ</label><ChampAdresse valeur={compteurs.adresseSuivante} disabled={termine} onChange={(x) => setCompteurs((c) => ({ ...c, adresseSuivante: x }))} onChoisir={(a) => setCompteurs((c) => ({ ...c, adresseSuivante: adresseComplete(a) }))} placeholder="123 rue Principale, Ville QC J3B 6V5" style={champStyle} /></div>}
      </Panneau>

      <Panneau icone="crayon" teinte={TEINTES.neutre} titre="Remarques générales">
        <textarea value={notes} disabled={termine} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Propreté générale, odeurs, travaux convenus…" style={{ ...champStyle, resize: "vertical", fontFamily: "inherit" }} />
      </Panneau>

      {!termine && (
        <Panneau icone="crochet" teinte={TEINTES.vert} titre="Terminer" sousTitre="Le PDF (photos en annexe) va dans les documents du bail et dans l'espace du locataire">
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={faireSigner} onChange={(e) => setFaireSigner(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Faire signer en ligne par le locateur et {bail.locataires.length > 1 ? "les locataires" : "le locataire"}{courriel ? " (lien par courriel à ceux qui en ont un)" : " (liens à transmettre depuis les documents du bail)"}</span>
          </label>
          {notesFaites < total && <p style={{ fontSize: 12.5, color: "var(--avertissement)", margin: "0 0 8px" }}>{total - notesFaites} élément{total - notesFaites > 1 ? "s" : ""} sans état : ils paraîtront « — » dans le PDF.</p>}
          <button type="button" onClick={terminer} disabled={enCours || notesFaites === 0} className="bouton-3d" style={boutonPrincipal}>{enCours ? "Préparation du PDF…" : "Terminer et générer le PDF"}</button>
        </Panneau>
      )}
      {!signatures.length && (
        <button type="button" onClick={supprimer} style={{ ...lienBouton, color: "var(--danger)", marginTop: 4 }}>Supprimer cet état des lieux</button>
      )}
    </div>
  );
}

const lienBouton = { background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: "var(--accent-ombre)" };

function Termine({ etat, document, signatures, enCours, rouvrir }) {
  const signe = document?.signeLe;
  return (
    <div style={{ border: "1.5px solid var(--success)", background: "var(--success-fond)", borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 13.5 }}>
      <strong>Terminé le {dateLisible(etat.termineLe)}.</strong>{" "}
      {document && <a href={`/api/immobilier/documents/${document.id}${signe ? "?version=signee" : ""}`} target="_blank" rel="noreferrer" style={{ ...lien, fontWeight: 700 }}>{signe ? "📄 PDF signé" : "📄 Ouvrir le PDF"}</a>}
      <div style={{ marginTop: 6 }}>
        {signe ? "Signé par toutes les parties." : signatures.length ? <>Signatures : {signatures.filter((s) => s.statut === "SIGNE").length} / {signatures.length} reçues — suivi dans les <Link href={`/immobilier/baux/${etat.bail.id}`} style={lien}>documents du bail</Link>.</> : "Pas encore envoyé à la signature : « Faire signer » dans les documents du bail, ou rouvre-le pour corriger."}
      </div>
      {!signatures.length && <button type="button" onClick={rouvrir} disabled={enCours} style={{ ...lienBouton, marginTop: 6 }}>{enCours ? "…" : "Rouvrir pour corriger"}</button>}
    </div>
  );
}

function Piece({ piece, photos, comparaison, lecture, etatId, majPiece, majElement, retirer, ajouterPhotos, retirerPhoto }) {
  const [ouverte, setOuverte] = useState(true);
  const [edition, setEdition] = useState(false);
  const faits = piece.elements.filter((e) => e.etat).length;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
      <button type="button" onClick={() => setOuverte((x) => !x)} aria-expanded={ouverte} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", textAlign: "left" }}>
        <span style={{ transition: "transform 0.15s", transform: ouverte ? "rotate(90deg)" : "none", color: "var(--text-muted)" }}>›</span>
        <span style={{ flex: 1, fontSize: 15.5, fontWeight: 800 }}>{piece.nom}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: faits === piece.elements.length ? "var(--success)" : "var(--text-muted)" }}>{faits}/{piece.elements.length}</span>
      </button>
      {ouverte && (
        <div style={{ padding: "0 14px 10px" }}>
          {piece.elements.map((e) => (
            <Element key={e.cle} e={e} avant={comparaison[e.cle]} photos={photos.filter((p) => p.element === e.cle)} lecture={lecture} etatId={etatId} edition={edition}
              maj={(c) => majElement(e.cle, c)} retirer={() => majPiece({ elements: piece.elements.filter((x) => x.cle !== e.cle) })}
              ajouterPhotos={(f) => ajouterPhotos(e.cle, f)} retirerPhoto={retirerPhoto} />
          ))}
          {!lecture && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 6 }}>
              {edition && <button type="button" onClick={() => { const nom = window.prompt("Élément à ajouter (ex. Lave-vaisselle) :"); if (nom?.trim()) majPiece({ elements: [...piece.elements, { cle: nouvelleCle(), nom: nom.trim(), etat: null, note: "" }] }); }} style={lienBouton}>+ Élément</button>}
              {edition && <button type="button" onClick={() => { const nom = window.prompt("Nom de la pièce :", piece.nom); if (nom?.trim()) majPiece({ nom: nom.trim() }); }} style={lienBouton}>Renommer</button>}
              {edition && <button type="button" onClick={retirer} style={{ ...lienBouton, color: "var(--danger)" }}>Retirer la pièce</button>}
              <button type="button" onClick={() => setEdition((x) => !x)} style={{ ...lienBouton, color: "var(--text-muted)" }}>{edition ? "Fini" : "Modifier la liste"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Element({ e, avant, photos, lecture, etatId, edition, maj, retirer, ajouterPhotos, retirerPhoto }) {
  const [remarque, setRemarque] = useState(Boolean(e.note));
  const fichier = useRef(null);
  const voirNote = remarque || e.note || e.etat === "DOMMAGE";
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>{e.nom}</span>
        {!lecture && edition && <button type="button" onClick={retirer} aria-label={`Retirer ${e.nom}`} style={{ ...lienBouton, color: "var(--danger)", fontSize: 12.5, padding: 0 }}>Retirer</button>}
        {!lecture && !edition && (
          <>
            {!voirNote && <button type="button" onClick={() => setRemarque(true)} style={{ ...lienBouton, fontSize: 12.5, padding: 0, color: "var(--text-muted)" }}>Remarque</button>}
            <button type="button" onClick={() => fichier.current?.click()} aria-label={`Photo — ${e.nom}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-alt)", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: "var(--text)" }}>
              <Icone nom="camera" taille={15} />{photos.length > 0 && photos.length}
            </button>
            <input ref={fichier} type="file" accept="image/*" capture="environment" multiple hidden onChange={(ev) => { ajouterPhotos([...ev.target.files]); ev.target.value = ""; }} />
          </>
        )}
      </div>
      <div role="radiogroup" aria-label={`État — ${e.nom}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 5 }}>
        {ETATS_ELEMENT.map((s) => {
          const choisi = e.etat === s.code;
          return (
            <button
              key={s.code} type="button" role="radio" aria-checked={choisi} disabled={lecture} onClick={() => maj({ etat: choisi ? null : s.code })}
              style={{
                padding: "8px 2px", borderRadius: 9, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: lecture ? "default" : "pointer",
                border: `1.5px solid ${choisi ? s.couleur : "var(--border)"}`, background: choisi ? s.couleur : "transparent", color: choisi ? "#fff" : "var(--text-muted)",
              }}
            >
              {COURT[s.code]}
            </button>
          );
        })}
      </div>
      {avant && (
        <div style={{ fontSize: 12, marginTop: 6, color: avant.pire ? "var(--danger)" : "var(--text-muted)", fontWeight: avant.pire ? 700 : 400 }}>
          À l'entrée : {ETAT[avant.etat]?.label || "non noté"}{avant.note ? ` — ${avant.note}` : ""}{avant.pire ? " · ▲ moins bon qu'à l'entrée" : ""}
        </div>
      )}
      {voirNote && (lecture ? (e.note && <p style={{ fontSize: 13, margin: "6px 0 0" }}>{e.note}</p>) : (
        <textarea value={e.note} onChange={(ev) => maj({ note: ev.target.value })} rows={2} placeholder={e.etat === "DOMMAGE" ? "Quel dommage ? (ex. trou de 5 cm près de la porte)" : "Remarque"} style={{ ...champStyle, marginTop: 7, marginBottom: 0, resize: "vertical", fontFamily: "inherit" }} />
      ))}
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
          {photos.map((ph) => (
            <span key={ph.id} style={{ position: "relative" }}>
              <a href={`/api/immobilier/etats-lieux/${etatId}/photos/${ph.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/immobilier/etats-lieux/${etatId}/photos/${ph.id}`} alt={`Photo — ${e.nom}`} loading="lazy" style={{ display: "block", width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
              </a>
              {!lecture && <button type="button" onClick={() => retirerPhoto(ph.id)} aria-label="Retirer la photo" style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0 }}>×</button>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
