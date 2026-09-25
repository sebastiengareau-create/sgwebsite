import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EnTete from "../components/EnTete";
import TachePoincon from "./TachePoincon";
import SectionTachesInternes from "./SectionTachesInternes";
import { bonEstAVenir, dateBon, regrouperParJour, heureQuebec, dateCourteQuebec, libelleJour, cleJourQuebec } from "@/lib/regroupementDates";

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
  if (!(await aAccesSection(session, "horodateur"))) {
    // MECANICIEN était auparavant toujours autorisé ici sans exception —
    // s'il n'a plus cette section (décochée dans Rôles et accès), on ne
    // peut plus le renvoyer vers /mecanicien (boucle infinie).
    redirect(session.role === "MECANICIEN" ? "/login" : `/${session.role.toLowerCase()}`);
  }

  // Tous les mécaniciens voient tous les bons non terminés — n'importe qui
  // peut travailler sur n'importe quel bon, dépendant de la tâche.
  const bons = await prisma.bonTravail.findMany({
    where: { statut: { not: "TERMINE" } },
    include: {
      client: true,
      problemes: { orderBy: { id: "asc" }, include: { entreesTemps: { include: { employe: true } } } },
    },
    orderBy: { creeLe: "desc" },
  });

  // Les bons planifiés pour un jour à venir sont affichés à part, sous leur
  // journée — ils rejoignent les bons actifs le jour venu.
  const bonsActifs = bons.filter((b) => !bonEstAVenir(b));
  const groupesAVenir = regrouperParJour(bons.filter((b) => bonEstAVenir(b)), dateBon);
  const nbAVenir = bons.length - bonsActifs.length;

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
          Bons de travail actifs ({bonsActifs.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bonsActifs.map((b) => (
            <div key={b.id} className="carte carte-m">
              <EnTeteBon b={b} />
              <TachesBon b={b} monId={session.id} />
            </div>
          ))}
          {bonsActifs.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun bon actif en ce moment.</p>}
        </div>

        {nbAVenir > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "#9A7FC7", marginBottom: 8 }}>
              📅 À venir ({nbAVenir})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupesAVenir.map((g) => (
                <div key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{g.libelle}</span>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>({g.elements.length})</span>
                    <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>
                  {g.elements.map((b) => (
                    <div key={b.id} className="carte carte-m" style={{ borderLeft: "3px solid #9A7FC7" }}>
                      <EnTeteBon b={b} />
                      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--text-muted)" }}>
                        {b.problemes.map((pr) => <li key={pr.id}>{pr.description}</li>)}
                      </ul>
                      {/* Le véhicule arrive d'avance : on peut poinçonner quand même,
                          ce qui fait passer le bon « En cours ». */}
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer" }}>Commencer maintenant</summary>
                        <TachesBon b={b} monId={session.id} />
                      </details>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EnTeteBon({ b }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>#{b.numero}</span>
        {b.datePrevue && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            🕒 {libelleJour(cleJourQuebec(b.datePrevue))} à {heureQuebec(b.datePrevue)}
          </span>
        )}
      </div>
      <div style={{ fontWeight: 600 }}>{b.client.nom}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Créé le {dateCourteQuebec(b.creeLe)}</div>
      <Link href={`/bons/${b.id}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>
        Voir la fiche complète →
      </Link>
    </>
  );
}

function TachesBon({ b, monId }) {
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      {b.problemes.map((pr, idxTache) => {
        const monEntree = pr.entreesTemps.find((t) => t.employeId === monId && !t.fin);
        const finies = pr.entreesTemps.filter((t) => t.employeId === monId && t.fin);
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
  );
}
