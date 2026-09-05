import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function formatIcsUTC(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsEscape(texte) {
  return String(texte).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

const STATUT_ICS = { CONFIRME: "CONFIRMED", COMPLETE: "CONFIRMED", ANNULE: "CANCELLED" };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cleRecue = searchParams.get("cle");

  // La clé du flux est générée une seule fois puis stockée — pas besoin de
  // connexion pour accéder au flux (Outlook ne peut pas se connecter avec
  // notre session), mais l'adresse elle-même reste secrète et privée.
  let parametreCle = await prisma.parametre.findUnique({ where: { cle: "calendrier_flux_cle" } });
  if (!parametreCle) {
    parametreCle = await prisma.parametre.create({
      data: { cle: "calendrier_flux_cle", valeur: crypto.randomBytes(20).toString("hex") },
    });
  }
  if (cleRecue !== parametreCle.valeur) {
    return new Response("Non autorisé.", { status: 401 });
  }

  const moduleCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (moduleCalendrier?.valeur === "inactif") {
    return new Response("Module Calendrier désactivé.", { status: 404 });
  }

  const rendezVous = await prisma.rendezVous.findMany({ orderBy: { date: "asc" } });

  const evenements = rendezVous.map((r) => {
    const debut = new Date(r.date);
    const fin = new Date(debut.getTime() + r.dureeMinutes * 60000);
    const description = [
      r.clientTelephone ? `Téléphone : ${r.clientTelephone}` : null,
      r.vehiculeInfo ? `Véhicule : ${r.vehiculeInfo}` : null,
      r.note ? `Note : ${r.note}` : null,
    ].filter(Boolean).join("\\n");

    return [
      "BEGIN:VEVENT",
      `UID:${r.id}@vrpremium`,
      `DTSTAMP:${formatIcsUTC(new Date())}`,
      `DTSTART:${formatIcsUTC(debut)}`,
      `DTEND:${formatIcsUTC(fin)}`,
      `SUMMARY:${icsEscape(`${r.clientNom} — ${r.motif}`)}`,
      description ? `DESCRIPTION:${icsEscape(description)}` : null,
      `STATUS:${STATUT_ICS[r.statut] || "CONFIRMED"}`,
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });

  const contenu = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Garage//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Rendez-vous",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...evenements,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(contenu, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=rendez-vous.ics",
    },
  });
}
