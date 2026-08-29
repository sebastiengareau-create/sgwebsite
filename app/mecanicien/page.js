import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EnTete from "../components/EnTete";
import TachePoincon from "./TachePoincon";
import SectionTachesInternes from "./SectionTachesInternes";

function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}
function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}

export default async function EspaceMecanicien() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  const estGerant = estGerantOuDev(session);
  if (!estGerant && session.role !== "MECANICIEN") redirect(`/${session.role.toLowerCase()}`);

  // Tous les mécaniciens voient tous les bons non terminés — n'importe qui
  // peut travailler sur n'importe quel bon, dépendant de la tâche.
  const bons = await prisma.bonTravail.findMany({
    where: { statut: { not: "TERMINE" } },
    include: {
      client: true,
      vehicule: true,
      problemes: { orderBy: { id: "asc" }, include: { entreesTemps: { include: { employe: true } } } },
    },
    orderBy: { creeLe: "desc" },
  });

  const poinconsActifs = bons.flatMap((b) =>
    b.problemes.flatMap((pr) =>
      pr.entreesTemps.filter((t) => !t.fin).map((t) => ({ ...t, bon: b, tache: pr }))
    )
  );

  const tachesInternes = await prisma.tacheInterne.findMany({
    where: { actif: true },
    include: { entreesTemps: { include: { employe: true } } },
    orderBy: { creeLe: "asc" },
  });
  const poinconsInternesActifs = tachesInternes.flatMap((t) =>
    t.entreesTemps.filter((e) => !e.fin).map((e) => ({ ...e, tacheInterne: t }))
  );

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>{estGerant ? "Horodateur — vue d'ensemble" : "Horodateur"}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          {estGerant
            ? "Tous les poinçons actifs de l'équipe, par tâche."
            : "Poinçonne par tâche précise — tu peux avoir plusieurs tâches actives en même temps."}
        </p>

        {estGerant && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              Poinçons actifs en ce moment ({poinconsActifs.length + poinconsInternesActifs.length})
            </div>
            {poinconsActifs.length + poinconsInternesActifs.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Personne n'est poinçonné actuellement.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {poinconsActifs.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.employe.nom}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Bon #{t.bon.numero} — {t.tache.description}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--accent)", alignSelf: "center" }}>● en cours</span>
                  </div>
                ))}
                {poinconsInternesActifs.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.employe.nom}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>🛠️ {t.tacheInterne.nom} (interne)</div>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--accent)", alignSelf: "center" }}>● en cours</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <SectionTachesInternes taches={tachesInternes} monId={session.id} />

        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
          Bons de travail actifs
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bons.map((b) => (
            <div key={b.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{b.numero}</div>
              <div style={{ fontWeight: 600 }}>{b.client.nom}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{b.vehicule.marque} {b.vehicule.modele} {b.vehicule.annee}</div>
              <Link href={`/bons/${b.id}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>
                Voir la fiche complète →
              </Link>

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {b.problemes.map((pr, idxTache) => {
                  const monEntree = pr.entreesTemps.find((t) => t.employeId === session.id && !t.fin);
                  const finies = pr.entreesTemps.filter((t) => t.employeId === session.id && t.fin);
                  const totalFini = finies.reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0);
                  return (
                    <div key={pr.id} style={{ background: "var(--bg)", border: monEntree ? "1px solid var(--accent)" : "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 13 }}><strong style={{ color: "var(--text-muted)" }}>{idxTache + 1}.</strong> {pr.description}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {totalFini > 0 ? `Ton temps : ${fmtHeures(totalFini)}` : "Non commencé"}
                        </span>
                        <TachePoincon problemeId={pr.id} actif={!!monEntree} debut={monEntree?.debut} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {bons.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun bon actif en ce moment.</p>}
        </div>
      </div>
    </div>
  );
}
