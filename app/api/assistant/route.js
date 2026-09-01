import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { OUTILS } from "@/lib/assistantOutils";

const MAX_TOURS_OUTILS = 5; // évite une boucle infinie si l'IA s'entête à rappeler des outils

const INSTRUCTION_SYSTEME = `Tu es "Assistant SG", l'assistant intégré au logiciel de gestion de ce garage. Tu réponds en français, de façon brève et directe, comme si tu parlais à un employé du garage.

Règles importantes :
- Réponds UNIQUEMENT à partir des résultats des outils que tu as le droit d'appeler. N'invente JAMAIS un chiffre, une adresse ou un nom qui ne vient pas d'un résultat d'outil.
- Si aucun outil pertinent n'est disponible pour répondre (parce que cet employé n'a pas accès à cette section), dis-le clairement — par exemple : "Je n'ai pas accès à cette information avec ton rôle actuel." Ne devine pas.
- Si un outil ne retourne aucun résultat, dis-le simplement plutôt que d'inventer une réponse plausible.
- Si l'employé demande d'ouvrir/aller à une page du logiciel, utilise l'outil ouvrirPage puis confirme brièvement (ex: "J'ouvre la paie.").
- Sois concis : quelques phrases suffisent, pas de longs paragraphes.`;

export async function POST(request) {
  const session = await obtenirSession();
  if (!session) {
    return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ erreur: "Assistant SG n'est pas configuré (clé API manquante)." }, { status: 503 });
  }

  const { message, historique } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ erreur: "Message manquant." }, { status: 400 });
  }

  // Ne présente à l'IA que les outils vraiment permis pour cet employé —
  // l'IA ne peut donc jamais choisir d'appeler un outil interdit. Chaque
  // outil revérifie quand même l'accès lui-même (défense en profondeur),
  // voir lib/assistantOutils.js.
  const outilsPermis = [];
  for (const outil of OUTILS) {
    if (await outil.permis(session)) outilsPermis.push(outil);
  }

  const modele = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  const contents = [...(Array.isArray(historique) ? historique : []), { role: "user", parts: [{ text: message }] }];

  try {
    let reponseTexte = "";
    let navigation = null;

    for (let tour = 0; tour < MAX_TOURS_OUTILS; tour++) {
      const corps = {
        systemInstruction: { parts: [{ text: INSTRUCTION_SYSTEME }] },
        contents,
      };
      if (outilsPermis.length > 0) {
        corps.tools = [{ functionDeclarations: outilsPermis.map((o) => o.declaration) }];
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }
      );
      if (!res.ok) {
        if (res.status === 429) {
          reponseTexte = "Trop de questions posées en peu de temps (limite du plan gratuit) — attends environ une minute avant de réessayer.";
          break;
        }
        const detail = await res.text().catch(() => "");
        throw new Error(`GEMINI_HTTP_${res.status}:${detail.slice(0, 300)}`);
      }
      const data = await res.json();
      const candidat = data.candidates?.[0];
      const parties = candidat?.content?.parts || [];
      const appelsOutils = parties.filter((p) => p.functionCall);

      if (appelsOutils.length === 0) {
        reponseTexte = parties.map((p) => p.text || "").join("").trim() || "Je n'ai pas de réponse à te donner pour l'instant.";
        contents.push({ role: "model", parts: parties });
        break;
      }

      contents.push({ role: "model", parts: parties });

      const reponsesFonctions = [];
      for (const appel of appelsOutils) {
        const outil = outilsPermis.find((o) => o.declaration.name === appel.functionCall.name);
        const resultat = outil
          ? await outil.executer(session, appel.functionCall.args || {})
          : { erreur: "Cet outil n'est pas disponible." };
        if (appel.functionCall.name === "ouvrirPage" && resultat?.url) {
          navigation = resultat.url;
        }
        reponsesFonctions.push({
          functionResponse: { name: appel.functionCall.name, response: { name: appel.functionCall.name, content: resultat } },
        });
      }
      contents.push({ role: "user", parts: reponsesFonctions });

      if (tour === MAX_TOURS_OUTILS - 1) {
        reponseTexte = "Désolé, je n'arrive pas à compléter cette demande pour l'instant.";
      }
    }

    return NextResponse.json({ reponse: reponseTexte, historique: contents, navigation });
  } catch (e) {
    console.error("Erreur Assistant SG:", e);
    return NextResponse.json({ erreur: "Assistant SG a rencontré une erreur. Réessaie dans un instant." }, { status: 500 });
  }
}
