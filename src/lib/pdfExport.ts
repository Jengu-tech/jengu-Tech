import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Commande, StatutCommande } from "@/lib/types";
import { formatFCFA, maskTelephone } from "@/lib/format";

// Palette ROUGE / BLANC uniquement (aucun vert)
const COLOR_PRIMARY: [number, number, number] = [204, 0, 0]; // #CC0000 — rouge Eguette
const COLOR_PRIMARY_DARK: [number, number, number] = [153, 0, 0]; // #990000
const COLOR_DARK: [number, number, number] = [33, 33, 33]; // gris très foncé pour texte
const COLOR_MUTED: [number, number, number] = [120, 120, 120];
const COLOR_LIGHT: [number, number, number] = [250, 235, 235]; // rose très clair pour zébrures

const STATUT_LABEL: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptee",
  livree: "Livree",
  annulee: "Annulee",
};

export interface ExportCommandesOptions {
  /** Sous-titre affiché sous la date (ex : "Toutes les commandes", "Filtre : Livrées"). */
  sousTitre?: string;
  /** Date / période affichée à droite du bandeau. Par défaut : date du jour. */
  dateLabel?: string;
  /** Nom du fichier (sans extension). */
  filename?: string;
}

/**
 * Génère un PDF "Eguette" professionnel rouge/blanc à partir d'une liste de
 * commandes. Utilisé par la page Commandes ET la page Import/Export pour
 * garantir un rendu cohérent.
 */
export function exporterCommandesPDF(
  commandes: Commande[],
  options: ExportCommandesOptions = {},
): void {
  const doc = new jsPDF();
  const dateLabel =
    options.dateLabel ??
    new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  drawHeader(doc, dateLabel, options.sousTitre);

  // ===== Synthèse =====
  const livrees = commandes.filter((c) => c.statut === "livree");
  const annulees = commandes.filter((c) => c.statut === "annulee");
  const enCours = commandes.filter(
    (c) => c.statut === "en_attente" || c.statut === "acceptee",
  );
  const totalRevenu = livrees.reduce(
    (s, c) => s + Number(c.montant_repas ?? 0),
    0,
  );
  const totalGlobal = commandes.reduce(
    (s, c) => s + Number(c.montant_repas ?? 0),
    0,
  );

  sectionTitle(doc, 44, "Synthese");
  autoTable(doc, {
    startY: 48,
    head: [["Indicateur", "Valeur"]],
    body: [
      ["Total commandes", String(commandes.length)],
      ["Commandes livrees", String(livrees.length)],
      ["En cours (attente / acceptees)", String(enCours.length)],
      ["Commandes annulees", String(annulees.length)],
      ["Revenu total (livre)", formatFCFA(totalRevenu)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
      lineColor: COLOR_PRIMARY,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: COLOR_DARK,
      lineColor: COLOR_PRIMARY,
    },
    alternateRowStyles: { fillColor: COLOR_LIGHT },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // ===== Tableau des commandes =====
  const yC =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 12;
  sectionTitle(doc, yC, "Commandes");
  autoTable(doc, {
    startY: yC + 4,
    head: [["Client", "Telephone", "Zone", "Equipe", "Statut", "Montant"]],
    body: commandes.map((c) => [
      c.client_nom,
      // PROTECTION PII : on ne sort jamais le numéro complet dans un export
      maskTelephone(c.client_telephone),
      c.zone ?? "-",
      c.equipe,
      STATUT_LABEL[c.statut] ?? c.statut,
      formatFCFA(Number(c.montant_repas)),
    ]),
    foot: [
      [
        {
          content: "Total",
          colSpan: 5,
          styles: { halign: "right", fontStyle: "bold" },
        },
        {
          content: formatFCFA(totalGlobal),
          styles: { halign: "right", fontStyle: "bold" },
        },
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
      lineColor: COLOR_PRIMARY,
    },
    footStyles: {
      fillColor: COLOR_LIGHT,
      textColor: COLOR_PRIMARY_DARK,
      lineColor: COLOR_PRIMARY,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLOR_DARK,
      lineColor: COLOR_PRIMARY,
    },
    alternateRowStyles: { fillColor: COLOR_LIGHT },
    columnStyles: {
      5: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);

  const filename = options.filename ?? `eguette-commandes-${todayIso()}`;
  doc.save(`${filename}.pdf`);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function drawHeader(doc: jsPDF, dateLabel: string, sousTitre?: string) {
  const pageW = doc.internal.pageSize.getWidth();

  // Bandeau supérieur ROUGE
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageW, 32, "F");

  // "Logo" Eguette : pastille blanche + initiale rouge
  doc.setFillColor(255, 255, 255);
  doc.circle(20, 16, 7, "F");
  doc.setTextColor(...COLOR_PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("E", 20, 19, { align: "center" });

  // Wordmark
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Eguette", 32, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sousTitre ?? "Plateforme de livraison", 32, 23);

  // Bloc date à droite
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Rapport commandes", pageW - 14, 13, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(dateLabel, pageW - 14, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Exporte le ${new Date().toLocaleString("fr-FR")}`,
    pageW - 14,
    26,
    { align: "right" },
  );
}

function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_PRIMARY);
    doc.setLineWidth(0.4);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text("Eguette - Document genere automatiquement", 14, pageH - 8);
    doc.setTextColor(...COLOR_PRIMARY_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${i} / ${total}`, pageW - 14, pageH - 8, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, y: number, label: string) {
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(14, y - 4, 3, 6, "F");
  doc.setTextColor(...COLOR_PRIMARY_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(label, 20, y);
}

// Exports utilitaires si d'autres modules en ont besoin
export const PDF_COLORS = {
  PRIMARY: COLOR_PRIMARY,
  PRIMARY_DARK: COLOR_PRIMARY_DARK,
  DARK: COLOR_DARK,
  MUTED: COLOR_MUTED,
  LIGHT: COLOR_LIGHT,
};
