"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ETATS_POINT, parSection, resume, pointsRecommandes, totauxRecommandes, etapeInspection, estARecommander, avecUnite, etatPropose } from "@/lib/grillesInspection";
import { libelleVehicule } from "@/lib/vehicules";
import { nomClientBon } from "@/lib/nomClient";
import { compresserImage } from "@/lib/images";
import { argent } from "@/lib/format";
import { MESSAGES_TEXTO } from "@/lib/textos";
import { useChoixPhoto } from "@/app/components/ChoixPhoto";
import BoutonTexto from "@/app/components/BoutonTexto";
import BoutonEnvoiCourriel from "@/app/components/BoutonEnvoiCourriel";
import { Pastille } from "@/app/components/StyleSection";

// Boutons d'état d'un point, dans l'ordre où le technicien les cherche
const BOUTONS_ETAT = [
  { cle: "OK", libelle: "OK", fond: "var(--success)", texte: "#fff" },
  { cle: "SURVEILLER", libelle: "À surveiller", fond: "var(--avertissement)", texte: "#17150f" },
  { cle: "URGENT", libelle: "Urgent", fond: "var(--danger)", texte: "#fff" },
  { cle: "NA", libelle: "S. O.", fond: "var(--text-muted)", texte: "var(--bg)" },
];

const DATE_HEURE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

export default function InspectionClient({ inspection: initiale, lien: lienInitial, verrouille, comptoir, taux, nomEntreprise, seuils }) {
  const router = useRouter();
  const [insp, setInsp] = useState(() => { const { points, ...reste } = initiale; return reste; });
  const [points, setPoints] = useState(initiale.points);
  const [lien, setLien] = useState(lienInitial);
  const [message, setMessage] = useState(null); // { texte, erreur }
  const [enCours, setEnCours] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const bon = initiale.bon;
  const repondu = !!insp.reponseClient;
  const modifiable = !verrouille && !repondu;
  const remplissable = modifiable && insp.statut === "EN_COURS";
  const r = resume(points);
  const vehicule = bon.vehicule ? libelleVehicule(bon.vehicule) : "";
  const etape = etapeInspection({ ...insp, points });

  const avertir = (texte, erreur = true) => setMessage({ texte, erreur });

  async function appel(url, options = {}) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) throw new Error(data?.erreur || "Rien n'a été enregistré : vérifie la connexion et réessaie.");
    return data;
  }

  // Point : changé tout de suite à l'écran, puis enregistré ; remis comme
  // avant si l'enregistrement échoue
  async function majPoint(id, champs) {
    const avant = points.find((p) => p.id === id);
    setPoints((ps) => ps.map((p) => (p.id === id ? { ...p, ...champs } : p)));
    try {
      const maj = await appel(`/api/inspections/${insp.id}/points/${id}`, { method: "PATCH", body: JSON.stringify(champs) });
      setPoints((ps) => ps.map((p) => (p.id === id ? { ...p, ...maj } : p)));
      return true;
    } catch (e) {
      setPoints((ps) => ps.map((p) => (p.id === id ? avant : p)));
      avertir(e.message);
      return false;
    }
  }

  async function majEntete(champs) {
    try {
      const maj = await appel(`/api/inspections/${insp.id}`, { method: "PATCH", body: JSON.stringify(champs) });
      setInsp((i) => ({ ...i, ...maj }));
      return true;
    } catch (e) {
      avertir(e.message);
      return false;
    }
  }

  async function toutOk(section) {
    await Promise.all(section.points.filter((p) => !p.etat).map((p) => majPoint(p.id, { etat: "OK" })));
  }

  async function ajouterPoint(section, libelle) {
    try {
      const point = await appel(`/api/inspections/${insp.id}/points`, { method: "POST", body: JSON.stringify({ section, libelle }) });
      setPoints((ps) => [...ps, point]);
      return true;
    } catch (e) {
      avertir(e.message);
      return false;
    }
  }

  async function supprimerPoint(id) {
    try {
      await appel(`/api/inspections/${insp.id}/points/${id}`, { method: "DELETE" });
      setPoints((ps) => ps.filter((p) => p.id !== id));
    } catch (e) {
      avertir(e.message);
    }
  }

  async function ajouterPhotos(pointId, fichiers) {
    for (const fichier of fichiers) {
      try {
        const dataUrl = await compresserImage(fichier);
        const photo = await appel(`/api/inspections/${insp.id}/points/${pointId}/photos`, { method: "POST", body: JSON.stringify({ dataUrl }) });
        setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, photos: [...p.photos, photo] } : p)));
      } catch (e) {
        avertir(e.message);
        return;
      }
    }
  }

  async function supprimerPhoto(pointId, photoId) {
    try {
      await appel(`/api/inspections/${insp.id}/photos/${photoId}`, { method: "DELETE" });
      setPoints((ps) => ps.map((p) => (p.id === pointId ? { ...p, photos: p.photos.filter((ph) => ph.id !== photoId) } : p)));
    } catch (e) {
      avertir(e.message);
    }
  }

  async function changerStatut(action) {
    setEnCours(true);
    setMessage(null);
    const ok = await majEntete({ action });
    setEnCours(false);
    if (ok && action === "terminer") {
      setMessage({ texte: comptoir ? "Inspection terminée. Mets les prix des travaux recommandés, puis envoie le rapport au client." : "Inspection terminée. Le comptoir peut maintenant envoyer le rapport au client.", erreur: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function supprimer() {
    setEnCours(true);
    try {
      await appel(`/api/inspections/${insp.id}`, { method: "DELETE" });
      router.push(`/bons/${bon.id}`);
      router.refresh();
    } catch (e) {
      setEnCours(false);
      avertir(e.message);
    }
  }

  async function ajouterAuBon(pointIds) {
    setEnCours(true);
    try {
      const { taches } = await appel(`/api/inspections/${insp.id}/ajouter-au-bon`, { method: "POST", body: JSON.stringify(pointIds ? { pointIds } : {}) });
      const parPoint = Object.fromEntries(taches.map((t) => [t.pointId, t.id]));
      setPoints((ps) => ps.map((p) => (parPoint[p.id] ? { ...p, problemeId: parPoint[p.id] } : p)));
      setMessage({ texte: `${taches.length > 1 ? `${taches.length} tâches ajoutées` : "Tâche ajoutée"} au bon #${bon.numero}.`, erreur: false });
    } catch (e) {
      avertir(e.message);
    }
    setEnCours(false);
  }

  // Lien du rapport, créé au besoin ; texto : compte comme un envoi
  async function lienRapport(texto = false) {
    const data = await appel(`/api/inspections/${insp.id}/lien-client`, { method: "POST", body: JSON.stringify({ texto }) });
    setLien(data.lien);
    if (texto) setInsp((i) => ({ ...i, envoyeeLe: new Date().toISOString() }));
    return data.lien;
  }

  return (
    <div className="conteneur-page" style={{ paddingBottom: 90 }}>
      <Link href={`/bons/${bon.id}`} style={{ display: "inline-block", color: "var(--text-muted)", fontSize: 12.5, textDecoration: "none", marginBottom: 10 }}>
        ← Bon #{bon.numero}
      </Link>

      {/* En-tête : inspection, véhicule, progression */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>{insp.titre}</h1>
          <Pastille couleur={etape.couleur} fond="var(--surface-alt)">{etape.libelle}</Pastille>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{nomClientBon(bon)}</div>
        {vehicule && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{vehicule}</div>}
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {insp.technicienNom ? `Par ${insp.technicienNom} · ` : ""}commencée le {DATE_HEURE.format(new Date(insp.creeLe))}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
          <label style={{ display: "block" }}>
            <span style={etiquette}>Kilométrage</span>
            {modifiable ? (
              <ChampEnregistre
                valeur={insp.kilometrage ?? ""} inputMode="numeric" placeholder="ex. 84 500" style={{ width: 130 }}
                onEnregistrer={(v) => majEntete({ kilometrage: v })}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700 }}>{insp.kilometrage != null ? `${insp.kilometrage.toLocaleString("fr-CA")} km` : "—"}</span>
            )}
          </label>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
              <span>{r.total - r.aVerifier} / {r.total} points vérifiés</span>
              <span style={{ display: "inline-flex", gap: 10 }}>
                <Compte couleur="var(--danger)" n={r.URGENT} />
                <Compte couleur="var(--avertissement)" n={r.SURVEILLER} />
                <Compte couleur="var(--success)" n={r.OK} />
              </span>
            </div>
            <BarreProgression r={r} />
          </div>
        </div>
      </div>

      {verrouille && (
        <Avis>Le bon est facturé : l&apos;inspection ne se modifie plus. Son rapport peut encore être envoyé au client.</Avis>
      )}

      {/* Rapport au client : une fois l'inspection terminée */}
      {insp.statut === "TERMINEE" && (
        <PanneauRapport
          insp={insp} points={points} bon={bon} vehicule={vehicule} lien={lien} comptoir={comptoir} verrouille={verrouille}
          taux={taux} nomEntreprise={nomEntreprise} enCours={enCours}
          onMajPoint={majPoint} onAjouterAuBon={ajouterAuBon} onLien={lienRapport}
        />
      )}

      {/* Points, section par section */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {parSection(points).map((section) => (
          <Section
            key={section.titre} section={section} inspId={insp.id} remplissable={remplissable} comptoir={comptoir} seuils={seuils}
            onToutOk={() => toutOk(section)} onAjouterPoint={(libelle) => ajouterPoint(section.titre, libelle)}
            onMajPoint={majPoint} onPhotos={ajouterPhotos} onSupprimerPhoto={supprimerPhoto} onSupprimerPoint={supprimerPoint}
          />
        ))}
      </div>

      {/* Mot au client */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginTop: 14 }}>
        <span style={etiquette}>Mot au client (en tête du rapport)</span>
        {modifiable ? (
          <ChampEnregistre
            multiligne valeur={insp.noteGenerale ?? ""} placeholder="Ex. Véhicule en bon état général. Prévoir les pneus avant l'hiver."
            onEnregistrer={(v) => majEntete({ noteGenerale: v })}
          />
        ) : (
          <p style={{ fontSize: 14, margin: 0, whiteSpace: "pre-wrap", color: insp.noteGenerale ? "var(--text)" : "var(--text-muted)" }}>{insp.noteGenerale || "—"}</p>
        )}
      </div>

      {/* Terminer, rouvrir, supprimer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
        {remplissable && (
          <>
            <button
              type="button" onClick={() => changerStatut("terminer")} disabled={enCours} className="bouton-3d"
              style={{ width: "100%", padding: 15, borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer" }}
            >
              {enCours ? "…" : r.aVerifier ? `Terminer l'inspection (${r.aVerifier} à vérifier)` : "Terminer l'inspection"}
            </button>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
              Chaque point doit avoir un état. « S. O. » : sans objet pour ce véhicule.
            </p>
          </>
        )}
        {insp.statut === "TERMINEE" && modifiable && (
          <button type="button" onClick={() => changerStatut("rouvrir")} disabled={enCours} style={boutonSecondaire}>
            Rouvrir l&apos;inspection pour la modifier
          </button>
        )}
        {comptoir && modifiable && (
          confirmerSuppression ? (
            <div style={{ border: "1px solid var(--danger)", borderRadius: 12, padding: 12 }}>
              <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>Supprimer cette inspection, ses points et ses photos ?</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={supprimer} disabled={enCours} style={{ ...boutonSecondaire, flex: 1, color: "var(--danger)", borderColor: "var(--danger)" }}>Oui, supprimer</button>
                <button type="button" onClick={() => setConfirmerSuppression(false)} style={{ ...boutonSecondaire, flex: 1 }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmerSuppression(true)} style={{ ...boutonSecondaire, color: "var(--text-muted)", fontWeight: 600 }}>Supprimer l&apos;inspection</button>
          )
        )}
      </div>

      {message && (
        <div
          role={message.erreur ? "alert" : "status"}
          style={{
            position: "fixed", left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", zIndex: 50, maxWidth: 560, margin: "0 auto",
            display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, fontSize: 13.5,
            background: "var(--surface)", border: `1px solid ${message.erreur ? "var(--danger)" : "var(--success)"}`, boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ flex: 1, color: message.erreur ? "var(--danger)" : "var(--text)" }}>{message.texte}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Fermer" style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
        </div>
      )}
    </div>
  );
}

// ---------- Rapport au client (inspection terminée) ----------

function PanneauRapport({ insp, points, bon, vehicule, lien, comptoir, verrouille, taux, nomEntreprise, enCours, onMajPoint, onAjouterAuBon, onLien }) {
  const recommandes = pointsRecommandes(points);
  const repondu = !!insp.reponseClient;
  const prixModifiables = comptoir && !repondu && !verrouille;
  const retenus = repondu ? recommandes.filter((p) => p.approbation === "APPROUVE") : recommandes;
  const totaux = totauxRecommandes(retenus, taux);
  const sansTravail = points.filter((p) => estARecommander(p) && !p.recommandation?.trim()).length;
  const approuvesAAjouter = recommandes.filter((p) => p.approbation === "APPROUVE" && !p.problemeId);
  const [lienErreur, setLienErreur] = useState("");

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 18, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Rapport au client</div>

      {insp.reponseClient === "APPROUVEE" && (
        <Bandeau couleur="var(--success)" titre={`Travaux approuvés par ${insp.signataireNom || "le client"}`}>
          {insp.reponseLe ? `Le ${DATE_HEURE.format(new Date(insp.reponseLe))}. ` : ""}
          {recommandes.filter((p) => p.approbation === "APPROUVE").length} sur {recommandes.length} travaux recommandés.
        </Bandeau>
      )}
      {insp.reponseClient === "REFUSEE" && (
        <Bandeau couleur="var(--danger)" titre="Le client a répondu « pas maintenant »">
          {insp.reponseLe ? `Le ${DATE_HEURE.format(new Date(insp.reponseLe))}.` : ""}
        </Bandeau>
      )}
      {insp.noteClient && <p style={{ fontSize: 13, margin: "0 0 10px" }}>Message du client : « {insp.noteClient} »</p>}
      {!repondu && (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
          {recommandes.length
            ? comptoir
              ? "Vérifie les travaux recommandés et leur prix (avant taxes), puis envoie le rapport. Le client coche ce qu'il accepte et signe en ligne."
              : "Le comptoir met les prix et envoie le rapport au client."
            : "Aucun travail recommandé : le client recevra le rapport pour information."}
          {insp.envoyeeLe ? ` Dernier envoi : ${DATE_HEURE.format(new Date(insp.envoyeeLe))}.` : ""}
        </p>
      )}

      {recommandes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recommandes.map((p) => (
            <TravailRecommande
              key={p.id} point={p} prixModifiable={prixModifiables} repondu={repondu}
              peutAjouter={comptoir && !verrouille && !p.problemeId && (!repondu || p.approbation === "APPROUVE")}
              enCours={enCours} onMajPoint={onMajPoint} onAjouter={() => onAjouterAuBon([p.id])}
            />
          ))}
        </div>
      )}
      {sansTravail > 0 && !repondu && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
          {sansTravail} point{sansTravail > 1 ? "s" : ""} à surveiller ou urgent{sansTravail > 1 ? "s" : ""} sans travail recommandé : le client le{sansTravail > 1 ? "s" : ""} voit dans le détail du rapport seulement.
        </p>
      )}

      {retenus.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 13 }}>
          <LigneMontant libelle={repondu ? "Travaux approuvés (avant taxes)" : "Total des travaux recommandés (avant taxes)"} montant={totaux.sousTotal} />
          <LigneMontant libelle="Avec taxes" montant={totaux.total} gras />
          {totaux.aPrixAConfirmer > 0 && (
            <div style={{ fontSize: 12, color: "var(--avertissement)", marginTop: 4 }}>
              {repondu
                ? `${totaux.aPrixAConfirmer} travail${totaux.aPrixAConfirmer > 1 ? "x approuvés" : " approuvé"} sans prix : à confirmer avec le client.`
                : `${totaux.aPrixAConfirmer} travail${totaux.aPrixAConfirmer > 1 ? "x" : ""} sans prix : le client verra « prix à confirmer ».`}
            </div>
          )}
        </div>
      )}

      {comptoir && !verrouille && approuvesAAjouter.length > 1 && (
        <button
          type="button" onClick={() => onAjouterAuBon(null)} disabled={enCours} className="bouton-3d"
          style={{ width: "100%", marginTop: 12, padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}
        >
          Ajouter les {approuvesAAjouter.length} travaux approuvés au bon
        </button>
      )}

      {insp.reponseClient === "APPROUVEE" && insp.signatureClient && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Signature de {insp.signataireNom}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={insp.signatureClient} alt="Signature du client" style={{ display: "block", width: "100%", maxWidth: 300, height: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 10 }} />
        </div>
      )}

      {comptoir && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <BoutonEnvoiCourriel
            url={`/api/inspections/${insp.id}/envoyer`} courrielDefaut={bon.client.courriel || ""} libelle="📧 Envoyer par courriel"
            style={{ flex: "1 1 150px", fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 12 }}
          />
          <BoutonTexto
            telephone={bon.client.telephone}
            message={async () => MESSAGES_TEXTO.inspection({ nom: nomClientBon(bon), vehicule, lien: await onLien(true), nomEntreprise })}
            libelle="💬 Envoyer par texto"
            style={{ flex: "1 1 150px", fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: "pointer" }}
          />
          {lien ? (
            <a href={lien} target="_blank" rel="noopener noreferrer" style={{ flex: "1 1 150px", textAlign: "center", fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none" }}>
              Voir le rapport du client ↗
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onLien(false).catch((e) => setLienErreur(e.message))}
              style={{ flex: "1 1 150px", fontSize: 13, fontWeight: 700, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: "pointer" }}
            >
              Préparer le lien du rapport
            </button>
          )}
          {lienErreur && <span role="alert" style={{ flexBasis: "100%", fontSize: 12, color: "var(--danger)" }}>{lienErreur}</span>}
        </div>
      )}
    </div>
  );
}

function TravailRecommande({ point, prixModifiable, repondu, peutAjouter, enCours, onMajPoint, onAjouter }) {
  const etat = ETATS_POINT[point.etat];
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: `4px solid ${etat.couleur}`, borderRadius: 12, padding: "10px 12px", background: "var(--bg)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{point.recommandation}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ color: etat.couleur, fontWeight: 700 }}>{etat.libelle}</span> · {point.libelle}{point.mesure ? ` · ${avecUnite(point.mesure, point.unite)}` : ""}
          </div>
        </div>
        {prixModifiable ? (
          <label style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <ChampEnregistre
              valeur={point.prixEstime ?? ""} inputMode="decimal" placeholder="Prix" style={{ width: 96, textAlign: "right" }} aria-label={`Prix : ${point.recommandation}`}
              onEnregistrer={(v) => onMajPoint(point.id, { prixEstime: v })}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>$</span>
          </label>
        ) : (
          <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {point.prixEstime != null ? argent(point.prixEstime) : <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Prix à confirmer</span>}
          </span>
        )}
      </div>
      {(repondu || point.problemeId || peutAjouter) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {repondu && (point.approbation === "APPROUVE"
            ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Approuvé</Pastille>
            : <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Pas maintenant</Pastille>)}
          {point.problemeId && <span style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 700 }}>✓ Sur le bon</span>}
          {peutAjouter && (
            <button type="button" onClick={onAjouter} disabled={enCours} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>
              ➕ Ajouter au bon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Points de l'inspection ----------

function Section({ section, inspId, remplissable, comptoir, seuils, onToutOk, onAjouterPoint, onMajPoint, onPhotos, onSupprimerPhoto, onSupprimerPoint }) {
  const r = resume(section.points);
  const [ajout, setAjout] = useState(null); // null | texte du nouveau point
  const [occupe, setOccupe] = useState(false);

  async function ajouter(e) {
    e.preventDefault();
    if (!ajout?.trim()) return;
    setOccupe(true);
    if (await onAjouterPoint(ajout.trim())) setAjout(null);
    setOccupe(false);
  }

  return (
    <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, flex: 1, minWidth: 0 }}>{section.titre}</h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.total - r.aVerifier} / {r.total}</span>
        {remplissable && r.aVerifier > 0 && (
          <button type="button" onClick={onToutOk} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--success)", background: "var(--success-fond)", color: "var(--success)", cursor: "pointer", whiteSpace: "nowrap" }}>
            Reste OK
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {section.points.map((p) => (
          <Point
            key={p.id} point={p} inspId={inspId} remplissable={remplissable} comptoir={comptoir} seuils={seuils}
            onMaj={(champs) => onMajPoint(p.id, champs)} onPhotos={(f) => onPhotos(p.id, f)}
            onSupprimerPhoto={(photoId) => onSupprimerPhoto(p.id, photoId)} onSupprimer={() => onSupprimerPoint(p.id)}
          />
        ))}
      </div>
      {remplissable && (ajout === null ? (
        <button type="button" onClick={() => setAjout("")} style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)", background: "none", border: "1px dashed var(--border)", borderRadius: 10, padding: "7px 12px", cursor: "pointer", width: "100%" }}>
          + Ajouter un point à « {section.titre} »
        </button>
      ) : (
        <form onSubmit={ajouter} style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input
            autoFocus value={ajout} onChange={(e) => setAjout(e.target.value)} maxLength={120} placeholder="Ex. Support de pare-chocs"
            aria-label={`Nouveau point dans ${section.titre}`} className="champ" style={{ flex: 1, minWidth: 0, fontSize: 14 }}
          />
          <button type="submit" disabled={occupe || !ajout.trim()} className="bouton-3d" style={{ padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 800 }}>Ajouter</button>
          <button type="button" onClick={() => setAjout(null)} style={{ ...boutonSecondaire, padding: "0 12px", fontSize: 13 }}>Annuler</button>
        </form>
      ))}
    </section>
  );
}

function Point({ point, inspId, remplissable, comptoir, seuils, onMaj, onPhotos, onSupprimerPhoto, onSupprimer }) {
  const etat = point.etat ? ETATS_POINT[point.etat] : null;
  // Point avec unité (plaquettes, pneus, batterie…) : la mesure se prend sur
  // la ligne même, et l'état est proposé selon les seuils (Paramètres)
  const mesureEnLigne = !!point.unite;
  const propose = etatPropose(point.mesure, point.unite, seuils);
  const aDetails = !!((!mesureEnLigne && point.mesure) || point.constat || point.recommandation || point.photos.length);
  const [ouvert, setOuvert] = useState(estARecommander(point) || aDetails);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const photo = useChoixPhoto(async (fichiers) => {
    setEnvoiPhoto(true);
    await onPhotos(fichiers);
    setEnvoiPhoto(false);
  }, { multiple: true });

  function choisirEtat(cle) {
    if (cle === point.etat) return;
    onMaj({ etat: cle });
    if (cle === "SURVEILLER" || cle === "URGENT") setOuvert(true);
  }

  // Mesure enregistrée : sur un point pas encore vérifié, l'état proposé
  // s'applique du même coup (le technicien peut le changer)
  function enregistrerMesure(mesure) {
    const p = etatPropose(mesure, point.unite, seuils);
    if (p && !point.etat) {
      if (p.etat === "SURVEILLER" || p.etat === "URGENT") setOuvert(true);
      return onMaj({ mesure, etat: p.etat });
    }
    return onMaj({ mesure });
  }

  const voirDetails = remplissable ? ouvert : aDetails;

  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: `4px solid ${etat ? etat.couleur : "var(--border)"}`, borderRadius: 12, padding: "10px 10px 10px 12px", background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>
          {point.libelle}
          {point.ajoute && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginLeft: 6 }}>ajouté</span>}
        </div>
        {!remplissable && mesureEnLigne && point.mesure && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{avecUnite(point.mesure, point.unite)}</span>
        )}
        {!remplissable && etat && <Pastille couleur={etat.couleur} fond={etat.fond}>{etat.libelle}</Pastille>}
        {!remplissable && !etat && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Non vérifié</span>}
        {remplissable && (
          <button
            type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}
            style={{ fontSize: 12, fontWeight: 700, color: aDetails ? "var(--text)" : "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 999, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {ouvert ? "Fermer" : `Détails${point.photos.length ? ` · ${point.photos.length} 📷` : ""}`}
          </button>
        )}
      </div>

      {remplissable && mesureEnLigne && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Mesure</span>
            <ChampEnregistre
              valeur={point.mesure ?? ""} inputMode="decimal" aria-label={`Mesure : ${point.libelle} (${point.unite})`}
              placeholder={point.unite === "mm" ? "ex. 3" : point.unite === "V" ? "ex. 12,6" : "ex. 5"} style={{ width: 86 }}
              onEnregistrer={enregistrerMesure}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{point.unite}</span>
          </label>
          <IndicePropose propose={propose} etat={point.etat} onAppliquer={() => choisirEtat(propose.etat)} />
        </div>
      )}

      {remplissable && (
        <div role="group" aria-label={`État : ${point.libelle}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
          {BOUTONS_ETAT.map((b) => {
            const choisi = point.etat === b.cle;
            return (
              <button
                key={b.cle} type="button" onClick={() => choisirEtat(b.cle)} aria-pressed={choisi}
                style={{
                  padding: "10px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: "pointer", lineHeight: 1.15,
                  border: `1.5px solid ${choisi ? b.fond : "var(--border)"}`, background: choisi ? b.fond : "var(--surface)", color: choisi ? b.texte : "var(--text-muted)",
                }}
              >
                {b.libelle}
              </button>
            );
          })}
        </div>
      )}

      {voirDetails && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {remplissable ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!mesureEnLigne && (
                  <label style={{ flex: "0 1 140px" }}>
                    <span style={etiquette}>Mesure</span>
                    <ChampEnregistre valeur={point.mesure ?? ""} placeholder="ex. 32 lb/po²" onEnregistrer={(v) => onMaj({ mesure: v })} />
                  </label>
                )}
                <label style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <span style={etiquette}>Ce que tu as vu (le client le lit)</span>
                  <ChampEnregistre valeur={point.constat ?? ""} placeholder="ex. Usure avancée, fissures" onEnregistrer={(v) => onMaj({ constat: v })} />
                </label>
              </div>
              {(estARecommander(point) || point.recommandation) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <span style={etiquette}>Travail recommandé</span>
                    <ChampEnregistre valeur={point.recommandation ?? ""} placeholder="ex. Remplacer les plaquettes avant" onEnregistrer={(v) => onMaj({ recommandation: v })} />
                  </label>
                  {comptoir && (
                    <label style={{ flex: "0 1 110px" }}>
                      <span style={etiquette}>Prix avant taxes</span>
                      <ChampEnregistre valeur={point.prixEstime ?? ""} inputMode="decimal" placeholder="0,00" onEnregistrer={(v) => onMaj({ prixEstime: v })} />
                    </label>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              {point.mesure && !mesureEnLigne && <span><span style={{ color: "var(--text-muted)" }}>Mesure : </span>{point.mesure}</span>}
              {point.constat && <span><span style={{ color: "var(--text-muted)" }}>Constat : </span>{point.constat}</span>}
              {point.recommandation && <span><span style={{ color: "var(--text-muted)" }}>Recommandé : </span>{point.recommandation}</span>}
            </div>
          )}

          {(point.photos.length > 0 || remplissable) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {point.photos.map((ph) => (
                <div key={ph.id} style={{ position: "relative" }}>
                  <a href={`/api/inspections/${inspId}/photos/${ph.id}`} target="_blank" rel="noopener noreferrer" title="Ouvrir en grand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/inspections/${inspId}/photos/${ph.id}`} alt={`Photo : ${point.libelle}`} loading="lazy" style={{ display: "block", width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                  </a>
                  {remplissable && (
                    <button
                      type="button" onClick={() => onSupprimerPhoto(ph.id)} aria-label="Retirer la photo"
                      style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: "none", background: "var(--danger)", color: "#fff", fontSize: 13, lineHeight: "22px", cursor: "pointer", padding: 0 }}
                    >×</button>
                  )}
                </div>
              ))}
              {remplissable && (
                <button
                  type="button" onClick={photo.ouvrir} disabled={envoiPhoto}
                  style={{ width: 72, height: 72, borderRadius: 8, border: "1px dashed var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {envoiPhoto ? "Envoi…" : "📷 Photo"}
                </button>
              )}
              {photo.element}
            </div>
          )}

          {remplissable && point.ajoute && (
            <button type="button" onClick={onSupprimer} style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--danger)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              Retirer ce point
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Petits morceaux ----------

// État proposé selon la mesure : discret s'il est déjà choisi ; sinon (le
// technicien a choisi autre chose), une suggestion avec « Appliquer »
function IndicePropose({ propose, etat, onAppliquer }) {
  if (!propose) return null;
  const e = ETATS_POINT[propose.etat];
  if (etat === propose.etat) {
    return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>État proposé : {propose.regle}</span>;
  }
  if (!etat || etat === "NA") return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{propose.regle} : la mesure propose</span>
      <b style={{ color: e.couleur }}>{e.libelle}</b>
      <button type="button" onClick={onAppliquer} style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: `1px solid ${e.couleur}`, background: "none", color: e.couleur, cursor: "pointer" }}>
        Appliquer
      </button>
    </span>
  );
}

// Champ enregistré quand on le quitte (ou Entrée), seulement s'il a changé
function ChampEnregistre({ valeur, onEnregistrer, multiligne = false, style, ...reste }) {
  const [texte, setTexte] = useState(String(valeur ?? ""));
  const [base, setBase] = useState(String(valeur ?? ""));
  // Valeur changée ailleurs (ex. remise comme avant après une erreur)
  if (String(valeur ?? "") !== base) {
    setBase(String(valeur ?? ""));
    setTexte(String(valeur ?? ""));
  }
  async function enregistrer() {
    if (texte.trim() === base.trim()) return;
    const ok = await onEnregistrer(texte.trim());
    if (ok === false) setTexte(base);
  }
  const commun = {
    value: texte, onChange: (e) => setTexte(e.target.value), onBlur: enregistrer, className: "champ",
    style: { fontSize: 15, ...style }, ...reste,
  };
  return multiligne
    ? <textarea rows={3} {...commun} style={{ ...commun.style, resize: "vertical", fontFamily: "inherit" }} />
    : <input {...commun} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />;
}

function BarreProgression({ r }) {
  const part = (n) => `${r.total ? (n / r.total) * 100 : 0}%`;
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--surface-alt)", border: "1px solid var(--border)" }} aria-hidden="true">
      <span style={{ width: part(r.URGENT), background: "var(--danger)" }} />
      <span style={{ width: part(r.SURVEILLER), background: "var(--avertissement)" }} />
      <span style={{ width: part(r.OK), background: "var(--success)" }} />
      <span style={{ width: part(r.NA), background: "var(--text-muted)", opacity: 0.5 }} />
    </div>
  );
}

function Compte({ couleur, n }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: couleur }} />{n}
    </span>
  );
}

function Avis({ children }) {
  return <div style={{ background: "var(--avertissement-fond)", borderRadius: 12, padding: "10px 12px", fontSize: 13, marginBottom: 14 }}>{children}</div>;
}

function Bandeau({ couleur, titre, children }) {
  return (
    <div role="status" style={{ border: `1px solid ${couleur}`, borderLeft: `5px solid ${couleur}`, borderRadius: 12, padding: "10px 12px", margin: "8px 0 12px", background: "var(--bg)" }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: couleur }}>{titre}</div>
      {children && <div style={{ fontSize: 13, marginTop: 2 }}>{children}</div>}
    </div>
  );
}

function LigneMontant({ libelle, montant, gras = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 3, fontWeight: gras ? 800 : 400 }}>
      <span style={{ color: gras ? "var(--text)" : "var(--text-muted)" }}>{libelle}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{argent(montant)}</span>
    </div>
  );
}

const etiquette = { display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };
const boutonSecondaire = {
  padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
