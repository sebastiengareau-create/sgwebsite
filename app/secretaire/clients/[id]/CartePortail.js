"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MESSAGES_TEXTO } from "@/lib/textos";
import BoutonTexto from "../../../components/BoutonTexto";
import { TitrePanneau, TEINTES, stylePanneau } from "../../../components/StyleSection";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const bouton = { padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "1px solid var(--border)", background: "none", color: "var(--text)", cursor: "pointer" };

// Fiche du client → son portail (lib/portailClient.js) : créer le lien,
// l'envoyer par courriel ou texto, le copier, en créer un nouveau ou le retirer
export default function CartePortail({ client, portail }) {
  const router = useRouter();
  const [lien, setLien] = useState(portail.lien);
  const [enCours, setEnCours] = useState(null);
  const [message, setMessage] = useState(null);

  async function action(nom) {
    if (nom === "desactiver" && !window.confirm("Retirer l'accès ? Le lien du client ne fonctionnera plus.")) return;
    if (nom === "activer" && lien && !window.confirm("Créer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
    setEnCours(nom);
    setMessage(null);
    const res = await fetch(`/api/clients/${client.id}/portail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: nom }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnCours(null);
    if (!res?.ok) return setMessage({ texte: data?.erreur || "Erreur.", erreur: true });
    if (nom === "activer") { setLien(data.lien); setMessage({ texte: "Lien créé. Envoie-le au client." }); }
    if (nom === "desactiver") { setLien(null); setMessage({ texte: "Accès retiré." }); }
    if (nom === "envoyer") setMessage({ texte: `Lien envoyé à ${data.a}.` });
    router.refresh();
  }

  async function copier() {
    const ok = await navigator.clipboard?.writeText(lien).then(() => true).catch(() => false);
    setMessage(ok ? { texte: "Lien copié." } : { texte: lien });
  }

  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone="globe" teinte={TEINTES.bleu} titre="Portail client"
        sousTitre={lien ? (portail.vuLe ? `Dernière visite : ${DATE.format(new Date(portail.vuLe))}` : "Lien créé, pas encore visité") : "Son dossier en ligne : factures, travaux, rendez-vous, véhicules"}
      />
      {lien ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {client.courriel && portail.courrielPret && (
            <button type="button" onClick={() => action("envoyer")} disabled={!!enCours} className="bouton-3d" style={{ padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              {enCours === "envoyer" ? "Envoi…" : "📧 Envoyer par courriel"}
            </button>
          )}
          <BoutonTexto telephone={client.telephone} message={MESSAGES_TEXTO.portail({ nom: client.nom, lien, nomEntreprise: portail.nomEntreprise })} type="LIEN" clientId={client.id} style={bouton} />
          <button type="button" onClick={copier} style={bouton}>🔗 Copier le lien</button>
          <a href={lien} target="_blank" rel="noopener noreferrer" style={{ ...bouton, textDecoration: "none" }}>Voir comme le client ↗</a>
          <span style={{ flexBasis: "100%", height: 0 }} />
          <button type="button" onClick={() => action("activer")} disabled={!!enCours} style={{ ...bouton, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Nouveau lien</button>
          <button type="button" onClick={() => action("desactiver")} disabled={!!enCours} style={{ ...bouton, fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>Retirer l&apos;accès</button>
        </div>
      ) : (
        <button type="button" onClick={() => action("activer")} disabled={!!enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>
          {enCours === "activer" ? "Création…" : "Créer le lien du portail"}
        </button>
      )}
      {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "8px 0 0", color: message.erreur ? "var(--danger)" : "var(--text-muted)", overflowWrap: "anywhere" }}>{message.texte}</p>}
    </div>
  );
}
