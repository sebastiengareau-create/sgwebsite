"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUTS_ENVOI } from "@/lib/statutsEnvoi";
import { dateCourteQuebec, heureQuebec } from "@/lib/regroupementDates";
import ActivationNotifications from "../components/ActivationNotifications";
import BandeauSection from "../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille, TitreGroupe, TitrePanneau, BoutonAction, stylePanneau } from "../components/StyleSection";

// Prochaine étape proposée à l'employé selon où en est l'envoi
const PROCHAINE = {
  ENVOYE: { statut: "EN_ROUTE", label: "Je pars (en route)", icone: "vehicule" },
  VU: { statut: "EN_ROUTE", label: "Je pars (en route)", icone: "vehicule" },
  EN_ROUTE: { statut: "SUR_PLACE", label: "Je suis arrivé", icone: "epingle" },
  SUR_PLACE: { statut: "TERMINE", label: "Tâche terminée", icone: "crochet" },
};

const CLE_PARTAGE = "partage_gps_actif";
const INTERVALLE_ENVOI = 20000; // ms entre deux paquets envoyés au serveur
const ECART_MIN_MS = 10000; // au plus un point aux 10 s…
const ECART_MIN_M = 25; // …sauf s'il a bougé de plus de 25 m

function lireStockage() {
  try { return localStorage.getItem(CLE_PARTAGE) === "1"; } catch { return false; }
}
function ecrireStockage(actif) {
  try { actif ? localStorage.setItem(CLE_PARTAGE, "1") : localStorage.removeItem(CLE_PARTAGE); } catch {}
}

function metres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const x = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2));
  const y = rad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * 6371000;
}

// Partage de la position : suit le GPS du téléphone tant que la page est
// ouverte (un navigateur ne peut pas suivre en arrière-plan), garde l'écran
// allumé si possible, et envoie les points par paquets — ceux pris hors
// ligne partent au retour du réseau.
function usePartagePosition(envoiId) {
  const [actif, setActif] = useState(false);
  const [etat, setEtat] = useState("");
  const tampon = useRef([]);
  const dernier = useRef(null);
  const envoiCourant = useRef(envoiId);
  envoiCourant.current = envoiId;

  useEffect(() => { if (lireStockage()) setActif(true); }, []);

  useEffect(() => {
    if (!actif) return;
    if (!("geolocation" in navigator)) {
      setEtat("Ce téléphone ne permet pas la localisation.");
      setActif(false);
      return;
    }

    let verrou = null;
    async function garderEcranAllume() {
      try { if ("wakeLock" in navigator && document.visibilityState === "visible") verrou = await navigator.wakeLock.request("screen"); } catch {}
    }

    async function vider(viaBeacon = false) {
      if (tampon.current.length === 0) return;
      const points = tampon.current.splice(0, 200);
      const corps = JSON.stringify({ points, envoiId: envoiCourant.current });
      if (viaBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/positions", new Blob([corps], { type: "application/json" }));
        return;
      }
      try {
        const res = await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: corps });
        if (!res.ok) throw new Error();
        setEtat(`Position envoyée à ${new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`);
      } catch {
        tampon.current = [...points, ...tampon.current].slice(-1000); // réessayé au prochain envoi
        setEtat("Hors ligne — les positions seront envoyées au retour du réseau.");
      }
    }

    const surveillance = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy, vitesse: pos.coords.speed, t: pos.timestamp };
        const d = dernier.current;
        if (d && p.t - d.t < ECART_MIN_MS && metres(d, p) < ECART_MIN_M) return;
        dernier.current = p;
        tampon.current.push(p);
        if (!d) vider(); // premier point : tout de suite
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setEtat("Localisation refusée — autorise-la pour ce site dans les réglages du navigateur.");
          setActif(false);
          ecrireStockage(false);
        } else {
          setEtat("Signal GPS introuvable pour l'instant…");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    const minuterie = setInterval(() => vider(), INTERVALLE_ENVOI);
    function visibilite() {
      if (document.visibilityState === "hidden") vider(true);
      else garderEcranAllume();
    }
    document.addEventListener("visibilitychange", visibilite);
    garderEcranAllume();
    setEtat("Recherche du signal GPS…");

    return () => {
      navigator.geolocation.clearWatch(surveillance);
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", visibilite);
      verrou?.release().catch(() => {});
      vider(true);
      dernier.current = null;
    };
  }, [actif]);

  function changer(valeur) {
    ecrireStockage(valeur);
    setActif(valeur);
    if (!valeur) setEtat("");
  }
  return { actif, etat, demarrer: () => changer(true), arreter: () => changer(false) };
}

export default function MesTachesClient({ envois, clePublique }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(null);
  const [erreur, setErreur] = useState("");

  const actifs = envois.filter((e) => PROCHAINE[e.statut]);
  const termines = envois.filter((e) => e.statut === "TERMINE");
  const enDeplacement = actifs.find((e) => e.statut === "EN_ROUTE") || actifs.find((e) => e.statut === "SUR_PLACE");
  const partage = usePartagePosition(enDeplacement?.id || null);

  async function avancer(envoi) {
    const etape = PROCHAINE[envoi.statut];
    setErreur("");
    setOccupe(envoi.id);
    const res = await fetch(`/api/envois/${envoi.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: etape.statut }),
    });
    setOccupe(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || `Erreur (code ${res.status}).`);
      return;
    }
    if (etape.statut === "EN_ROUTE") partage.demarrer();
    if (etape.statut === "TERMINE" && actifs.length === 1) partage.arreter();
    router.refresh();
  }

  const enDeplacementCompte = actifs.filter((e) => e.statut === "EN_ROUTE" || e.statut === "SUR_PLACE").length;

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📲" titre="Mes tâches" sousTitre="Les bons qui t'ont été envoyés. Indique où tu en es à chaque étape." />

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="À faire" montant={String(actifs.length)} teinte="var(--accent)" couleur={actifs.length > 0 ? "var(--accent-ombre)" : "var(--text)"} note={actifs.length > 0 ? "Bons envoyés, pas encore terminés" : "Rien en attente"} />
        <CarteChiffre titre="En déplacement" montant={String(enDeplacementCompte)} teinte="#9A7FC7" note="En route ou sur place" />
        <CarteChiffre titre="Terminées aujourd'hui" montant={String(termines.length)} teinte="var(--success)" couleur={termines.length > 0 ? "var(--success)" : "var(--text)"} note="Depuis minuit" />
      </div>

      <ActivationNotifications clePublique={clePublique} />

      <div style={{ ...stylePanneau, border: `1.5px solid ${partage.actif ? "var(--success)" : "var(--border)"}` }}>
        <TitrePanneau
          icone="epingle" teinte={partage.actif ? TEINTES.vert : TEINTES.neutre}
          titre={partage.actif ? "Position partagée avec le bureau" : "Partage de position arrêté"}
          sousTitre={partage.etat || "Démarre automatiquement quand tu pars vers un client."}
          droite={partage.actif
            ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Actif</Pastille>
            : <Pastille couleur="var(--text-muted)" fond="var(--surface-alt)">Arrêté</Pastille>}
        />
        {partage.actif && (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px", padding: "8px 12px", borderRadius: 12, background: "var(--bg)" }}>
            Garde cette page ouverte pendant le déplacement : si tu changes d'application ou que l'écran se verrouille, le suivi s'interrompt jusqu'à ton retour.
          </p>
        )}
        {partage.actif
          ? <BoutonAction icone="bloque" couleur="var(--danger)" onClick={partage.arreter} style={{ width: "100%" }}>Arrêter le partage</BoutonAction>
          : <BoutonAction icone="epingle" couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={partage.demarrer} style={{ width: "100%" }}>Partager ma position</BoutonAction>}
      </div>

      {erreur && <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700 }}>{erreur}</p>}

      <TitreGroupe couleur="var(--accent)" droite={<Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.16)">{actifs.length}</Pastille>}>À faire</TitreGroupe>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {actifs.map((e) => <CarteEnvoi key={e.id} envoi={e} occupe={occupe === e.id} onAvancer={() => avancer(e)} />)}
        {actifs.length === 0 && <p style={{ ...stylePanneau, color: "var(--text-muted)", fontSize: 13.5, textAlign: "center" }}>Aucune tâche en attente. 👍</p>}
      </div>

      {termines.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <TitreGroupe couleur="var(--success)" droite={<Pastille couleur="var(--success)" fond="var(--success-fond)">{termines.length}</Pastille>}>Terminées aujourd'hui</TitreGroupe>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {termines.map((e) => <CarteEnvoi key={e.id} envoi={e} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function CarteEnvoi({ envoi, occupe, onAvancer }) {
  const { bon } = envoi;
  const statut = STATUTS_ENVOI[envoi.statut];
  const etape = PROCHAINE[envoi.statut];
  const adresse = [bon.client.adresse, bon.client.ville, bon.client.codePostal].filter(Boolean).join(", ");
  const vehicule = bon.vehicule && [bon.vehicule.annee, bon.vehicule.marque, bon.vehicule.modele].filter(Boolean).join(" ");
  const contacts = [
    adresse && { cle: "itin", href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`, icone: "epingle", label: "Itinéraire" },
    bon.client.telephone && { cle: "tel", href: `tel:${bon.client.telephone}`, icone: "telephone", label: "Appeler" },
  ].filter(Boolean);

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 14px 14px 18px", opacity: etape ? 1 : 0.75 }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: statut.color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Bon #{bon.numero}</span>
        <Pastille couleur={statut.color} fond="var(--surface-alt)">{statut.label}</Pastille>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{bon.client.nom}</div>
      {vehicule && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{vehicule}{bon.vehicule.plaque ? ` · ${bon.vehicule.plaque}` : ""}</div>}
      {bon.datePrevue && (
        <div style={{ marginTop: 6 }}>
          <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{dateCourteQuebec(bon.datePrevue)} à {heureQuebec(bon.datePrevue)}</Pastille>
        </div>
      )}
      {adresse && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{adresse}</div>}
      {contacts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${contacts.length}, 1fr)`, gap: 8, marginTop: 10 }}>
          {contacts.map((c) => (
            c.cle === "itin"
              ? <a key={c.cle} href={c.href} target="_blank" rel="noreferrer" style={styleLienAction}><Icone nom={c.icone} taille={16} couleur="var(--text)" />{c.label}</a>
              : <BoutonAction key={c.cle} href={c.href} icone={c.icone}>{c.label}</BoutonAction>
          ))}
        </div>
      )}
      {bon.problemes.length > 0 && (
        <div style={{ marginTop: 10, padding: "4px 12px", borderRadius: 12, background: "var(--bg)" }}>
          {bon.problemes.map((p, i) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)", fontSize: 13.5 }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
              <span style={{ paddingTop: 2 }}>{p.description}</span>
            </div>
          ))}
        </div>
      )}
      {envoi.message && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, padding: "8px 12px", borderRadius: 12, background: "rgba(232,163,61,0.12)" }}>
          <strong style={{ color: "var(--accent-ombre)" }}>Note du bureau :</strong> « {envoi.message} »
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: etape ? "1fr 1fr" : "1fr", gap: 8, marginTop: 12 }}>
        <BoutonAction href={`/bons/${bon.id}`} icone="presse">Voir la fiche</BoutonAction>
        {etape && (
          <BoutonAction icone={etape.icone} couleur="#fff" fond="var(--success)" bordure="var(--success)" onClick={onAvancer} disabled={occupe}>
            {occupe ? "…" : etape.label}
          </BoutonAction>
        )}
      </div>
    </div>
  );
}

const styleLienAction = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", borderRadius: 12,
  fontSize: 13.5, fontWeight: 700, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", textDecoration: "none",
};
