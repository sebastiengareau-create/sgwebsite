// Fichiers joints par les clients sur le site de réservation (modèle
// FichierRendezVous) : préparation à la réception et effacement après
// 12 mois. Le site les transmet par /api/rendezvous/fichiers.
const { prisma } = require("./prisma");

const TAILLE_MAX_OCTETS = 15 * 1024 * 1024; // même limite que le site
const EXTENSIONS_PERMISES = ["pdf", "jpg", "jpeg", "png", "heic", "heif", "webp", "doc", "docx"];
const MOIS_CONSERVATION = 12;

// Photos réduites à la réception : largement assez pour voir une pièce ou
// un bris, et environ 10 fois plus légères qu'une photo de téléphone.
const COTE_MAX_PX = 1600;
const QUALITE_JPEG = 80;
const IMAGES_REDUCTIBLES = ["jpg", "jpeg", "png", "webp"];

const TYPES_MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  heic: "image/heic", heif: "image/heif", webp: "image/webp",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function extension(nom) {
  const m = /\.([a-z0-9]+)$/i.exec(nom || "");
  return m ? m[1].toLowerCase() : "";
}

// → { nom, typeMime, donnees } prêt à enregistrer, ou { erreur }. Une photo
// devient un JPEG réduit ; si la réduction échoue (image illisible), le
// fichier est gardé tel quel. HEIC (iPhone) reste tel quel : il ne peut pas
// être décodé ici.
async function preparerFichier(nomOriginal, tampon) {
  const nom = String(nomOriginal || "fichier").trim().slice(0, 200) || "fichier";
  const ext = extension(nom);
  if (!EXTENSIONS_PERMISES.includes(ext)) return { erreur: "Type de fichier non accepté." };
  if (tampon.length === 0) return { erreur: "Fichier vide." };
  if (tampon.length > TAILLE_MAX_OCTETS) return { erreur: "Fichier trop volumineux (15 Mo maximum)." };

  if (IMAGES_REDUCTIBLES.includes(ext)) {
    try {
      const sharp = require("sharp");
      const reduite = await sharp(tampon)
        .rotate() // redresse selon l'orientation EXIF du téléphone
        .resize({ width: COTE_MAX_PX, height: COTE_MAX_PX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: QUALITE_JPEG, mozjpeg: true })
        .toBuffer();
      if (reduite.length < tampon.length) {
        return { nom: nom.replace(/\.[a-z0-9]+$/i, ".jpg"), typeMime: "image/jpeg", donnees: reduite };
      }
    } catch {
      // image illisible : gardée telle quelle
    }
  }
  return { nom, typeMime: TYPES_MIME[ext], donnees: tampon };
}

// Efface les fichiers des rendez-vous d'il y a plus de 12 mois. Appelé par
// le planificateur (lib/planificateurSauvegarde.js), une fois par heure.
async function effacerFichiersExpires() {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MOIS_CONSERVATION);
  const { count } = await prisma.fichierRendezVous.deleteMany({ where: { rendezVous: { date: { lt: limite } } } });
  return count;
}

module.exports = { preparerFichier, effacerFichiersExpires, MOIS_CONSERVATION };
