import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateAujourdhuiQuebec, limitesJourQuebec, dateQuebecStr, FUSEAU } from "@/lib/temps";
import EnTete from "../../../../components/EnTete";
import { argent } from "@/lib/format";
import BandeauSection from "../../../../components/BandeauSection";
import { TEINTES, CarteChiffre, Pastille, TitrePanneau, stylePanneau } from "../../../../components/StyleSection";

// Historique des poinçons sur les tâches internes (Paramètres → Tâches
// internes → Historique). Consultation seulement : ces poinçons ne créent
// aucune écriture comptable ni facture. Le coût affiché = heures × coût
// horaire du garage (cout_horaire_mecanicien). Un poinçon ajusté dans
// Productivité par employés montre ses heures d'origine.

const DATE_VALIDE = /^\d{4}-\d{2}-\d{2}$/;

function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return min === 60 ? `${heures + 1}h00` : `${heures}h${String(min).padStart(2, "0")}`;
}

function fmtHeure(date) {
  return new Date(date).toLocaleTimeString("fr-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" });
}

function fmtJourHeure(date) {
  return new Date(date).toLocaleString("fr-CA", { timeZone: FUSEAU, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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

  const [taches, entrees, parametreCout] = await Promise.all([
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
    prisma.parametre.findUnique({ where: { cle: "cout_horaire_mecanicien" } }),
  ]);
  const coutHoraire = Number(parametreCout?.valeur || 95);
  const cout = (heures) => `${argent((heures * coutHoraire))}`;

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
      <div className="conteneur-page">
        <Link href="/gerant/parametres" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux paramètres</Link>
        <div style={{ marginTop: 8 }}>
          <BandeauSection
            icone="🛠️" titre={`Historique des tâches internes${tacheChoisie ? ` — ${tacheChoisie.nom}` : ""}`}
            sousTitre="Tous les poinçons faits sur les tâches internes — consultation seulement."
          />
        </div>

        <form method="get" style={stylePanneau}>
          <TitrePanneau
            icone="loupe" teinte={TEINTES.bleu} titre="Filtres"
            sousTitre={`Rien n'est entré en comptabilité ni facturé (les heures comptent comme présence, pour la paie). Coût au coût horaire du garage, ${argent(coutHoraire)}/h. Pour ajuster un poinçon : Productivité par employés.`}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
          </div>
          <button type="submit" className="bouton-3d" style={{ width: "100%", marginTop: 12, padding: 11, borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
            Afficher
          </button>
        </form>

        {lignes.length === 0 ? (
          <p style={{ ...stylePanneau, color: "var(--text-muted)", fontSize: 13.5, textAlign: "center" }}>
            Aucun poinçon sur une tâche interne pour ces critères.
          </p>
        ) : (
          <>
            <div className="grille-trois" style={{ marginBottom: 16 }}>
              <CarteChiffre titre="Heures" montant={fmtHeures(total)} teinte="var(--bleu)" note={`Du ${debutStr} au ${finStr}`} />
              <CarteChiffre titre="Coût" montant={cout(total)} teinte="var(--danger)" couleur="var(--danger)" note={`Heures × ${argent(coutHoraire)}/h`} />
              <CarteChiffre titre="Poinçons" montant={String(lignes.length)} teinte="var(--accent)" note={`${jours.length} journée${jours.length > 1 ? "s" : ""}`} />
            </div>

            {(!tacheId || !employeId) && (
              <div className={!tacheId && !employeId ? "grille-deux" : undefined} style={{ marginBottom: 16 }}>
                {!tacheId && <ListeTotaux titre="Par tâche" icone="outils" teinte={TEINTES.ambre} items={parTache} cout={cout} />}
                {!employeId && <ListeTotaux titre="Par employé" icone="utilisateurs" teinte={TEINTES.vert} items={parEmploye} cout={cout} />}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              {jours.map(({ jour, lignes: lignesJour }) => {
                const heuresJour = lignesJour.reduce((s, l) => s + l.heures, 0);
                return (
                  <div key={jour} style={stylePanneau}>
                    <TitrePanneau
                      icone="calendrier" teinte={TEINTES.bleu} titre={fmtJour(jour)}
                      sousTitre={`${lignesJour.length} poinçon${lignesJour.length > 1 ? "s" : ""}`}
                      droite={<span style={{ textAlign: "right", whiteSpace: "nowrap", paddingTop: 2 }}><span style={{ display: "block", fontSize: 16, fontWeight: 800 }}>{fmtHeures(heuresJour)}</span><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cout(heuresJour)}</span></span>}
                    />
                    {lignesJour.map((l, i) => (
                      <div key={l.id} style={{ padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
                            {l.employe.nom.charAt(0).toUpperCase()}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{l.employe.nom}{!tacheId && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {l.tacheInterne.nom}</span>}</div>
                            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                              {fmtHeure(l.debut)} – {l.fin ? fmtHeure(l.fin) : <span style={{ color: "var(--success)", fontWeight: 700 }}>en cours</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtHeures(l.heures)}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{cout(l.heures)}</div>
                          </div>
                        </div>
                        {(l.ajouteLe || l.modifieLe) && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, marginTop: 6, marginLeft: 46 }}>
                            {l.ajouteLe && (
                              <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">
                                Ajouté à la main{l.ajoutePar ? ` par ${l.ajoutePar}` : ""} le {fmtJourHeure(l.ajouteLe)}
                              </Pastille>
                            )}
                            {l.modifieLe && (
                              <span style={{ fontSize: 12, color: "var(--avertissement)", fontWeight: 600 }}>
                                Ajusté{l.modifiePar ? ` par ${l.modifiePar}` : ""} le {fmtJourHeure(l.modifieLe)} — à l&apos;origine{" "}
                                {fmtHeure(l.debutOriginal)} – {l.finOriginal ? fmtHeure(l.finOriginal) : "en cours"}
                                {l.finOriginal && ` (${fmtHeures((new Date(l.finOriginal) - new Date(l.debutOriginal)) / 3600000)})`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Champ({ libelle, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
      {libelle}
      {children}
    </label>
  );
}

function ListeTotaux({ titre, icone, teinte, items, cout }) {
  return (
    <div style={{ ...stylePanneau, marginBottom: 0, height: "100%", boxSizing: "border-box" }}>
      <TitrePanneau icone={icone} teinte={teinte} titre={titre} />
      {items.map((t, i) => (
        <div key={t.nom} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13.5, padding: "8px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <span style={{ minWidth: 0 }}><strong>{t.nom}</strong> <span style={{ color: "var(--text-muted)", fontSize: 12 }}>({t.nombre})</span></span>
          <span style={{ whiteSpace: "nowrap", textAlign: "right" }}><strong>{fmtHeures(t.heures)}</strong> <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{cout(t.heures)}</span></span>
        </div>
      ))}
    </div>
  );
}

const champStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" };
