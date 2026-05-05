import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileDown, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { commandesService } from "@/services/commandesService";
import { livreursService } from "@/services/livreursService";
import { commissionsService } from "@/services/commissionsService";
import { toast } from "sonner";
import { formatFCFA, maskTelephone } from "@/lib/format";
import type { StatutCommande } from "@/lib/types";

const STATUT_LABEL: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptee",
  livree: "Livree",
  annulee: "Annulee",
};

// Palette ROUGE / BLANC uniquement (aucun vert)
const COLOR_PRIMARY: [number, number, number] = [204, 0, 0]; // #CC0000
const COLOR_PRIMARY_DARK: [number, number, number] = [153, 0, 0]; // #990000
const COLOR_DARK: [number, number, number] = [33, 33, 33];
const COLOR_MUTED: [number, number, number] = [120, 120, 120];
const COLOR_LIGHT: [number, number, number] = [250, 235, 235]; // rose très clair

export default function ImportExport() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Limites de validation pour les imports Excel (défense en profondeur côté client ;
  // les contraintes serveur restent indispensables — voir CHECK constraints Postgres).
  const MAX_ROWS = 500;
  const MAX_LEN_NAME = 255;
  const MAX_LEN_ADDRESS = 255;
  const MAX_LEN_PHONE = 20;
  const MAX_LEN_PLATS = 1000;
  const MAX_MONTANT = 10_000_000; // 10 M FCFA, garde-fou
  const PHONE_RE = /^[0-9+()\s.-]{6,20}$/;

  const cleanStr = (v: unknown, max: number) =>
    String(v ?? "").trim().slice(0, max);

  const handleImportCommandes = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (rows.length > MAX_ROWS) {
        toast.error(`Trop de lignes (${rows.length}). Maximum : ${MAX_ROWS}.`);
        return;
      }

      const restaurant_id = "00000000-0000-0000-0000-000000000001";
      const rejets: string[] = [];
      const commandes = rows
        .map((r, idx) => {
          const client_nom = cleanStr(r.nom ?? r.client_nom, MAX_LEN_NAME);
          const client_telephone = cleanStr(
            r.telephone ?? r.client_telephone,
            MAX_LEN_PHONE,
          );
          const client_adresse = cleanStr(
            r.adresse ?? r.client_adresse,
            MAX_LEN_ADDRESS,
          );
          const zone = r.zone ? cleanStr(r.zone, 100) : undefined;
          const plats = cleanStr(r.plats, MAX_LEN_PLATS);
          const montantRaw = Number(r.montant ?? r.montant_repas ?? 0);
          const montant_repas = Number.isFinite(montantRaw) ? montantRaw : NaN;

          if (!client_nom || !client_telephone) {
            rejets.push(`Ligne ${idx + 2}: nom ou téléphone manquant`);
            return null;
          }
          if (!PHONE_RE.test(client_telephone)) {
            rejets.push(`Ligne ${idx + 2}: téléphone invalide`);
            return null;
          }
          if (
            !Number.isFinite(montant_repas) ||
            montant_repas < 0 ||
            montant_repas > MAX_MONTANT
          ) {
            rejets.push(`Ligne ${idx + 2}: montant invalide`);
            return null;
          }
          return {
            client_nom,
            client_telephone,
            client_adresse,
            zone,
            plats,
            montant_repas,
            restaurant_id,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      if (commandes.length === 0) {
        toast.error("Aucune ligne valide à importer.");
        return;
      }
      const n = await commandesService.creerEnLot(commandes);
      if (rejets.length > 0) {
        toast.warning(`${n} importées · ${rejets.length} rejetées`);
      } else {
        toast.success(`${n} commandes importées`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'import");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleImportLivreurs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (rows.length > MAX_ROWS) {
        toast.error(`Trop de lignes (${rows.length}). Maximum : ${MAX_ROWS}.`);
        return;
      }

      const restaurant_id = "00000000-0000-0000-0000-000000000001";
      const rejets: string[] = [];
      const livreurs = rows
        .map((r, idx) => {
          const nom = cleanStr(r.nom ?? r.nom_complet, MAX_LEN_NAME);
          const telephone = cleanStr(r.telephone, MAX_LEN_PHONE);
          const equipe = (String(r.equipe ?? "Matin") === "Soir" ? "Soir" : "Matin") as
            | "Matin"
            | "Soir";

          if (!nom || !telephone) {
            rejets.push(`Ligne ${idx + 2}: nom ou téléphone manquant`);
            return null;
          }
          if (!PHONE_RE.test(telephone)) {
            rejets.push(`Ligne ${idx + 2}: téléphone invalide`);
            return null;
          }
          return { nom, telephone, equipe, restaurant_id };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);

      if (livreurs.length === 0) {
        toast.error("Aucune ligne valide à importer.");
        return;
      }
      const n = await livreursService.ajouterEnLot(livreurs);
      if (rejets.length > 0) {
        toast.warning(`${n} importés · ${rejets.length} rejetés`);
      } else {
        toast.success(`${n} livreurs importés`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'import");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const drawHeader = (doc: jsPDF, dateLabel: string) => {
    const pageW = doc.internal.pageSize.getWidth();

    // Bandeau supérieur vert
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(0, 0, pageW, 32, "F");

    // "Logo" Eguette : pastille blanche + initiale verte
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
    doc.text("Plateforme de livraison", 32, 23);

    // Bloc date a droite
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Rapport quotidien", pageW - 14, 13, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(dateLabel, pageW - 14, 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const exportLabel = `Exporte le ${new Date().toLocaleString("fr-FR")}`;
    doc.text(exportLabel, pageW - 14, 26, { align: "right" });
  };

  const drawFooter = (doc: jsPDF) => {
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
  };

  const sectionTitle = (doc: jsPDF, y: number, label: string) => {
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(14, y - 4, 3, 6, "F");
    doc.setTextColor(...COLOR_PRIMARY_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(label, 20, y);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const [commandes, livreurs, commissions] = await Promise.all([
        commandesService.lister({ date }),
        livreursService.lister(),
        commissionsService.calculerJour(date),
      ]);

      const doc = new jsPDF();
      const dateLabel = new Date(date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      drawHeader(doc, dateLabel);

      const livrees = commandes.filter((c) => c.statut === "livree");
      const annulees = commandes.filter((c) => c.statut === "annulee");
      const enCours = commandes.filter(
        (c) => c.statut === "en_attente" || c.statut === "acceptee",
      );
      const revenu = livrees.reduce((s, c) => s + Number(c.montant_repas), 0);
      const totalCom = commissionsService.totalCommission(commissions);

      // ======= SYNTHESE =======
      sectionTitle(doc, 44, "Synthese du jour");
      autoTable(doc, {
        startY: 48,
        head: [["Indicateur", "Valeur"]],
        body: [
          ["Total commandes", String(commandes.length)],
          ["Commandes livrees", String(livrees.length)],
          ["En cours (en attente / acceptees)", String(enCours.length)],
          ["Commandes annulees", String(annulees.length)],
          ["Revenu total (livre)", formatFCFA(revenu)],
          ["Commission Eguette", formatFCFA(totalCom)],
        ],
        theme: "grid",
        headStyles: {
          fillColor: COLOR_PRIMARY,
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
          lineColor: COLOR_PRIMARY,
        },
        bodyStyles: { fontSize: 10, textColor: COLOR_DARK, lineColor: COLOR_PRIMARY },
        alternateRowStyles: { fillColor: COLOR_LIGHT },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      // ======= COMMANDES =======
      let yC =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 12;
      sectionTitle(doc, yC, "Commandes");
      autoTable(doc, {
        startY: yC + 4,
        head: [["Client", "Telephone", "Zone", "Equipe", "Statut", "Montant"]],
        body: commandes.map((c) => [
          c.client_nom,
          // PROTECTION PII : numéro masqué dans tout export
          maskTelephone(c.client_telephone),
          c.zone ?? "-",
          c.equipe,
          STATUT_LABEL[c.statut] ?? c.statut,
          formatFCFA(Number(c.montant_repas)),
        ]),
        foot: [
          [
            { content: "Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
            {
              content: formatFCFA(
                commandes.reduce((s, c) => s + Number(c.montant_repas), 0),
              ),
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
        footStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_PRIMARY_DARK, lineColor: COLOR_PRIMARY },
        bodyStyles: { fontSize: 9, textColor: COLOR_DARK, lineColor: COLOR_PRIMARY },
        alternateRowStyles: { fillColor: COLOR_LIGHT },
        columnStyles: {
          5: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      // ======= LIVREURS & COMMISSIONS =======
      const yL =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 12;
      sectionTitle(doc, yL, "Livreurs & commissions");
      autoTable(doc, {
        startY: yL + 4,
        head: [["Livreur", "Equipe", "En service", "Courses", "Commission"]],
        body: livreurs.map((l) => {
          const c = commissions.find((x) => x.livreur_id === l.id);
          return [
            l.nom,
            l.equipe,
            l.en_service ? "Oui" : "Non",
            String(c?.nb_courses ?? 0),
            formatFCFA(c?.commission ?? 0),
          ];
        }),
        foot: [
          [
            { content: "Total commissions", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
            { content: formatFCFA(totalCom), styles: { halign: "right", fontStyle: "bold" } },
          ],
        ],
        theme: "striped",
        headStyles: {
          fillColor: COLOR_PRIMARY_DARK,
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
          lineColor: COLOR_PRIMARY,
        },
        footStyles: { fillColor: COLOR_LIGHT, textColor: COLOR_PRIMARY_DARK, lineColor: COLOR_PRIMARY },
        bodyStyles: { fontSize: 9, textColor: COLOR_DARK, lineColor: COLOR_PRIMARY },
        alternateRowStyles: { fillColor: COLOR_LIGHT },
        columnStyles: {
          3: { halign: "center" },
          4: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      drawFooter(doc);

      doc.save(`eguette-rapport-${date}.pdf`);
      toast.success("Rapport PDF genere");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground mt-1">Importez en masse, exportez vos rapports</p>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card className="p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Importer des commandes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Fichier Excel (.xlsx). Colonnes attendues : <code className="text-xs">nom, telephone, adresse, zone, plats, montant</code>
                </p>
                <Input type="file" accept=".xlsx,.xls" disabled={importing} onChange={handleImportCommandes} className="mt-3 max-w-md" />
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Importer des livreurs</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Fichier Excel (.xlsx). Colonnes : <code className="text-xs">nom, telephone, equipe</code> (Matin ou Soir)
                </p>
                <Input type="file" accept=".xlsx,.xls" disabled={importing} onChange={handleImportLivreurs} className="mt-3 max-w-md" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4 mt-4">
          <Card className="p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileDown className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Rapport PDF complet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Inclut les commandes, livreurs, commissions et revenus du jour sélectionné.
                </p>
                <div className="flex gap-3 items-end mt-4">
                  <div>
                    <Label>Date du rapport</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-52" />
                  </div>
                  <Button onClick={handleExportPDF} disabled={exporting}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {exporting ? "Génération…" : "Télécharger PDF"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
