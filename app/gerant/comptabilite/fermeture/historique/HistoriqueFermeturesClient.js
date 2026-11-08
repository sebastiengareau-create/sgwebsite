import Link from "next/link";
import BandeauSection from "../../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille, TitrePanneau, stylePanneau } from "../../../../components/StyleSection";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const dateHeure = (d) => new Date(d).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "short", timeStyle: "short" });

export default function HistoriqueFermeturesClient({ lignes }) {
  const reouvertes = lignes.filter((l) => l.reouverture).length;
  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/fermeture" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la fermeture de période</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🔒" titre="Journal des fermetures" sousTitre="Chaque fermeture de période, qui l'a faite, et sa réouverture s'il y a lieu." />
      </div>

      <div className="grille-trois" style={{ marginBottom: 20 }}>
        <CarteChiffre titre="Fermetures" montant={String(lignes.length)} teinte="var(--bleu)" note="Au total" />
        <CarteChiffre titre="Toujours fermées" montant={String(lignes.length - reouvertes)} teinte="var(--success)" couleur={lignes.length - reouvertes > 0 ? "var(--success)" : "var(--text)"} note="Jamais rouvertes depuis" />
        <CarteChiffre titre="Réouvertes" montant={String(reouvertes)} teinte="var(--danger)" couleur={reouvertes > 0 ? "var(--danger)" : "var(--text)"} note="Avec un motif obligatoire" />
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="cadenas" teinte={TEINTES.bleu} titre="Fermetures" sousTitre={lignes.length === 0 ? "Aucune période fermée pour l'instant." : "La plus récente en haut."} />
        {lignes.map(({ fermeture, reouverture, periode }, i) => (
          <div key={fermeture.id} style={{ padding: "12px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: reouverture ? TEINTES.rouge.fond : TEINTES.vert.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icone nom={reouverture ? "echange" : "cadenas"} taille={18} couleur={reouverture ? TEINTES.rouge.couleur : TEINTES.vert.couleur} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{NOMS_MOIS[periode.mois - 1]} {periode.annee}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Fermée le {dateHeure(fermeture.creeLe)} par {fermeture.parNom}</div>
              </div>
              {reouverture
                ? <Pastille couleur="var(--danger)" fond="var(--danger-fond)">Réouverte</Pastille>
                : <Pastille couleur="var(--success)" fond="var(--success-fond)">Toujours fermée</Pastille>}
            </div>
            {reouverture && (
              <div style={{ marginTop: 8, marginLeft: 50, padding: "8px 12px", borderRadius: 12, background: "var(--danger-fond)", fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: "var(--danger)" }}>Réouverte le {dateHeure(reouverture.creeLe)} par {reouverture.parNom}</div>
                <div style={{ color: "var(--text)", marginTop: 2 }}>Motif : {reouverture.motif}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
