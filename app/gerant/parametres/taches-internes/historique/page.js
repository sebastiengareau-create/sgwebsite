import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateAujourdhuiQuebec, limitesJourQuebec, dateQuebecStr, FUSEAU } from "@/lib/temps";
import EnTete from "../../../../components/EnTete";

// Historique des poinçons sur les tâches internes (Paramètres → Tâches
// internes → Historique). Consultation seulement : ces poinçons ne créent
// aucune écriture comptable ni facture.

const DATE_VALIDE = /^\d{4}-\d{2}-\d{2}$/;

function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return min === 60 ? `${heures + 1}h00` : `${heures}h${String(min).padStart(2, "0")}`;
}

function fmtHeure(date) {
  return new Date(date).toLocaleTimeString("fr-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" });
}

function fmtJour(dateStr) {
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const texte = new Date(Date.UTC(an, mois - 1, jour, 12)).toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export default async function HistoriqueTachesInternes(props) {
  const searchParams = (await props.searchParams) || {};
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "parametres"))) redirect(session.role === "GERANT" ? "/secretaire" : "/gerant");

  const aujourdhui = dateAujourdhuiQuebec();
  const debutStr = DATE_VALIDE.test(searchParams.debut || "") ? searchParams.debut : `${aujourdhui.slice(0, 7)}-01`;
  const finStr = DATE_VALIDE.test(searchParams.fin || "") ? searchParams.fin : aujourdhui;
  const tacheId = searchParams.tache || "";
  const employeId = searchParams.employe || "";

  const [taches, entrees] = await Promise.all([
    prisma.tacheInterne.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }] }),
    prisma.entreeTempsInterne.findMany({
      where: {
        debut: { gte: limitesJourQuebec(debutStr).debut, lte: limitesJourQuebec(finStr).fin },
        ...(tacheId ? { tacheInterneId: tacheId } : {}),
        ...(employeId ? { employeId } : {}),
      },
      include: { employe: { select: { id: true, nom: true } }, tacheInterne: { select: { id: true, nom: true } } },
      orderBy: { debut: "desc" },
    }),
  ]);

  // Employés offerts dans le filtre : ceux qui ont déjà poinçonné une tâche
  // interne (même un ancien employé désactivé)
  const employes = await prisma.user.findMany({
    where: { entreesTempsInternes: { some: {} } },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });

  const maintenant = new Date();
  const lignes = entrees.map((e) => ({
    ...e,
    heures: ((e.fin ? new Date(e.fin) : maintenant) - new Date(e.debut)) / 3600000,
    jour: dateQuebecStr(new Date(e.debut)),
  }));

  const total = lignes.reduce((s, l) => s + l.heures, 0);
  const totaux = (cle) => {
    const map = new Map();
    for (const l of lignes) {
      const { id, nom } = l[cle];
      const t = map.get(id) || { nom, heures: 0, nombre: 0 };
      t.heures += l.heures;
      t.nombre += 1;
      map.set(id, t);
    }
    return [...map.values()].sort((a, b) => b.heures - a.heures);
  };
  const parTache = totaux("tacheInterne");
  const parEmploye = totaux("employe");

  const jours = [];
  for (const l of lignes) {
    const dernier = jours[jours.length - 1];
    if (dernier && dernier.jour === l.jour) dernier.lignes.push(l);
    else jours.push({ jour: l.jour, lignes: [l] });
  }

  const tacheChoisie = taches.find((t) => t.id === tacheId);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page-large" style={{ margin: "20px auto", padding: "0 16px" }}>
        <Link href="/gerant/parametres" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Paramètres</Link>
        <h1 style={{ fontSize: 20, margin: "8px 0 4px" }}>🛠️ Historique des tâches internes{tacheChoisie ? ` — ${tacheChoisie.nom}` : ""}</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 16 }}>
          Tous les poinçons faits sur les tâches internes. Consultation seulement : rien n&apos;est entré en
          comptabilité ni facturé (les heures comptent seulement comme présence, pour la paie).
        </p>

        <form method="get" className="carte carte-m" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
          <Champ libelle="Tâche">
            <select name="tache" defaultValue={tacheId} style={champStyle}>
              <option value="">Toutes</option>
              {taches.map((t) => (
                <option key={t.id} value={t.id}>{t.nom}{t.actif ? "" : " (annulée)"}</option>
              ))}
            </select>
          </Champ>
          <Champ libelle="Employé">
            <select name="employe" defaultValue={employeId} style={champStyle}>
              <option value="">Tous</option>
              {employes.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </Champ>
          <Champ libelle="Du">
            <input type="date" name="debut" max="9999-12-31" defaultValue={debutStr} style={champStyle} />
          </Champ>
          <Champ libelle="Au">
            <input type="date" name="fin" max="9999-12-31" defaultValue={finStr} style={champStyle} />
          </Champ>
          <button type="submit" className="bouton-3d-sombre" style={{ padding: "9px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            Filtrer
          </button>
        </form>

        {lignes.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", marginTop: 24 }}>
            Aucun poinçon sur une tâche interne pour ces critères.
          </p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
              <div className="carte carte-m">
                <div style={titreStyle}>Total</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtHeures(total)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{lignes.length} poinçon{lignes.length > 1 ? "s" : ""}</div>
              </div>
              {!tacheId && <ListeTotaux titre="Par tâche" items={parTache} />}
              {!employeId && <ListeTotaux titre="Par employé" items={parEmploye} />}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {jours.map(({ jour, lignes: lignesJour }) => (
                <div key={jour} className="carte carte-m">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtJour(jour)}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtHeures(lignesJour.reduce((s, l) => s + l.heures, 0))}</span>
                  </div>
                  {lignesJour.map((l) => (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "6px 0", borderTop: "1px dashed var(--border)" }}>
                      <span>
                        <strong>{l.employe.nom}</strong>
                        {!tacheId && <span style={{ color: "var(--text-muted)" }}> · {l.tacheInterne.nom}</span>}
                      </span>
                      <span style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                        {fmtHeure(l.debut)} – {l.fin ? fmtHeure(l.fin) : <span style={{ color: "var(--success)", fontWeight: 700 }}>en cours</span>}
                        <strong style={{ color: "var(--text)", marginLeft: 8 }}>{fmtHeures(l.heures)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Champ({ libelle, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px", fontSize: 11, color: "var(--text-muted)" }}>
      {libelle}
      {children}
    </label>
  );
}

function ListeTotaux({ titre, items }) {
  return (
    <div className="carte carte-m">
      <div style={titreStyle}>{titre}</div>
      {items.map((t) => (
        <div key={t.nom} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}>
          <span>{t.nom} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({t.nombre})</span></span>
          <strong>{fmtHeures(t.heures)}</strong>
        </div>
      ))}
    </div>
  );
}

const titreStyle = { fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 };
const champStyle = { width: "100%", padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 };
