"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TitrePanneau, TEINTES, stylePanneau } from "../../components/StyleSection";

// Taux propres à l'employeur, utilisés par le calcul de la paie
// (lib/paie.js) : FSS en %, CNESST en $ par 100 $ de salaire assurable.
// La cotisation aux normes du travail (0,06 %) est la même pour tous.
export default function CotisationsEmployeur({ tauxFss, tauxCnesst, tauxFssParDefaut, congePaques }) {
  const router = useRouter();
  const [fss, setFss] = useState(tauxFss ?? "");
  const [cnesst, setCnesst] = useState(tauxCnesst ?? "");
  const [paques, setPaques] = useState(congePaques === "LUNDI" ? "LUNDI" : "VENDREDI");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function enregistrer(e) {
    e.preventDefault();
    for (const valeur of [fss, cnesst]) {
      if (valeur !== "" && !(Number(valeur) >= 0 && Number(valeur) < 100)) {
        setMessage({ erreur: true, texte: "Taux invalide." });
        return;
      }
    }
    setEnCours(true);
    setMessage(null);
    const res = await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paie_fss_taux: fss, paie_cnesst_taux: cnesst, paie_ferie_paques: paques }),
    });
    const data = await res.json().catch(() => ({}));
    setEnCours(false);
    if (!res.ok) {
      setMessage({ erreur: true, texte: data.erreur || "Erreur lors de l'enregistrement." });
      return;
    }
    setMessage({ texte: "Réglages enregistrés ✓ — ils s'appliquent aux prochains calculs de paie." });
    router.refresh();
  }

  return (
    <form onSubmit={enregistrer} style={stylePanneau}>
      <TitrePanneau
        icone="calculatrice" teinte={TEINTES.vert} titre="Cotisations de l'employeur et jours fériés"
        sousTitre="FSS, CNESST et normes du travail : calculées à chaque paie et ajoutées aux charges à remettre."
      />
      <label className="etiquette">Taux du FSS (%) — vide = {String(tauxFssParDefaut).replace(".", ",")} %</label>
      <input type="number" min={0} max={99} step="0.0001" value={fss} onChange={(e) => setFss(e.target.value)} className="champ champ-sans-fleches" placeholder={String(tauxFssParDefaut)} />
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "-4px 0 12px", lineHeight: 1.45 }}>
        1,65 % pour une masse salariale d'un million ou moins (1,25 % dans les secteurs primaire et manufacturier). Au-delà, inscris ton taux.
      </p>
      <label className="etiquette">Taux de la CNESST ($ par 100 $ de salaire assurable)</label>
      <input type="number" min={0} max={99} step="0.01" value={cnesst} onChange={(e) => setCnesst(e.target.value)} className="champ champ-sans-fleches" placeholder="Voir ta décision de classification" />
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "-4px 0 12px", lineHeight: 1.45 }}>
        Propre à ton entreprise : il figure sur ta décision de classification de la CNESST. Vide, la prime n'est pas calculée.
      </p>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Normes du travail : 0,06 % de la rémunération, jusqu'au maximum annuel par employé — rien à régler.
      </p>
      <label className="etiquette">Congé de Pâques</label>
      <select value={paques} onChange={(e) => setPaques(e.target.value)} className="champ">
        <option value="VENDREDI">Vendredi saint</option>
        <option value="LUNDI">Lundi de Pâques</option>
      </select>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "-4px 0 12px", lineHeight: 1.45 }}>
        L'un des deux est férié, au choix de l'employeur. Les sept autres jours fériés sont fixés par la loi.
      </p>
      {message && <p style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 10px", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: "10px 16px", borderRadius: 10, fontWeight: 800, fontSize: 13 }}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
