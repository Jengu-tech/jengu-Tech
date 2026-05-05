import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RapportData } from "@/services/rapportService";
import { formatFCFA } from "@/lib/format";

// Palette sombre du rapport (reproduction du HTML d'origine)
const BG: [number, number, number] = [8, 11, 20]; // #080B14
const BG2: [number, number, number] = [14, 19, 32]; // #0E1320
const BG3: [number, number, number] = [20, 24, 36]; // #141824
const TEXT: [number, number, number] = [232, 234, 242];
const TEXT2: [number, number, number] = [136, 146, 164];
const TEXT3: [number, number, number] = [120, 130, 150];
const ORANGE: [number, number, number] = [255, 90, 31];
const RED: [number, number, number] = [239, 68, 68];
const AMBER: [number, number, number] = [245, 158, 11];
const GREEN: [number, number, number] = [16, 185, 129];
const BLUE: [number, number, number] = [59, 130, 246];

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

export function exporterRapportPDF(d: RapportData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Fond sombre première page
  doc.setFillColor(...BG);
  doc.rect(0, 0, pageW, pageH, "F");

  // ===== HEADER =====
  doc.setFillColor(...BG2);
  doc.rect(0, 0, pageW, 22, "F");

  // Logo orange
  doc.setFillColor(...ORANGE);
  doc.roundedRect(12, 5, 12, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("E", 18, 13, { align: "center" });

  doc.setTextColor(...TEXT);
  doc.setFontSize(14);
  doc.text("Eguette", 28, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT2);
  doc.text("Diagnostic & Décisions", 28, 16);

  // Date à droite
  doc.setTextColor(...TEXT2);
  doc.setFontSize(9);
  doc.text(d.weekLabel, pageW - 12, 11, { align: "right" });
  doc.setFontSize(7);
  doc.setTextColor(...TEXT3);
  doc.text(`Exporté le ${new Date().toLocaleString("fr-FR")}`, pageW - 12, 16, {
    align: "right",
  });

  let y = 32;

  // ===== SCORE CARD =====
  doc.setFillColor(...BG3);
  doc.roundedRect(12, y, pageW - 24, 38, 4, 4, "F");

  // Cercle score (simulé)
  const cx = 28;
  const cy = y + 19;
  doc.setFillColor(...d.scoreColor ? hexToRgb(d.scoreColor) : ORANGE);
  doc.circle(cx, cy, 12, "F");
  doc.setFillColor(...BG3);
  doc.circle(cx, cy, 9.5, "F");
  doc.setTextColor(...hexToRgb(d.scoreColor));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(d.score), cx, cy + 1, { align: "center" });
  doc.setFontSize(6);
  doc.setTextColor(...TEXT3);
  doc.text("SCORE", cx, cy + 5, { align: "center" });

  // Titre + KPI
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Bilan de la semaine", 48, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT2);
  doc.text(d.weekLabel, 48, y + 14);

  // KPIs ligne
  const kpis: { val: string; label: string; color: [number, number, number] }[] = [
    {
      val: `${d.annulation}%`,
      label: "Taux annulation",
      color: d.annulation - d.annulationPrev <= 0 ? GREEN : RED,
    },
    {
      val: `${Math.round(d.revenuPerdu / 1000)}k FCFA`,
      label: "Revenu perdu",
      color: RED,
    },
    {
      val: `${d.tempsMoy} min`,
      label: "Temps moyen",
      color: d.tempsMoy - d.tempsMoyPrev <= 0 ? GREEN : AMBER,
    },
    { val: String(d.totalCommandes), label: "Commandes", color: BLUE },
  ];
  kpis.forEach((k, i) => {
    const xk = 48 + i * 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...k.color);
    doc.text(k.val, xk, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT2);
    doc.text(k.label, xk, y + 28);
  });

  // Score diff
  const diff = d.score - d.scorePrev;
  doc.setTextColor(...TEXT3);
  doc.setFontSize(7);
  doc.text("vs sem. dernière", pageW - 16, y + 14, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...(diff >= 0 ? GREEN : RED));
  doc.text(`${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)} pts`, pageW - 16, y + 20, {
    align: "right",
  });

  y += 46;

  // ===== FAILLES =====
  sectionTitle(doc, y, "FAILLES DÉTECTÉES", `${d.failles.length} problème(s) identifié(s)`);
  y += 8;

  if (d.failles.length === 0) {
    emptyState(doc, y, "Aucune faille critique détectée");
    y += 18;
  } else {
    d.failles.forEach((f) => {
      y = ensureSpace(doc, y, 30);
      // Card faille
      doc.setFillColor(...BG3);
      doc.roundedRect(12, y, pageW - 24, 22, 3, 3, "F");
      // Bullet sévérité
      const sevColor = f.sev === "red" ? RED : f.sev === "amber" ? AMBER : [234, 179, 8] as [number, number, number];
      doc.setFillColor(...sevColor);
      doc.circle(18, y + 7, 1.6, "F");
      // Titre
      doc.setTextColor(...TEXT);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const titreLines = doc.splitTextToSize(f.title, pageW - 70);
      doc.text(titreLines, 23, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT2);
      doc.text(f.meta, 23, y + 12);
      // Badge impact (à droite)
      doc.setFillColor(...sevColor);
      const bw = doc.getTextWidth(f.impactLabel) + 6;
      doc.roundedRect(pageW - 14 - bw, y + 4, bw, 6, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(f.impactLabel, pageW - 14 - bw / 2, y + 8, { align: "center" });

      // Stats compactes
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const statsTxt = f.stats.map((s) => `${s.val} ${s.label}`).join("   •   ");
      doc.setTextColor(...TEXT2);
      doc.text(statsTxt, 23, y + 18);

      y += 26;
    });
  }

  // ===== DÉCISIONS =====
  y = ensureSpace(doc, y, 20);
  sectionTitle(doc, y, "DÉCISIONS RECOMMANDÉES", `${d.decisions.length} action(s)`);
  y += 8;

  if (d.decisions.length === 0) {
    emptyState(doc, y, "Aucune action urgente");
    y += 18;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["#", "Action", "Priorité"]],
      body: d.decisions.map((dec, i) => [
        String(i + 1),
        `${dec.title}\n${dec.desc}`,
        dec.tagLabel,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: ORANGE,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
        lineColor: ORANGE,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: TEXT,
        fillColor: BG3,
        lineColor: [40, 48, 70],
      },
      alternateRowStyles: { fillColor: BG2 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 28, halign: "center", fontStyle: "bold", textColor: ORANGE },
      },
      margin: { left: 12, right: 12 },
      didDrawPage: () => {
        // Fond sombre sur les pages générées par autoTable
        doc.setFillColor(...BG);
        doc.rect(0, 0, pageW, pageH, "F");
      },
    });
  }

  // Footer toutes pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(0.3);
    doc.line(12, pageH - 10, pageW - 12, pageH - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT3);
    doc.text("Eguette — Diagnostic généré automatiquement", 12, pageH - 5);
    doc.setTextColor(...ORANGE);
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${i} / ${total}`, pageW - 12, pageH - 5, { align: "right" });
  }

  doc.save(`eguette-rapport-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function sectionTitle(doc: jsPDF, y: number, label: string, count: string) {
  doc.setFillColor(...ORANGE);
  doc.rect(12, y - 3, 2, 4.5, "F");
  doc.setTextColor(...TEXT3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label, 16, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT2);
  doc.text(count, doc.internal.pageSize.getWidth() - 12, y, { align: "right" });
}

function emptyState(doc: jsPDF, y: number, msg: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BG3);
  doc.roundedRect(12, y, pageW - 24, 14, 3, 3, "F");
  doc.setTextColor(...TEXT2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(msg, pageW / 2, y + 8, { align: "center" });
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 14) {
    doc.addPage();
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BG);
    doc.rect(0, 0, pageW, pageH, "F");
    return 18;
  }
  return y;
}

// Garde l'usage du formatFCFA pour conformité (anti-tree-shake si besoin futur)
export const _fmt = formatFCFA;
