import { routesCollection } from "@/lib/coproprieteRoutes";

export const { POST } = routesCollection("budgetCopro", "budget", { doublon: "Le budget de cet exercice existe déjà." });
