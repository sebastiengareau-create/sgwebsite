"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScannerCodeBarres from "../components/ScannerCodeBarres";
import { BoutonContour } from "../components/StyleSection";
import { lireScanElevage } from "@/lib/elevageCalculs";
import { Erreur } from "./ui";

// Bouton « Scanner » de l'élevage : l'étiquette d'un paquet ouvre sa vente
// (Élevage → Viande), celle d'une bête ouvre sa fiche ; un numéro (BT-014)
// ou une boucle tapés à la main retrouvent la bête.
export default function ScanElevage({ libelle = "Scanner une étiquette" }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");

  async function detecte(texte) {
    setOuvert(false);
    setErreur("");
    const scan = lireScanElevage(texte);
    if (scan.type === "lot") return router.push(`/elevage/viande?lot=${scan.id}`);
    if (scan.type === "bete") return router.push(`/elevage/${scan.id}`);
    const res = await fetch(`/api/elevage/scan?code=${encodeURIComponent(scan.code)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErreur(data.erreur || "Code inconnu.");
    router.push(`/elevage/${data.beteId}`);
  }

  return (
    <>
      <BoutonContour icone="camera" onClick={() => setOuvert(true)}>{libelle}</BoutonContour>
      {erreur && <div style={{ flexBasis: "100%" }}><Erreur texte={erreur} /></div>}
      {ouvert && <ScannerCodeBarres titre="Scanner une étiquette de l'élevage" onDetecte={detecte} onFermer={() => setOuvert(false)} />}
    </>
  );
}
