import { NextResponse } from "next/server";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { enregistrerEcriture } from "@/lib/comptabilite";

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  const { date, reference, description, lignes } = await request.json();

  if (!date) return NextResponse.json({ erreur: "Date requise." }, { status: 400 });
  if (!description || !description.trim()) return NextResponse.json({ erreur: "Description requise." }, { status: 400 });
  if (!Array.isArray(lignes) || lignes.length < 2) {
    return NextResponse.json({ erreur: "Au moins deux lignes sont requises (un débit et un crédit)." }, { status: 400 });
  }

  const lignesValidees = [];
  for (const l of lignes) {
    const debit = Number(l.debit) || 0;
    const credit = Number(l.credit) || 0;
    if (!l.compteNumero) return NextResponse.json({ erreur: "Chaque ligne doit avoir un compte." }, { status: 400 });
    if (debit > 0 && credit > 0) return NextResponse.json({ erreur: "Une ligne ne peut pas avoir un débit ET un crédit." }, { status: 400 });
    if (debit <= 0 && credit <= 0) return NextResponse.json({ erreur: "Chaque ligne doit avoir un débit ou un crédit supérieur à 0." }, { status: 400 });
    lignesValidees.push({ compteNumero: l.compteNumero, debit, credit, description: l.description || null });
  }

  const totalDebit = lignesValidees.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lignesValidees.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    return NextResponse.json({ erreur: `Écriture déséquilibrée : débit ${totalDebit.toFixed(2)} $ ≠ crédit ${totalCredit.toFixed(2)} $.` }, { status: 400 });
  }

  try {
    const ecriture = await enregistrerEcriture({
      date: new Date(date),
      description: description.trim(),
      reference: reference?.trim() || null,
      source: "MANUEL",
      lignes: lignesValidees,
      creePar: session.nom,
    });
    return NextResponse.json(ecriture);
  } catch (e) {
    if (e.message.startsWith("PERIODE_LOCK:")) {
      return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "").split("\n")[0] }, { status: 423 });
    }
    return NextResponse.json({ erreur: e.message }, { status: 400 });
  }
}
