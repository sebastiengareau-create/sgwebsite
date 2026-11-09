import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EnTete from "../components/EnTete";
import TachePoincon from "./TachePoincon";
import TachePhoto from "./TachePhoto";
import SectionTachesInternes from "./SectionTachesInternes";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";
import { jobsDeplacementActif } from "@/lib/envois";
import { CLIENT } from "@/lib/client";
import { bonEstAVenir, dateBon, regrouperParJour, heureQuebec, dateCourteQuebec, libelleJour, cleJourQuebec } from "@/lib/regroupementDates";
import { TACHES_SEULEMENT } from "@/lib/piecesSoumission";
import { libelleVehicule } from "@/lib/vehicules";
import BandeauSection from "../components/BandeauSection";
import { Icone, TEINTES, CarteChiffre, CarteLien, Pastille, TitreGroupe, TitrePanneau, stylePanneau } from "../components/StyleSection";

const VIOLET = "#9A7FC7"; // bons à venir (planifiés plus tard)

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
    // Facture comptoir (lib/comptoir.js) : rien à faire pour l'atelier
    where: { statut: { not: "TERMINE" }, comptoir: false },
    include: {
      client: true,
      vehicule: true,
      problemes: { where: TACHES_SEULEMENT, orderBy: { id: "asc" }, include: { entreesTemps: { include: { employe: true } }, _count: { select: { photos: true } } } },
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

  const moduleDeplacement = await jobsDeplacementActif();
  const [nbMesTaches, nbAbonnements] = moduleDeplacement
    ? await Promise.all([
        prisma.envoiBon.count({ where: { employeId: session.id, statut: { in: STATUTS_ACTIFS } } }),
        prisma.abonnementPush.count({ where: { employeId: session.id } }),
      ])
    : [0, 0];

  const mesChronos = poinconsActifs.filter((t) => t.employeId === session.id).length + poinconsInternesActifs.filter((t) => t.employeId === session.id).length;
  const nbEquipe = poinconsActifs.length + poinconsInternesActifs.length;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <BandeauSection
          icone="⏱️" titre={estGerant ? "Horodateur — vue d'ensemble" : "Horodateur"}
          sousTitre={estGerant ? "Tous les poinçons actifs de l'équipe, par tâche." : "Poinçonne par tâche précise — tu peux avoir plusieurs tâches actives en même temps."}
        />

        {(nbMesTaches > 0 || (moduleDeplacement && nbAbonnements === 0)) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {nbMesTaches > 0 && (
              <CarteLien
                href="/mes-taches" icone="presse" teinte={TEINTES.ambre}
                label={`${nbMesTaches} tâche${nbMesTaches > 1 ? "s" : ""} t'${nbMesTaches > 1 ? "ont" : "a"} été envoyée${nbMesTaches > 1 ? "s" : ""}`}
                detail="Voir mes tâches"
              />
            )}
            {moduleDeplacement && nbAbonnements === 0 && (
              <CarteLien href="/mes-taches" icone="cloche" teinte={TEINTES.bleu} label="Active les notifications" detail="Pour être averti quand un bon t'est envoyé" />
            )}
          </div>
        )}

        <div className="grille-trois" style={{ marginBottom: 24 }}>
          <CarteChiffre
            titre={estGerant ? "Poinçonnés en ce moment" : "Mes chronos en cours"} montant={String(estGerant ? nbEquipe : mesChronos)}
            teinte="var(--success)" couleur={(estGerant ? nbEquipe : mesChronos) > 0 ? "var(--success)" : "var(--text)"}
            note={estGerant ? "Toute l'équipe, bons et tâches internes" : "Bons et tâches internes"}
          />
          <CarteChiffre titre="Bons actifs" montant={String(bonsActifs.length)} teinte="var(--accent)" note="Non terminés, à faire aujourd'hui" />
          <CarteChiffre titre="À venir" montant={String(nbAVenir)} teinte={VIOLET} note="Planifiés pour un autre jour" />
        </div>

        {estGerant && (
          <div style={stylePanneau}>
            <TitrePanneau
              icone="horloge" teinte={TEINTES.vert} titre="Poinçons actifs"
              sousTitre={nbEquipe === 0 ? "Personne n'est poinçonné actuellement." : "Qui travaille sur quoi, en ce moment."}
              droite={<Pastille couleur="var(--success)" fond="var(--success-fond)">{nbEquipe}</Pastille>}
            />
            {[...poinconsActifs.map((t) => ({ id: t.id, nom: t.employe.nom, detail: `Bon #${t.bon.numero} — ${t.tache.description}`, interne: false })),
              ...poinconsInternesActifs.map((t) => ({ id: t.id, nom: t.employe.nom, detail: `${t.tacheInterne.nom} (interne)`, interne: true }))].map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>
                  {t.nom.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{t.nom}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.detail}</div>
                </div>
                <Pastille couleur="var(--success)" fond="var(--success-fond)">{t.interne ? "Interne" : "En cours"}</Pastille>
              </div>
            ))}
          </div>
        )}

        <SectionTachesInternes taches={tachesInternes} monId={session.id} />

        <TitreGroupe couleur="var(--accent)" droite={<Pastille couleur="var(--accent-ombre)" fond="rgba(232,163,61,0.16)">{bonsActifs.length}</Pastille>}>Bons de travail actifs</TitreGroupe>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {bonsActifs.map((b) => (
            <CarteBon key={b.id} b={b}>
              {CLIENT.horodateurBonsReplies ? <BonReplie b={b} monId={session.id} /> : <TachesBon b={b} monId={session.id} />}
            </CarteBon>
          ))}
          {bonsActifs.length === 0 && <p style={{ ...stylePanneau, color: "var(--text-muted)", fontSize: 13.5, textAlign: "center" }}>Aucun bon actif en ce moment.</p>}
        </div>

        {nbAVenir > 0 && (
          <div style={{ marginBottom: 24 }}>
            <TitreGroupe couleur={VIOLET} droite={<Pastille couleur={VIOLET} fond="rgba(154,127,199,0.15)">{nbAVenir}</Pastille>}>À venir</TitreGroupe>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {groupesAVenir.map((g) => (
                <div key={g.cle} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: VIOLET }}>{g.libelle}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>({g.elements.length})</span>
                    <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>
                  {g.elements.map((b) => (
                    <CarteBon key={b.id} b={b} couleur={VIOLET}>
                      {CLIENT.horodateurBonsReplies ? <ResumeTaches b={b} /> : (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--text-muted)" }}>
                          {b.problemes.map((pr) => <li key={pr.id}>{pr.description}</li>)}
                        </ul>
                      )}
                      {/* Le véhicule arrive d'avance : on peut poinçonner quand même,
                          ce qui fait passer le bon « En cours ». */}
                      <details style={{ marginTop: 10 }}>
                        <summary style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", cursor: "pointer" }}>Commencer maintenant</summary>
                        <TachesBon b={b} monId={session.id} />
                      </details>
                    </CarteBon>
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

// Carte d'un bon : bande de couleur à gauche, en-tête, puis le contenu
function CarteBon({ b, couleur = "var(--accent)", children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 14px 14px 18px" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: couleur }} />
      <EnTeteBon b={b} />
      {children}
    </div>
  );
}

function EnTeteBon({ b }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Bon #{b.numero}</span>
          {b.datePrevue && (
            <Pastille couleur={TEINTES.bleu.couleur} fond={TEINTES.bleu.fond}>{libelleJour(cleJourQuebec(b.datePrevue))} à {heureQuebec(b.datePrevue)}</Pastille>
          )}
        </div>
        {/* Véhicule à côté du nom — année, marque, modèle, version seulement
            (pas de NIV ni de plaque) */}
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
          {b.client.nom}
          {libelleVehicule(b.vehicule) && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {libelleVehicule(b.vehicule)}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Créé le {dateCourteQuebec(b.creeLe)}</div>
      </div>
      <Link href={`/bons/${b.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)", textDecoration: "none", whiteSpace: "nowrap" }}>
        Fiche <Icone nom="chevron" taille={14} couleur="var(--accent-ombre)" />
      </Link>
    </div>
  );
}

const TACHES_RESUME = 3;

// Profil horodateurBonsReplies : les premières tâches, une ligne chacune,
// pour que chaque carte garde à peu près la même hauteur
function ResumeTaches({ b }) {
  const reste = b.problemes.length - TACHES_RESUME;
  return (
    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--text-muted)" }}>
      {b.problemes.slice(0, TACHES_RESUME).map((pr) => (
        <li key={pr.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pr.description}</li>
      ))}
      {reste > 0 && <li style={{ listStyle: "none", fontStyle: "italic" }}>… et {reste} autre{reste > 1 ? "s" : ""} tâche{reste > 1 ? "s" : ""}</li>}
    </ul>
  );
}

// Bon actif replié : résumé, mon chrono en cours (avec « Arrêter ») et ceux
// des autres, puis toutes les tâches et leurs chronos sur demande
function BonReplie({ b, monId }) {
  const enCours = b.problemes.flatMap((pr) => pr.entreesTemps.filter((t) => !t.fin).map((t) => ({ ...t, tache: pr })));
  const mien = enCours.find((t) => t.employeId === monId);
  const autres = enCours.length - (mien ? 1 : 0);
  return (
    <>
      <ResumeTaches b={b} />
      {enCours.length > 0 && (
        <div style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 600, marginTop: 8 }}>
          {mien && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--success-fond)", border: "1px solid var(--success)", borderRadius: 12, padding: "8px 10px", marginBottom: 6, color: "var(--text)" }}>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700 }}>{mien.tache.description}</span>
              <TachePoincon problemeId={mien.problemeId} actif debut={mien.debut} />
            </div>
          )}
          {autres > 0 && <div>● {autres} autre{autres > 1 ? "s" : ""} chrono{autres > 1 ? "s" : ""} en cours</div>}
        </div>
      )}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", cursor: "pointer" }}>
          {b.problemes.length > 1 ? `Les ${b.problemes.length} tâches et leurs chronos` : "La tâche et ses chronos"}
        </summary>
        <TachesBon b={b} monId={monId} />
      </details>
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
          <div key={pr.id} style={{ background: monEntree ? "var(--success-fond)" : "var(--bg)", border: `1px solid ${monEntree ? "var(--success)" : "var(--border)"}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{idxTache + 1}</span>
              <span style={{ fontSize: 14, fontWeight: 600, paddingTop: 3 }}>{pr.description}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {totalFini > 0 ? `Ton temps : ${fmtHeures(totalFini)}` : "Non commencé"}
              </span>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginLeft: "auto" }}>
                <TachePhoto bonId={b.id} problemeId={pr.id} nbPhotos={pr._count.photos} />
                <TachePoincon problemeId={pr.id} actif={!!monEntree} debut={monEntree?.debut} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
