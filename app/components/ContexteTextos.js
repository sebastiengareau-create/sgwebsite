"use client";

import { createContext, useContext } from "react";

// Textos automatiques (lib/textosAuto.js) : direct = les boutons « 💬 Texto »
// envoient depuis l'appli par Twilio, au lieu d'ouvrir l'appli Messages.
// Fourni par la mise en page (app/layout.js).
const Contexte = createContext({ direct: false });

export function FournisseurTextos({ direct, children }) {
  return <Contexte.Provider value={{ direct: !!direct }}>{children}</Contexte.Provider>;
}

export const useTextos = () => useContext(Contexte);
