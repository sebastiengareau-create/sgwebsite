import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { obtenirInfosEntreprise, lignesEnteteEntreprise } from "@/lib/config";
import { elevageActif, peutGererElevage } from "@/lib/elevage";
import { SEXES, GENETIQUES, libelle, age, dateLisible } from "@/lib/elevageCalculs";
import LogoClient from "../../components/LogoClient";

// Page publique de traçabilité d'un paquet de viande : le client scanne le
// code QR de l'étiquette (lib/pdfEtiquettesElevage.js) et voit de quelle
// bête vient sa viande — naissance, lignée, génétique, persillage, abattage.
// Rien de financier ni d'interne (coûts, notes, soins). L'adresse porte
// l'identifiant du lot, impossible à deviner ; jamais indexée.
export const metadata = { title: "D'où vient votre viande", robots: { index: false, follow: false } };

const dateLongue = (d) => new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(d));

function Etape({ icone, titre, children, derniere }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(232,163,61,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icone}</span>
        {!derniere && <span style={{ flex: 1, width: 2, background: "var(--border)", margin: "4px 0" }} />}
      </div>
      <div style={{ paddingBottom: derniere ? 0 : 18, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{titre}</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{children}</div>
      </div>
    </div>
  );
}

export default async function Tracabilite(props) {
  const { id } = await props.params;
  const [entreprise, actif] = await Promise.all([obtenirInfosEntreprise(), elevageActif()]);
  const lot = actif
    ? await prisma.lotViande.findUnique({
      where: { id },
      select: {
        id: true,
        coupe: { select: { nom: true } },
        abattage: {
          select: {
            date: true, bms: true,
            bete: {
              select: {
                id: true, numero: true, nom: true, sexe: true, genetique: true, pourcentageWagyu: true, dateNaissance: true,
                origine: true, dateAcquisition: true, pere: true, mere: { select: { numero: true, nom: true } }, pereBete: { select: { numero: true, nom: true } },
              },
            },
          },
        },
      },
    })
    : null;

  if (!lot) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🥩</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>
            Cette étiquette n&apos;est plus reconnue. Communiquez avec nous pour en savoir plus sur votre viande{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.
          </p>
        </div>
      </div>
    );
  }

  const { abattage } = lot;
  const bete = abattage.bete;
  const nomBete = bete.nom || `la bête ${bete.numero}`;
  const genetique = [bete.genetique && libelle(GENETIQUES, bete.genetique).split(" (")[0], bete.pourcentageWagyu != null && `${bete.pourcentageWagyu} % wagyu`].filter(Boolean).join(" · ");
  const lignee = [bete.mere && `mère : ${bete.mere.nom || bete.mere.numero}`, (bete.pereBete || bete.pere) && `père : ${bete.pereBete ? bete.pereBete.nom || bete.pereBete.numero : bete.pere}`].filter(Boolean).join(" · ");
  // Employé connecté qui a scanné avec l'appareil photo : raccourcis vers l'appli
  const employe = await peutGererElevage(await obtenirSession());

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, marginBottom: 16, borderBottom: "2px solid var(--text)" }}>
          <LogoClient alt={entreprise.nomEntreprise} width={84} height={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{entreprise.nomEntreprise}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {lignesEnteteEntreprise(entreprise).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        </header>

        {employe && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <Link href={`/elevage/viande?lot=${lot.id}`} style={{ textAlign: "center", padding: "11px 8px", borderRadius: 12, background: "var(--accent)", color: "#221f18", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Vendre ce paquet</Link>
            <Link href={`/elevage/${bete.id}`} style={{ textAlign: "center", padding: "11px 8px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Fiche de la bête</Link>
          </div>
        )}

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>D&apos;où vient votre viande</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", margin: "4px 0 6px", overflowWrap: "anywhere" }}>{lot.coupe.nom}</h1>
          <p style={{ fontSize: 15, margin: 0, lineHeight: 1.5 }}>
            Ce paquet provient de <strong>{nomBete}</strong>{bete.nom ? ` (${bete.numero})` : ""}, élevée par {entreprise.nomEntreprise}.
          </p>
          {(genetique || abattage.bms) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {genetique && <span style={{ fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "rgba(232,163,61,0.18)" }}>{genetique}</span>}
              {abattage.bms && <span style={{ fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "var(--surface-alt)" }}>Persillage BMS {abattage.bms} / 12</span>}
            </div>
          )}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 20 }}>
          {(bete.dateNaissance || bete.origine === "NEE_ICI") && (
            <Etape icone="🐮" titre={bete.origine === "NEE_ICI" ? "Née à la ferme" : "Naissance"}>
              {bete.dateNaissance ? `Le ${dateLongue(bete.dateNaissance)}` : "Née et élevée chez nous"}
              {` · ${libelle(SEXES, bete.sexe).split(" (")[0].toLowerCase()}`}
            </Etape>
          )}
          {bete.origine === "ACHETEE" && bete.dateAcquisition && (
            <Etape icone="🚚" titre="Arrivée à la ferme">Le {dateLongue(bete.dateAcquisition)}</Etape>
          )}
          {lignee && <Etape icone="🧬" titre="Lignée">{lignee}</Etape>}
          <Etape icone="🥩" titre="Abattage et découpe" derniere>
            Le {dateLongue(abattage.date)}
            {bete.dateNaissance && ` · à ${age(bete.dateNaissance, abattage.date)}`}
          </Etape>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", margin: "16px 0 0" }}>
          Lot {bete.numero} · abattage du {dateLisible(abattage.date)}
        </p>
      </div>
    </div>
  );
}
