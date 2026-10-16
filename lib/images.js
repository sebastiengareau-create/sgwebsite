// Côté navigateur seulement (FileReader, canvas).

// Réduit la taille de l'image avant l'envoi (les photos de téléphone peuvent
// faire 8-12 Mo, ce qui bloquait l'envoi silencieusement).
export function compresserImage(file, maxLargeur = 1280, qualite = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Image invalide."));
      img.onload = () => {
        const ratio = Math.min(1, maxLargeur / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", qualite));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
