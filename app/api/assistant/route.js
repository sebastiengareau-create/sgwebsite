import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { OUTILS } from "@/lib/assistantOutils";
import { dateAujourdhuiQuebec } from "@/lib/temps";

const MAX_TOURS_OUTILS = 8; // assez pour enchaîner quelques recherches, sans boucle infinie
const MAX_LIENS = 10;

const INSTRUCTION_SYSTEME = `Tu es "Assistant SG", l'assistant intégré au logiciel de gestion de ce garage. Tu réponds en français, de façon brève et directe, comme si tu parlais à un employé du garage.

Règles importantes :
- Réponds UNIQUEMENT à partir des résultats des outils que tu as le droit d'appeler. N'invente JAMAIS un chiffre, une adresse ou un nom qui ne vient pas d'un résultat d'outil.
- Si aucun outil pertinent n'est disponible pour répondre (parce que cet employé n'a pas accès à cette section), dis-le clairement — par exemple : "Je n'ai pas accès à cette information avec ton rôle actuel." Ne devine pas.
- Si un outil ne retourne aucun résultat, dis-le simplement plutôt que d'inventer une réponse plausible.
- Si l'employé demande d'ouvrir/aller à une page du logiciel, utilise l'outil ouvrirPage puis confirme brièvement (ex: "J'ouvre la paie.").
- Sois concis : quelques phrases suffisent, pas de longs paragraphes.

Recherche :
- Cherche activement. Tu peux appeler plusieurs outils, en même temps ou l'un après l'autre, pour bien répondre (ex. trouver le client, puis ses bons, puis ses factures).
- Si une recherche ne donne rien, essaie AVANT de conclure : un mot plus court ou partiel, une autre orthographe (avec ou sans accent), un autre outil, ou rechercheGlobale. Dis qu'il n'y a rien seulement après ces essais.
- Si la question est vague ou si tu ne sais pas si c'est un client, un bon, une pièce ou un fournisseur, commence par rechercheGlobale.
- Exemples : « montre-moi les rendez-vous du 29 septembre » → rendezVousDuJour avec date=AAAA-09-29 (année en cours si non précisée) ; « les pièces de NAPA » → inventairePiece avec fournisseurNom="NAPA" ; « quoi commander » → inventairePiece avec sousLeSeuil=true ; « les bons en cours » → chercherBonTravail avec statut=EN_COURS.
- Quand on te demande de « montrer » une liste, donne la liste avec les liens, et termine par un lien vers la page complète quand il y en a une (ex. la journée du calendrier).

Liens :
- Les résultats des outils contiennent des champs « lien » (ex. /bons/abc123). Chaque fois que tu mentionnes un client, un bon, une facture, une soumission, une pièce, un fournisseur, un employé ou un rendez-vous, écris-le sous forme de lien Markdown avec ce chemin exact : [Bon #2026-014](/bons/abc123), [Jean Tremblay](/secretaire/clients/xyz).
- N'invente jamais un lien : utilise seulement les chemins reçus dans les résultats.
- Pour plusieurs résultats, fais une courte liste à puces (« - »), un résultat par ligne avec son lien et l'info utile (statut, montant, date…).`;

// Rassemble les liens des résultats d'outils (champ « lien » à n'importe
// quelle profondeur) — le panneau les affiche en raccourcis sous la réponse
// si l'IA ne les a pas déjà mis dans son texte.
function extraireLiens(valeur, liens = []) {
  if (!valeur || typeof valeur !== "object" || liens.length >= MAX_LIENS) return liens;
  if (Array.isArray(valeur)) {
    for (const v of valeur) extraireLiens(v, liens);
    return liens;
  }
  if (typeof valeur.lien === "string" && valeur.lien.startsWith("/") && !liens.some((l) => l.url === valeur.lien)) {
    const qui = valeur.nom || valeur.client || valeur.fournisseur || valeur.employe;
    const libelle = valeur.numero && typeof valeur.numero === "string"
      ? `#${valeur.numero}${qui && qui !== valeur.numero ? ` — ${qui}` : ""}`
      : qui || valeur.description || "Ouvrir";
    liens.push({ url: valeur.lien, libelle: String(libelle).slice(0, 60) });
  }
  for (const [cle, v] of Object.entries(valeur)) {
    if (cle !== "lien" && typeof v === "object") extraireLiens(v, liens);
  }
  return liens;
}

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
    const liens = [];

    for (let tour = 0; tour < MAX_TOURS_OUTILS; tour++) {
      const corps = {
        systemInstruction: { parts: [{ text: `${INSTRUCTION_SYSTEME}\n\nAujourd'hui : ${dateAujourdhuiQuebec()} (heure du Québec).` }] },
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
        extraireLiens(resultat, liens);
        reponsesFonctions.push({
          functionResponse: { name: appel.functionCall.name, response: { name: appel.functionCall.name, content: resultat } },
        });
      }
      contents.push({ role: "user", parts: reponsesFonctions });

      if (tour === MAX_TOURS_OUTILS - 1) {
        reponseTexte = "Désolé, je n'arrive pas à compléter cette demande pour l'instant.";
      }
    }

    return NextResponse.json({ reponse: reponseTexte, historique: contents, navigation, liens: liens.slice(0, MAX_LIENS) });
  } catch (e) {
    console.error("Erreur Assistant SG:", e);
    return NextResponse.json({ erreur: "Assistant SG a rencontré une erreur. Réessaie dans un instant." }, { status: 500 });
  }
}
