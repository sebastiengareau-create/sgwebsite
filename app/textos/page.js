import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { textosActifs, listerConversations, numeroRefuse, clientParNumero } from "@/lib/textosAuto";
import { numeroE164 } from "@/lib/textos";
import EnTete from "../components/EnTete";
import BandeauSection from "../components/BandeauSection";
import TextosClient from "./TextosClient";

export const metadata = { title: "Textos" };

// Textos (module Textos automatiques, lib/textosAuto.js) : les conversations
// avec les clients, du numéro de l'atelier — réponses reçues, textos
// automatiques et envoyés depuis l'appli. Accès : section Clients.
export default async function PageTextos(props) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "clients"))) redirect("/gerant");
  const { numero: numeroParam, q } = await props.searchParams;

  if (!(await textosActifs())) {
    return (
      <div>
        <EnTete nom={session.nom} role={session.role} />
        <div className="conteneur-page">
          <BandeauSection icone="💬" titre="Textos" />
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Les textos automatiques ne sont pas actifs. Ils s&apos;activent dans Administrateur → Modules, avec un compte Twilio.{" "}
            <Link href="/gerant" style={{ color: "var(--text)" }}>Retour</Link>
          </p>
        </div>
      </div>
    );
  }

  const recherche = typeof q === "string" ? q.slice(0, 80) : "";
  const numero = typeof numeroParam === "string" ? numeroE164(numeroParam) : null;
  const conversations = await listerConversations({ recherche });

  let fil = null;
  if (numero) {
    const [derniers, refuse] = await Promise.all([
      prisma.texto.findMany({ where: { telephone: numero }, orderBy: { creeLe: "desc" }, take: 200 }),
      numeroRefuse(numero),
    ]);
    const textos = derniers.reverse();
    const clientId = [...textos].reverse().find((t) => t.clientId)?.clientId;
    const client = clientId
      ? await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, nom: true } })
      : await clientParNumero(numero);
    const bonIds = [...new Set(textos.map((t) => t.bonId).filter(Boolean))];
    const bons = bonIds.length ? await prisma.bonTravail.findMany({ where: { id: { in: bonIds } }, select: { id: true, numero: true } }) : [];
    fil = {
      numero, refuse,
      client: client ? { id: client.id, nom: client.nom } : null,
      bons: Object.fromEntries(bons.map((b) => [b.id, b.numero])),
      textos: textos.map((t) => ({
        id: t.id, direction: t.direction, corps: t.corps, type: t.type, statut: t.statut, erreur: t.erreur,
        employeNom: t.employeNom, bonId: t.bonId, lu: t.lu, creeLe: t.creeLe.toISOString(),
      })),
    };
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page" style={{ paddingBottom: 40 }}>
        <BandeauSection icone="💬" titre="Textos" sousTitre="Les conversations avec les clients, du numéro de l'atelier" />
        <TextosClient
          conversations={conversations.map((c) => ({ ...c, dernier: { ...c.dernier, creeLe: new Date(c.dernier.creeLe).toISOString() } }))}
          fil={fil}
          recherche={recherche}
        />
      </div>
    </div>
  );
}
