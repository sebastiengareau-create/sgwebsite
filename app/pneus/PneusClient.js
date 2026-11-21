"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { libelleVehicule } from "@/lib/vehicules";
import { MESSAGES_TEXTO } from "@/lib/textos";
import { STATUTS_JEU, SAISONS, libelleJeu, saisonAVenir, estARappeler, dejaRappele, usureMinimale } from "@/lib/pneusCalculs";
import { Icone, TEINTES, Pastille } from "../components/StyleSection";
import BoutonTexto from "../components/BoutonTexto";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Toronto" });

// Usure à surveiller (/32 po) : sous ce seuil, le jeu est signalé
const USURE_BASSE = 4;

// Comparaison d'emplacements « A-2 » < « A-10 » (nombres comparés comme nombres)
const parEmplacement = (a, b) => String(a.emplacement || "").localeCompare(String(b.emplacement || ""), "fr-CA", { numeric: true });
const parClient = (a, b) => a.client.nom.localeCompare(b.client.nom, "fr-CA");

export default function PneusClient({ jeux: jeuxInitiaux, prixSaison: prixInitial, peutRegler, nomEntreprise, courrielPret }) {
  const router = useRouter();
  const [jeux, setJeux] = useState(jeuxInitiaux);
  const [onglet, setOnglet] = useState("entrepot");
  const [recherche, setRecherche] = useState("");
  const aVenir = saisonAVenir();

  const filtre = useMemo(() => {
    const mots = recherche.toLowerCase().split(/\s+/).filter(Boolean);
    if (!mots.length) return () => true;
    return (j) => {
      const texte = [j.numero, j.client.nom, j.client.telephone, j.emplacement, j.dimension, j.marque, j.modele, j.vehicule && libelleVehicule(j.vehicule), j.vehicule?.plaque]
        .filter(Boolean).join(" ").toLowerCase();
      return mots.every((m) => texte.includes(m));
    };
  }, [recherche]);

  const entrepot = jeux.filter((j) => j.statut === "ENTREPOSE");
  const poses = jeux.filter((j) => j.statut === "POSE");
  const remis = jeux.filter((j) => j.statut === "REMIS");
  const aRappeler = entrepot.filter((j) => estARappeler(j, aVenir));
  const restantARappeler = aRappeler.filter((j) => !dejaRappele(j, aVenir));

  const onglets = [
    { cle: "entrepot", libelle: `À l'entrepôt (${entrepot.length})` },
    { cle: "poses", libelle: `Sur les véhicules (${poses.length})` },
    { cle: "rappels", libelle: `${aVenir.titre} (${restantARappeler.length} à rappeler)` },
    { cle: "remis", libelle: `Remis (${remis.length})` },
  ];
  const liste = {
    entrepot: [...entrepot].sort(parEmplacement),
    poses: [...poses].sort(parClient),
    rappels: [...aRappeler].sort(parClient),
    remis: [...remis].sort(parClient),
  }[onglet].filter(filtre);

  const marquerRappele = (ids) => setJeux((js) => js.map((j) => (ids.includes(j.id) ? { ...j, rappelLe: new Date().toISOString() } : j)));

  return (
    <div className="conteneur-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: TEINTES.bleu.fond, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="pneu" taille={22} couleur={TEINTES.bleu.couleur} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", margin: 0 }}>Entreposage de pneus</h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{entrepot.length} jeu{entrepot.length > 1 ? "x" : ""} à l&apos;entrepôt · {poses.length} sur les véhicules</div>
        </div>
        <Link href="/pneus/nouveau" className="bouton-3d" style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
          + Nouveau jeu
        </Link>
      </div>

      <input
        type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="champ"
        placeholder="Client, plaque, PN-…, emplacement, dimension" aria-label="Rechercher un jeu de pneus"
        style={{ fontSize: 15, padding: "11px 12px", marginBottom: 10 }}
      />

      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {onglets.map((o) => (
          <button
            key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle} onClick={() => setOnglet(o.cle)}
            style={{
              fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 999, cursor: "pointer",
              border: `1px solid ${onglet === o.cle ? "var(--text)" : "var(--border)"}`,
              background: onglet === o.cle ? "var(--text)" : "var(--surface)", color: onglet === o.cle ? "var(--bg)" : "var(--text)",
            }}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === "rappels" && (
        <Rappels
          aVenir={aVenir} jeux={liste} restants={restantARappeler.filter(filtre)} nomEntreprise={nomEntreprise}
          courrielPret={courrielPret} onRappeles={marquerRappele}
        />
      )}

      {onglet !== "rappels" && (
        liste.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
            {recherche ? "Aucun jeu ne correspond à la recherche." : onglet === "entrepot" ? "Aucun jeu à l'entrepôt pour l'instant. « + Nouveau jeu » pour en inscrire un, ou faites un changement de saison sur un bon." : "Aucun jeu ici."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {liste.map((j) => <LigneJeu key={j.id} jeu={j} />)}
          </div>
        )
      )}

      {peutRegler && <Reglages prixInitial={prixInitial} onEnregistre={() => router.refresh()} />}
    </div>
  );
}

function LigneJeu({ jeu }) {
  const statut = STATUTS_JEU[jeu.statut];
  const usure = usureMinimale(jeu.usure);
  return (
    <Link href={`/pneus/${jeu.id}`} style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ width: 64, flexShrink: 0, textAlign: "center" }}>
        {jeu.statut === "ENTREPOSE"
          ? <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{jeu.emplacement || "—"}</div>
          : <Pastille couleur={statut.couleur} fond={statut.fond}>{jeu.statut === "POSE" ? "Posé" : "Remis"}</Pastille>}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{jeu.numero}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>{jeu.client.nom}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {jeu.vehicule ? `${libelleVehicule(jeu.vehicule)}${jeu.vehicule.plaque ? ` · ${jeu.vehicule.plaque}` : ""}` : "Véhicule non précisé"}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 2 }}>
          {libelleJeu(jeu)}{jeu.marque ? ` · ${jeu.marque}` : ""}
          {usure != null && usure <= USURE_BASSE && <span style={{ color: "var(--avertissement)", fontWeight: 700 }}> · usure {String(usure).replace(".", ",")}/32</span>}
        </div>
      </div>
      <Icone nom="chevron" taille={16} />
    </Link>
  );
}

// Changement de saison qui vient : les clients dont les pneus de cette
// saison sont à l'entrepôt, à rappeler par courriel ou par texto
function Rappels({ aVenir, jeux, restants, nomEntreprise, courrielPret, onRappeles }) {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const sansCourriel = (j) => !String(j.client.courriel || "").trim() || !!j.client.promotionsRefuseesLe;
  const aCourrieller = restants.filter((j) => !sansCourriel(j));

  async function envoyer(ids) {
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/pneus/rappels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "courriel", jeuIds: ids }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(false);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Envoi impossible : vérifie la connexion et réessaie.", erreur: true });
    const rates = new Set((data.echecs || []).map((e) => e.a));
    onRappeles(jeux.filter((j) => ids.includes(j.id) && !sansCourriel(j) && !rates.has(j.client.courriel)).map((j) => j.id));
    setMessage({ texte: `${data.envoyes} courriel${data.envoyes > 1 ? "s" : ""} envoyé${data.envoyes > 1 ? "s" : ""}${data.echecs?.length ? `, ${data.echecs.length} refusé${data.echecs.length > 1 ? "s" : ""}` : ""}.` });
  }

  async function texto(jeu) {
    await fetch("/api/pneus/rappels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "texto", jeuId: jeu.id }) }).catch(() => null);
    onRappeles([jeu.id]);
    return MESSAGES_TEXTO.pneus({ nom: jeu.client.nom, hiver: aVenir.saison === "HIVER", vehicule: jeu.vehicule ? libelleVehicule(jeu.vehicule) : "", nomEntreprise });
  }

  return (
    <div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{aVenir.titre} — {aVenir.echeance}</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 10px" }}>
          Les clients dont les pneus {SAISONS[aVenir.saison].deSaison} sont à l&apos;entrepôt. Le courriel porte le lien de prise de rendez-vous des rappels d&apos;entretien
          (Clients → Rappels d&apos;entretien) et un lien de désabonnement ; le texto part de votre téléphone.
        </p>
        {courrielPret ? (
          <button
            type="button" disabled={enCours || !aCourrieller.length} onClick={() => envoyer(aCourrieller.map((j) => j.id))} className="bouton-3d"
            style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: aCourrieller.length ? "pointer" : "default", opacity: aCourrieller.length ? 1 : 0.55 }}
          >
            {enCours ? "Envoi…" : `📧 Envoyer le courriel aux ${aCourrieller.length} à rappeler`}
          </button>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--avertissement)" }}>L&apos;envoi de courriel n&apos;est pas configuré : rappelez par texto ou par téléphone.</div>
        )}
        {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 13, margin: "8px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
      </div>

      {jeux.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>Aucun jeu {SAISONS[aVenir.saison].deSaison} à l&apos;entrepôt.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jeux.map((j) => {
            const rappele = dejaRappele(j, aVenir);
            return (
              <div key={j.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link href={`/pneus/${j.id}`} style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", textDecoration: "none", flex: 1, minWidth: 0 }}>{j.client.nom}</Link>
                  {rappele
                    ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Rappelé le {DATE.format(new Date(j.rappelLe))}</Pastille>
                    : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">À rappeler</Pastille>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {j.vehicule ? `${libelleVehicule(j.vehicule)} · ` : ""}{libelleJeu(j)} · {j.numero} · emplacement {j.emplacement || "—"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                  {j.client.telephone && <a href={`tel:${j.client.telephone}`} style={petitBouton}>📞 {j.client.telephone}</a>}
                  <BoutonTexto telephone={j.client.telephone} message={() => texto(j)} libelle="💬 Texto" style={{ ...petitBouton, cursor: "pointer" }} type="RAPPEL" clientId={j.client.id} />
                  {courrielPret && !sansCourriel(j) && (
                    <button type="button" disabled={enCours} onClick={() => envoyer([j.id])} style={{ ...petitBouton, cursor: "pointer" }}>📧 Courriel</button>
                  )}
                  {sansCourriel(j) && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{j.client.promotionsRefuseesLe ? "Désabonné des courriels" : "Pas de courriel au dossier"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Reglages({ prixInitial, onEnregistre }) {
  const [prix, setPrix] = useState(prixInitial == null ? "" : String(prixInitial).replace(".", ","));
  const [message, setMessage] = useState(null);
  async function enregistrer(e) {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/pneus/reglages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prixSaison: prix }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Rien n'a été enregistré.", erreur: true });
    setMessage({ texte: "Enregistré." });
    onEnregistre();
  }
  return (
    <form onSubmit={enregistrer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginTop: 22 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 4 }}>Réglages</div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5 }}>
        Prix de l&apos;entreposage d&apos;un jeu, par saison
        <input value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="decimal" placeholder="ex. 80" className="champ" style={{ width: 100, fontSize: 14, textAlign: "right" }} />
        $
        <button type="submit" className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Enregistrer</button>
      </label>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
        Ajouté au bon lors d&apos;un changement de saison (poste « Entreposage de pneus »), avant taxes. Vide : aucune ligne ajoutée.
      </p>
      {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "6px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
    </form>
  );
}

const petitBouton = { fontSize: 12.5, fontWeight: 700, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", textDecoration: "none" };
