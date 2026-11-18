import { routesCollection } from "@/lib/immobilierRoutes";

export const { POST } = routesCollection("logementImmo", "logement", { doublon: "Cet immeuble a déjà un logement à ce numéro." });
