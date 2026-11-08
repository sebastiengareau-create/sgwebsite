import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { destinatairesPermis } from "@/lib/documentsServeur";
import EnTete from "../../../components/EnTete";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, Pastille } from "../../../components/StyleSection";

const NB_ENVOIS = 100;

// Historique des courriels envoyés depuis Documents — seulement les envois
// aux destinataires que la personne peut gérer (employés et/ou clients)
export default async function HistoriqueCourriels() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  const permis = await destinatairesPermis(session);
  if (permis.length === 0) redirect("/gerant");

  const envois = await prisma.envoiCourrielDocument.findMany({
    where: { destinataire: { in: permis } },
    orderBy: { creeLe: "desc" },
    take: NB_ENVOIS,
  });
  const dateHeure = (d) => d.toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });

  const nbCourriels = envois.reduce((n, e) => n + (e.groupe ? e.nbEnvoyes : e.destinataires.filter((d) => !d.erreur).length), 0);
  const nbEchecs = envois.reduce((n, e) => n + (e.nbEchecs || 0), 0);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/documents" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux documents</Link>
        <div style={{ marginTop: 8 }}>
          <BandeauSection icone="🕘" titre="Historique des courriels" sousTitre={`Les ${NB_ENVOIS} derniers envois de la section Documents. Touche un envoi pour voir ses destinataires et son texte.`} />
        </div>

        <div className="grille-trois" style={{ marginBottom: 20 }}>
          <CarteChiffre titre="Envois" montant={String(envois.length)} teinte="var(--bleu)" note={`${envois.filter((e) => e.groupe).length} groupé${envois.filter((e) => e.groupe).length > 1 ? "s" : ""}`} />
          <CarteChiffre titre="Courriels envoyés" montant={String(nbCourriels)} teinte="var(--success)" couleur={nbCourriels > 0 ? "var(--success)" : "var(--text)"} note="Reçus par les destinataires" />
          <CarteChiffre titre="Échecs" montant={String(nbEchecs)} teinte="var(--danger)" couleur={nbEchecs > 0 ? "var(--danger)" : "var(--text)"} note={nbEchecs > 0 ? "Adresse refusée ou invalide" : "Aucun échec"} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {envois.map((e) => (
            <details key={e.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14 }}>
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: e.groupe ? TEINTES.vert.fond : TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icone nom={e.groupe ? "utilisateurs" : "courriel"} taille={18} couleur={e.groupe ? TEINTES.vert.couleur : TEINTES.bleu.couleur} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.sujet}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {e.modeleNom} · par {e.envoyePar || "—"} · {dateHeure(e.creeLe)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {e.groupe
                        ? <Pastille couleur={TEINTES.vert.couleur} fond={TEINTES.vert.fond}>{e.nbEnvoyes} envoyé{e.nbEnvoyes > 1 ? "s" : ""}</Pastille>
                        : <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{e.destinataires[0]?.nom || "Envoi"}</Pastille>}
                      {e.nbEchecs > 0 && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">{e.nbEchecs} échec{e.nbEchecs > 1 ? "s" : ""}</Pastille>}
                    </div>
                  </div>
                  <Icone nom="chevron" taille={18} couleur="var(--text-muted)" />
                </div>
              </summary>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <div style={titreStyle}>Destinataires</div>
                <div style={{ display: "flex", flexDirection: "column", maxHeight: 260, overflowY: "auto" }}>
                  {e.destinataires.map((d, i) => (
                    <div key={i} style={{ padding: "6px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)", fontSize: 13 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Icone nom={d.erreur ? "alerte" : "crochet"} taille={14} couleur={d.erreur ? "var(--danger)" : "var(--success)"} />
                        <strong>{d.nom}</strong> <span style={{ color: "var(--text-muted)" }}>· {d.a}</span>
                      </span>
                      {d.erreur && <div style={{ fontSize: 12, color: "var(--danger)", marginLeft: 20 }}>{d.erreur}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ ...titreStyle, marginTop: 12 }}>{e.groupe ? "Texte envoyé (rempli pour chaque client)" : "Texte envoyé"}</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.5, background: "var(--bg)", borderRadius: 12, padding: 12 }}>{e.texte}</div>
              </div>
            </details>
          ))}
          {envois.length === 0 && <p style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 18, color: "var(--text-muted)", fontSize: 13.5, textAlign: "center", margin: 0 }}>Aucun courriel envoyé encore.</p>}
        </div>
      </div>
    </div>
  );
}

const titreStyle = { fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 };
