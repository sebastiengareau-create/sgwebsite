// Lecture automatique d'une facture de fournisseur (photo ou PDF) : l'IA en
// tire le fournisseur, le numéro, les dates, les lignes et les taxes, et le
// formulaire « Nouvelle dépense » se remplit seul. Rien n'est enregistré :
// la personne vérifie, corrige au besoin, puis enregistre comme d'habitude.
//
// Même service et même clé que l'Assistant SG (GEMINI_API_KEY). Le modèle se
// change avec GEMINI_MODEL_FACTURES. Le fichier n'est pas conservé.

const TAILLE_MAX = 12 * 1024 * 1024;
const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function lectureFactureConfiguree() {
  return !!process.env.GEMINI_API_KEY;
}

// Compare des noms sans tenir compte des accents, de la casse, de la
// ponctuation ni des mentions « inc. », « ltée »…
function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(inc|ltee|ltd|limitee|enr|senc|corp|co|cie)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

// Fournisseur de la liste qui correspond au nom lu sur la facture → ou null
function trouverFournisseur(nom, fournisseurs) {
  const cible = normaliser(nom);
  if (cible.length < 3) return null;
  const exact = fournisseurs.find((f) => normaliser(f.nom) === cible);
  if (exact) return exact;
  // « NAPA Pièces d'auto Laval » ↔ « NAPA Pièces d'auto » : l'un contient l'autre
  const proches = fournisseurs.filter((f) => {
    const n = normaliser(f.nom);
    return n.length >= 4 && (cible.includes(n) || n.includes(cible));
  });
  return proches.length === 1 ? proches[0] : null;
}

// Type du fichier : celui donné par le navigateur, sinon déduit du nom
// (certains téléphones n'en donnent pas pour une photo HEIC ou un PDF)
const TYPE_PAR_EXTENSION = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };
function typeDuFichier(type, nom) {
  if (type && type !== "application/octet-stream") return type;
  return TYPE_PAR_EXTENSION[String(nom || "").split(".").pop().toLowerCase()] || type || "";
}

// Modèles essayés dans l'ordre : celui réglé pour les factures, celui de
// l'Assistant SG (connu pour fonctionner avec la clé de l'installation),
// puis les modèles courants. Le suivant est essayé quand un modèle est
// introuvable, saturé ou ne répond rien.
function modelesAEssayer() {
  return [...new Set([process.env.GEMINI_MODEL_FACTURES, process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean))];
}

// Objet JSON d'une réponse du modèle : les parties de réflexion sont
// ignorées, et le JSON est repris même entouré de texte ou de ```json
function extraireJson(data) {
  const texte = (data?.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
  if (!texte) return null;
  const debut = texte.indexOf("{"), fin = texte.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try { return JSON.parse(texte.slice(debut, fin + 1)); } catch { return null; }
}

// Message de Google dans une réponse d'erreur, court et sans la clé
function raisonErreur(status, corps) {
  let message = "";
  try { message = JSON.parse(corps)?.error?.message || ""; } catch {}
  const propre = (message || corps || "").replace(/key=[\w-]+/g, "key=…").replace(/\s+/g, " ").trim().slice(0, 220);
  return `erreur ${status}${propre ? ` — ${propre}` : ""}`;
}

const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dateValide = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !Number.isNaN(Date.parse(d)) ? d : "");

// Image réduite avant l'envoi (une photo de téléphone pèse plusieurs Mo) ;
// PDF envoyé tel quel. Un format que sharp ne lit pas part tel quel aussi.
async function preparerFichier(tampon, type) {
  if (type === "application/pdf") return { mimeType: type, data: tampon.toString("base64") };
  try {
    const sharp = (await import("sharp")).default;
    const reduit = await sharp(tampon).rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return { mimeType: "image/jpeg", data: reduit.toString("base64") };
  } catch {
    return { mimeType: type, data: tampon.toString("base64") };
  }
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    estUneFacture: { type: "BOOLEAN", description: "Faux si le document n'est pas une facture ou un reçu lisible" },
    fournisseur: { type: "STRING", description: "Nom de l'entreprise qui a émis la facture (le vendeur, pas le client facturé)" },
    numeroFacture: { type: "STRING", description: "Numéro de la facture, vide si absent" },
    dateFacture: { type: "STRING", description: "Date de la facture, format AAAA-MM-JJ" },
    dateEcheance: { type: "STRING", description: "Date d'échéance du paiement, format AAAA-MM-JJ, vide si absente" },
    sousTotal: { type: "NUMBER", description: "Total avant taxes" },
    tps: { type: "NUMBER", description: "Montant de TPS (ou GST), 0 si absent" },
    tvq: { type: "NUMBER", description: "Montant de TVQ (ou QST), 0 si absent" },
    total: { type: "NUMBER", description: "Total à payer, taxes incluses" },
    lignes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING", description: "Article ou service, avec la quantité si elle n'est pas 1 (ex. « Filtre à huile × 4 »)" },
          montant: { type: "NUMBER", description: "Montant de la ligne avant taxes (quantité × prix)" },
          poste: { type: "STRING", description: "Poste de dépense le plus approprié, choisi dans la liste fournie" },
        },
        required: ["description", "montant", "poste"],
      },
    },
  },
  required: ["estUneFacture", "fournisseur", "dateFacture", "sousTotal", "tps", "tvq", "total", "lignes"],
};

// tampon : contenu du fichier ; type : son type MIME.
// → { fournisseurId, fournisseurLu, description, dateFacture, dateEcheance,
//     lignes: [{ categorieDepenseId, description, montant }], tpsPayee,
//     tvqPayee, avertissements: [...] }
// Lance une erreur dont le message commence par « LECTURE: » quand il y a
// quelque chose à dire à la personne.
async function lireFacture({ tampon, type: typeRecu, nom, fournisseurs, categories, categorieDefautId }) {
  if (!lectureFactureConfiguree()) throw new Error("LECTURE:La lecture automatique n'est pas configurée (clé GEMINI_API_KEY manquante).");
  const type = typeDuFichier(typeRecu, nom);
  if (type !== "application/pdf" && !type.startsWith("image/")) throw new Error("LECTURE:Choisis une photo (JPEG, PNG) ou un PDF.");
  if (tampon.length === 0) throw new Error("LECTURE:Le fichier est vide. Reprends la photo ou choisis un autre fichier.");
  if (tampon.length > TAILLE_MAX) throw new Error("LECTURE:Ce fichier est trop lourd (12 Mo au maximum).");

  const fichier = await preparerFichier(tampon, type);
  const postes = categories.map((c) => c.nom);
  const consigne = `Ce document est une facture ou un reçu d'un fournisseur, reçu par une entreprise du Québec. Extrais-en les données et réponds uniquement par un objet JSON.

Règles :
- N'invente rien : un champ absent ou illisible reste vide (texte) ou à 0 (montant).
- Les montants sont des nombres, sans symbole ni espace, avec le point comme séparateur décimal.
- « lignes » : une ligne par article ou service facturé, montant avant taxes. Les frais (transport, environnement, consigne…) sont des lignes aussi. Les rabais sont des lignes à montant négatif. S'il y a plus de 25 lignes, regroupe les articles semblables. La somme des lignes doit égaler le sous-total.
- « poste » de chaque ligne : exactement un des noms de cette liste — ${postes.map((p) => `« ${p} »`).join(", ")}.
- Les dates sont au format AAAA-MM-JJ. Une date écrite JJ/MM/AAAA ou « 3 mars 2025 » est convertie.
- Champs de l'objet : estUneFacture (booléen), fournisseur, numeroFacture, dateFacture, dateEcheance, sousTotal, tps, tvq, total, lignes (liste de { description, montant, poste }).`;

  // Chaque modèle est essayé avec le schéma de réponse, puis sans (certains
  // le refusent) ; la raison du dernier échec est montrée à la personne
  let raison = "aucune réponse";
  let sature = false;
  for (const modele of modelesAEssayer()) {
    for (const avecSchema of [true, false]) {
      let res;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ inlineData: fichier }, { text: consigne }] }],
              generationConfig: { temperature: 0, responseMimeType: "application/json", ...(avecSchema && { responseSchema: SCHEMA }) },
            }),
            signal: AbortSignal.timeout(90000),
          }
        );
      } catch (e) {
        raison = e.name === "TimeoutError" ? `${modele} : pas de réponse après 90 secondes` : `${modele} : service injoignable`;
        console.error("Lecture de facture :", raison, e.message);
        break; // modèle suivant
      }
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const lu = extraireJson(data);
        if (lu) {
          if (lu.estUneFacture === false) throw new Error("LECTURE:Ce document ne ressemble pas à une facture lisible. Essaie une photo plus nette, bien à plat et bien éclairée.");
          return mettreEnForme(lu, { fournisseurs, categories, categorieDefautId });
        }
        const candidat = data?.candidates?.[0];
        raison = `${modele} : réponse vide (${candidat?.finishReason || data?.promptFeedback?.blockReason || "sans texte"})`;
        console.error("Lecture de facture :", raison);
        break; // modèle suivant
      }
      const corps = await res.text().catch(() => "");
      raison = `${modele} : ${raisonErreur(res.status, corps)}`;
      console.error("Lecture de facture :", raison);
      if (res.status === 429) sature = true;
      // Clé refusée : inutile d'essayer autre chose
      if (res.status === 401 || res.status === 403 || /API key/i.test(corps)) {
        throw new Error(`LECTURE:La clé du service de lecture est refusée (${raison}). Vérifie GEMINI_API_KEY dans Railway.`);
      }
      if (res.status !== 400) break; // 404, 429, 5xx : modèle suivant ; 400 : réessai sans schéma
    }
  }
  if (sature) throw new Error(`LECTURE:Trop de lectures en peu de temps, ou quota de la clé atteint — attends une minute et réessaie. (${raison})`);
  throw new Error(`LECTURE:La lecture a échoué. Réessaie, ou entre la facture à la main. Détail : ${raison}`);
}

// Données lues → valeurs du formulaire, avec les vérifications d'usage
function mettreEnForme(lu, { fournisseurs, categories, categorieDefautId }) {
  const avertissements = [];
  const posteParNom = new Map(categories.map((c) => [normaliser(c.nom), c.id]));
  const defaut = categorieDefautId || categories[0]?.id || "";

  let lignes = (Array.isArray(lu.lignes) ? lu.lignes : [])
    .map((l) => ({
      categorieDepenseId: posteParNom.get(normaliser(l.poste)) || defaut,
      description: String(l.description || "").trim().slice(0, 200),
      montant: arrondi(l.montant),
    }))
    .filter((l) => l.montant !== 0);

  const sousTotal = arrondi(lu.sousTotal);
  const tps = arrondi(lu.tps);
  const tvq = arrondi(lu.tvq);
  const total = arrondi(lu.total);
  const sommeLignes = arrondi(lignes.reduce((s, l) => s + l.montant, 0));
  const reference = sousTotal || arrondi(total - tps - tvq);

  // Une dépense n'accepte que des lignes positives : un rabais est retiré de
  // la ligne du même poste (ou de la plus grosse)
  for (const rabais of lignes.filter((l) => l.montant < 0)) {
    const cible = lignes.filter((l) => l.montant > 0).sort((a, b) => (b.categorieDepenseId === rabais.categorieDepenseId) - (a.categorieDepenseId === rabais.categorieDepenseId) || b.montant - a.montant)[0];
    if (cible) cible.montant = arrondi(cible.montant + rabais.montant);
  }
  lignes = lignes.filter((l) => l.montant > 0);

  if (reference > 0 && (lignes.length === 0 || Math.abs(sommeLignes - reference) > 0.02)) {
    // Le détail ne balance pas avec le sous-total : une seule ligne, sûre
    if (lignes.length > 0) avertissements.push(`Le détail des lignes (${sommeLignes.toFixed(2)} $) ne correspond pas au sous-total (${reference.toFixed(2)} $) : une seule ligne a été mise. Répartis-la au besoin.`);
    lignes = [{ categorieDepenseId: lignes[0]?.categorieDepenseId || defaut, description: "", montant: reference }];
  }
  if (lignes.length === 0) avertissements.push("Aucun montant n'a pu être lu : entre les lignes à la main.");
  const calcule = arrondi(lignes.reduce((s, l) => s + l.montant, 0) + tps + tvq);
  if (total > 0 && Math.abs(calcule - total) > 0.02) {
    avertissements.push(`Le total lu sur la facture est ${total.toFixed(2)} $, mais les lignes et les taxes donnent ${calcule.toFixed(2)} $. Vérifie les montants.`);
  }

  const fournisseurLu = String(lu.fournisseur || "").trim().slice(0, 120);
  const fournisseur = trouverFournisseur(fournisseurLu, fournisseurs);
  if (!fournisseur) {
    avertissements.push(fournisseurLu
      ? `Fournisseur « ${fournisseurLu} » introuvable dans ta liste : choisis-le, ou ajoute-le d'abord (« Gérer les fournisseurs »).`
      : "Le nom du fournisseur n'a pas pu être lu : choisis-le dans la liste.");
  }
  const dateFacture = dateValide(lu.dateFacture);
  if (!dateFacture) avertissements.push("La date de la facture n'a pas pu être lue : vérifie-la.");
  const numero = String(lu.numeroFacture || "").trim().slice(0, 60);

  return {
    fournisseurId: fournisseur?.id || null,
    fournisseurLu,
    description: numero ? `Facture #${numero.replace(/^#/, "")}` : "",
    dateFacture,
    dateEcheance: dateValide(lu.dateEcheance),
    lignes: lignes.map((l) => ({ ...l, montant: l.montant.toFixed(2) })),
    tpsPayee: tps ? tps.toFixed(2) : "",
    tvqPayee: tvq ? tvq.toFixed(2) : "",
    avertissements,
  };
}

module.exports = { lectureFactureConfiguree, lireFacture, mettreEnForme, trouverFournisseur };
