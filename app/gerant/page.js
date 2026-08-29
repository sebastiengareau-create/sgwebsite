import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../components/EnTete";
import LiveTimer from "../components/LiveTimer";

export default async function EspaceGerant() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!estGerantOuDev(session)) redirect(`/${session.role.toLowerCase()}`);

  const [enAttente, enCours, inventaire, poinconsActifs, poinconsInternesActifs] = await Promise.all([
    prisma.bonTravail.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.bonTravail.count({ where: { statut: "EN_COURS" } }),
    prisma.piece.findMany(),
    prisma.entreeTemps.findMany({
      where: { fin: null },
      include: { employe: true, probleme: { include: { bon: { include: { client: true, problemes: { orderBy: { id: "asc" } } } } } } },
      orderBy: { debut: "asc" },
    }),
    prisma.entreeTempsInterne.findMany({
      where: { fin: null },
      include: { employe: true, tacheInterne: true },
      orderBy: { debut: "asc" },
    }),
  ]);
  const stockBas = inventaire.filter((p) => p.qte <= p.qteMin);
  const totalPoinconsActifs = poinconsActifs.length + poinconsInternesActifs.length;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Vue d'ensemble</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Link href="/secretaire?statut=EN_ATTENTE" style={{ textDecoration: "none" }}><Carte label="Bons en attente" valeur={enAttente} /></Link>
          <Link href="/secretaire?statut=EN_COURS" style={{ textDecoration: "none" }}><Carte label="Bons en cours" valeur={enCours} /></Link>
          <Link href="/secretaire/inventaire" style={{ textDecoration: "none" }}><Carte label="Pièces sous le seuil" valeur={stockBas.length} alerte={stockBas.length > 0} /></Link>
        </div>

        <h2 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
          ⏱ Horodateurs actifs ({totalPoinconsActifs})
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {poinconsActifs.map((t) => {
            const numeroTache = t.probleme.bon.problemes.findIndex((p) => p.id === t.probleme.id) + 1;
            return (
            <Link key={t.id} href={`/bons/${t.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.employe.nom}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    #{t.probleme.bon.numero} · {t.probleme.bon.client.nom} · <strong>{numeroTache}.</strong> {t.probleme.description}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  <LiveTimer debut={t.debut.toISOString()} />
                </span>
              </div>
            </Link>
            );
          })}
          {poinconsInternesActifs.map((t) => (
            <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.employe.nom}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>🛠️ {t.tacheInterne.nom} (interne, non facturable)</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                <LiveTimer debut={t.debut.toISOString()} />
              </span>
            </div>
          ))}
          {totalPoinconsActifs === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Personne n'est poinçonné actuellement.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Carte({ label, valeur, alerte }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: alerte ? "var(--danger)" : "var(--accent)" }}>{valeur}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
