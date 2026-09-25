import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateHeureQuebecVersUTC } from "@/lib/temps";
import { verifierCreneau } from "@/lib/disponibilites";
import { normaliserVehicule, libelleVehicule } from "@/lib/vehicules";
import { cleMarque, nomMarque, modeleCanonique } from "@/lib/catalogueVehicules";

export async function POST(request) {
  // Authentification par clé secrète partagée — ce n'est pas un utilisateur
  // connecté à notre appli, c'est le serveur du site de réservation qui
  // appelle directement, donc pas de session/cookie ici.
  const cleRecue = request.headers.get("x-webhook-secret");
  const cleAttendue = process.env.GARAGE_BOOKING_WEBHOOK_SECRET;
  if (!cleAttendue || cleRecue !== cleAttendue) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const moduleCalendrier = await prisma.parametre.findUnique({ where: { cle: "module_calendrier" } });
  if (moduleCalendrier?.valeur === "inactif") {
    return NextResponse.json({ erreur: "Module Calendrier désactivé sur cette installation." }, { status: 403 });
  }

  const body = await request.json();
  const { action, reference } = body;
  if (!reference) return NextResponse.json({ erreur: "Référence manquante." }, { status: 400 });

  if (action === "annuler") {
    const rdv = await prisma.rendezVous.findUnique({ where: { referenceExterne: reference } });
    if (!rdv) return NextResponse.json({ erreur: "Rendez-vous introuvable." }, { status: 404 });
    await prisma.rendezVous.update({ where: { id: rdv.id }, data: { statut: "ANNULE" } });
    return NextResponse.json({ ok: true });
  }

  // Par défaut : création (ou ignore si déjà reçu — évite les doublons
  // si le site de réservation renvoie la même notification deux fois)
  const dejaRecu = await prisma.rendezVous.findUnique({ where: { referenceExterne: reference } });
  if (dejaRecu) return NextResponse.json({ ok: true, deja: true });

  const { service, date, time, duration_min, customer_name, customer_phone, customer_email, vehicle, note } = body;
  if (!service || !date || !time || !customer_name) {
    return NextResponse.json({ erreur: "Champs manquants." }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return NextResponse.json({ erreur: "Format de date (AAAA-MM-JJ) ou d'heure (HH:MM) invalide." }, { status: 400 });
  }

  // Le site offre les cases de /api/rendezvous/disponibilites, mais une case
  // peut avoir été prise entre-temps : on revérifie avant d'accepter.
  const debut = dateHeureQuebecVersUTC(date, time);
  const dureeMinutes = Number(duration_min) || 60;
  const raison = debut < new Date() ? "Ce créneau est déjà passé." : await verifierCreneau(debut, dureeMinutes);
  if (raison) return NextResponse.json({ erreur: raison, indisponible: true }, { status: 409 });

  // Véhicule : le site peut envoyer une simple description (vehicle: "Honda
  // Civic 2019") et/ou les mêmes champs que le dossier véhicule du logiciel —
  // vehicle_year, vehicle_make, vehicle_model, vehicle_trim, vehicle_vin,
  // vehicle_plate (listes offertes par /api/vehicules/catalogue). Un NIV ou
  // une plaque mal formés ne bloquent pas la réservation : ils sont écartés.
  const details = extraireVehicule(body);
  const vehiculeInfo = (typeof vehicle === "string" && vehicle.trim()) || libelleVehicule(details) || null;

  const rdv = await prisma.rendezVous.create({
    data: {
      referenceExterne: reference,
      source: "WEB",
      clientNom: customer_name,
      clientTelephone: customer_phone || null,
      vehiculeInfo,
      vehiculeDetails: details || undefined,
      date: debut,
      dureeMinutes,
      motif: service + (note ? ` — ${note}` : "") + (customer_email ? ` (${customer_email})` : ""),
    },
  });

  return NextResponse.json({ ok: true, id: rdv.id });
}

function extraireVehicule(body) {
  const objet = body.vehicle && typeof body.vehicle === "object" ? body.vehicle : {};
  const brut = {
    annee: body.vehicle_year ?? objet.year,
    marque: body.vehicle_make ?? objet.make,
    modele: body.vehicle_model ?? objet.model,
    version: body.vehicle_trim ?? objet.trim,
    niv: body.vehicle_vin ?? objet.vin,
    plaque: body.vehicle_plate ?? objet.plate,
  };
  // Écarte seulement le champ fautif (NIV, plaque ou année) plutôt que tout le véhicule
  for (const champ of ["niv", "plaque", "annee"]) {
    if (normaliserVehicule({ [champ]: brut[champ] }).erreur) brut[champ] = null;
  }
  const resultat = normaliserVehicule(brut);
  if (resultat.erreur || resultat.vide) return null;
  const data = resultat.data;
  // Même orthographe que les listes du logiciel (« HONDA » → « Honda »)
  const cle = cleMarque(data.marque);
  if (cle) data.marque = nomMarque(cle);
  if (data.modele) data.modele = modeleCanonique(data.marque, data.modele);
  return data;
}
