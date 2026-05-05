import { supabase } from "@/lib/supabase";
import { livreursService } from "./livreursService";
import type { Commande, Livreur } from "@/lib/types";

export interface RapportFaille {
  id: string;
  sev: "red" | "amber" | "yellow";
  impact: "red" | "amber" | "yellow";
  impactLabel: string;
  title: string;
  meta: string;
  stats: { val: string; label: string; color: string }[];
  bars: { label: string; pct: number; color: string }[];
}

export interface RapportDecision {
  id: string;
  title: string;
  desc: string;
  tag: "urgent" | "facile" | "moyen" | "impact";
  tagLabel: string;
}

export interface RapportData {
  weekLabel: string;
  score: number;
  scorePrev: number;
  scoreColor: string;
  annulation: number;
  annulationPrev: number;
  revenuPerdu: number;
  revenuPerduPrev: number;
  tempsMoy: number;
  tempsMoyPrev: number;
  totalCommandes: number;
  failles: RapportFaille[];
  decisions: RapportDecision[];
}

const COLORS = {
  red: "#EF4444",
  amber: "#F59E0B",
  yellow: "#EAB308",
  green: "#10B981",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  gray: "#5A6480",
};

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = dim
  const diff = (day + 6) % 7; // lundi = 0
  date.setDate(date.getDate() - diff);
  return date;
}

function fmtDateRange(start: Date): string {
  return `Semaine du ${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

async function fetchCommandes(start: Date, end: Date): Promise<Commande[]> {
  const { data, error } = await supabase
    .from("commandes")
    .select("*")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      client_nom: row.client_nom as string,
      client_telephone: row.client_telephone as string,
      client_adresse: (row.adresse_livraison as string) ?? "",
      zone: (row.zone as string | null) ?? null,
      plats: (row.plats as string) ?? "",
      montant_repas: Number(row.montant_repas ?? 0),
      frais_livraison: Number(row.frais_livraison ?? 0),
      statut: row.statut as Commande["statut"],
      equipe: ((row.equipe as string) ?? "Matin") as "Matin" | "Soir",
      livreur_id: (row.livreur_id as string | null) ?? null,
      livree_at: (row.livree_at as string | null) ?? null,
      annulee_at: (row.annulee_at as string | null) ?? null,
      duree_livraison: (row.duree_livraison as number | null) ?? null,
      motif_annulation: (row.motif_annulation as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

function computeMetrics(commandes: Commande[]) {
  const total = commandes.length;
  const annulees = commandes.filter((c) => c.statut === "annulee");
  const livrees = commandes.filter((c) => c.statut === "livree");
  const tauxAnnulation = total > 0 ? Math.round((annulees.length / total) * 100) : 0;
  const revenuPerdu = annulees.reduce((s, c) => s + Number(c.montant_repas ?? 0), 0);

  // Temps moyen de livraison (minutes) basé sur duree_livraison ou (livree_at - created_at)
  const durees: number[] = [];
  livrees.forEach((c) => {
    if (c.duree_livraison && c.duree_livraison > 0) durees.push(c.duree_livraison);
    else if (c.livree_at) {
      const ms = new Date(c.livree_at).getTime() - new Date(c.created_at).getTime();
      const min = Math.round(ms / 60000);
      if (min > 0 && min < 240) durees.push(min);
    }
  });
  const tempsMoy = durees.length
    ? Math.round(durees.reduce((a, b) => a + b, 0) / durees.length)
    : 0;

  // Score santé : 100 - tauxAnnul*1.5 - max(0, tempsMoy-30)*0.8
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - tauxAnnulation * 1.5 - Math.max(0, tempsMoy - 30) * 0.8)),
  );

  return { total, annulees, livrees, tauxAnnulation, revenuPerdu, tempsMoy, score };
}

function scoreColor(score: number): string {
  if (score >= 70) return COLORS.green;
  if (score >= 50) return COLORS.amber;
  return COLORS.red;
}

function buildFailles(
  commandes: Commande[],
  livreurs: Livreur[],
  metrics: ReturnType<typeof computeMetrics>,
): RapportFaille[] {
  const failles: RapportFaille[] = [];
  const annulees = metrics.annulees;

  // 1. Distribution horaire des annulations
  if (annulees.length > 0) {
    const buckets = { "10h–12h": 0, "12h–14h": 0, "14h–18h": 0, "18h–21h": 0, autre: 0 };
    annulees.forEach((c) => {
      const h = new Date(c.created_at).getHours();
      if (h >= 10 && h < 12) buckets["10h–12h"]++;
      else if (h >= 12 && h < 14) buckets["12h–14h"]++;
      else if (h >= 14 && h < 18) buckets["14h–18h"]++;
      else if (h >= 18 && h < 21) buckets["18h–21h"]++;
      else buckets.autre++;
    });
    const tot = annulees.length;
    const pcts = {
      "10h–12h": Math.round((buckets["10h–12h"] / tot) * 100),
      "12h–14h": Math.round((buckets["12h–14h"] / tot) * 100),
      "14h–18h": Math.round((buckets["14h–18h"] / tot) * 100),
      "18h–21h": Math.round((buckets["18h–21h"] / tot) * 100),
    };
    const peak = Object.entries(pcts).reduce((a, b) => (b[1] > a[1] ? b : a));
    if (peak[1] >= 30) {
      failles.push({
        id: "f-horaire",
        sev: peak[1] >= 50 ? "red" : "amber",
        impact: peak[1] >= 50 ? "red" : "amber",
        impactLabel: `${peak[1]}% sur ${peak[0]}`,
        title: `${peak[1]}% des annulations arrivent ${peak[0]}`,
        meta: `Pic non géré sur ce créneau — ${buckets[peak[0] as keyof typeof buckets]} annulation(s)`,
        stats: [
          { val: `${peak[1]}%`, label: "Annulations pic", color: COLORS.red },
          { val: String(annulees.length), label: "Total annulées", color: COLORS.red },
          { val: `${metrics.tempsMoy}min`, label: "Temps moyen", color: COLORS.amber },
        ],
        bars: [
          { label: "10h–12h", pct: pcts["10h–12h"], color: COLORS.green },
          { label: "12h–14h", pct: pcts["12h–14h"], color: pcts["12h–14h"] >= 50 ? COLORS.red : COLORS.amber },
          { label: "14h–18h", pct: pcts["14h–18h"], color: COLORS.amber },
          { label: "18h–21h", pct: pcts["18h–21h"], color: COLORS.blue },
        ],
      });
    }
  }

  // 2. Performance livreurs
  const livreurStats = new Map<string, { nom: string; durees: number[]; annul: number; total: number }>();
  livreurs.forEach((l) => livreurStats.set(l.id, { nom: l.nom, durees: [], annul: 0, total: 0 }));
  commandes.forEach((c) => {
    if (!c.livreur_id) return;
    const s = livreurStats.get(c.livreur_id);
    if (!s) return;
    s.total++;
    if (c.statut === "annulee") s.annul++;
    if (c.statut === "livree" && c.duree_livraison) s.durees.push(c.duree_livraison);
    else if (c.statut === "livree" && c.livree_at) {
      const m = Math.round(
        (new Date(c.livree_at).getTime() - new Date(c.created_at).getTime()) / 60000,
      );
      if (m > 0 && m < 240) s.durees.push(m);
    }
  });
  const livreurArr = Array.from(livreurStats.values())
    .filter((s) => s.total >= 3)
    .map((s) => ({
      nom: s.nom,
      tempsMoy: s.durees.length ? Math.round(s.durees.reduce((a, b) => a + b, 0) / s.durees.length) : 0,
      annul: s.annul,
      total: s.total,
    }))
    .filter((s) => s.tempsMoy > 0)
    .sort((a, b) => a.tempsMoy - b.tempsMoy);
  if (livreurArr.length >= 2) {
    const meilleur = livreurArr[0];
    const pire = livreurArr[livreurArr.length - 1];
    if (pire.tempsMoy > meilleur.tempsMoy * 1.4) {
      failles.push({
        id: "f-livreur",
        sev: "red",
        impact: "red",
        impactLabel: "Critique",
        title: `${pire.nom} : ${(pire.tempsMoy / meilleur.tempsMoy).toFixed(1)}× plus lent que ${meilleur.nom}`,
        meta: `Temps moyen ${pire.tempsMoy} min vs ${meilleur.tempsMoy} min`,
        stats: [
          { val: `${pire.tempsMoy}min`, label: `Temps ${pire.nom}`, color: COLORS.red },
          { val: `${meilleur.tempsMoy}min`, label: `Temps ${meilleur.nom}`, color: COLORS.green },
          { val: String(pire.annul), label: "Annulations / sem", color: COLORS.red },
        ],
        bars: livreurArr.slice(0, 5).map((l, i) => ({
          label: l.nom,
          pct: l.tempsMoy,
          color: i === 0 ? COLORS.green : i === livreurArr.length - 1 ? COLORS.red : COLORS.amber,
        })),
      });
    }
  }

  // 3. Zones à risque
  const zoneStats = new Map<string, { total: number; annul: number; revenu: number }>();
  commandes.forEach((c) => {
    const z = c.zone || "Non précisée";
    const s = zoneStats.get(z) ?? { total: 0, annul: 0, revenu: 0 };
    s.total++;
    if (c.statut === "annulee") s.annul++;
    if (c.statut === "livree") s.revenu += Number(c.montant_repas ?? 0);
    zoneStats.set(z, s);
  });
  const zonesArr = Array.from(zoneStats.entries())
    .map(([nom, s]) => ({ nom, ...s, tauxAnnul: s.total > 0 ? Math.round((s.annul / s.total) * 100) : 0 }))
    .filter((z) => z.total >= 3);
  const totalRevenu = zonesArr.reduce((s, z) => s + z.revenu, 0);
  if (zonesArr.length >= 2) {
    const piresZones = [...zonesArr].sort((a, b) => b.tauxAnnul - a.tauxAnnul);
    const pireZ = piresZones[0];
    if (pireZ.tauxAnnul >= 25) {
      const partRevenu = totalRevenu > 0 ? Math.round((pireZ.revenu / totalRevenu) * 100) : 0;
      failles.push({
        id: "f-zone",
        sev: "amber",
        impact: "amber",
        impactLabel: "Moyen",
        title: `${pireZ.nom} : ${pireZ.tauxAnnul}% d'annulations pour ${partRevenu}% des revenus`,
        meta: "Zone à risque — ratio effort/revenu défavorable",
        stats: [
          { val: `${pireZ.tauxAnnul}%`, label: "Taux annulation", color: COLORS.amber },
          { val: `${partRevenu}%`, label: "Part des revenus", color: COLORS.blue },
          { val: String(pireZ.total), label: "Commandes", color: COLORS.amber },
        ],
        bars: zonesArr
          .sort((a, b) => b.tauxAnnul - a.tauxAnnul)
          .slice(0, 5)
          .map((z, i) => ({
            label: z.nom,
            pct: z.tauxAnnul,
            color: i === 0 ? COLORS.red : i === 1 ? COLORS.amber : COLORS.blue,
          })),
      });
    }
  }

  // 4. Clients à risque (clients avec >=2 annulations)
  const clientCount = new Map<string, { nom: string; annul: number }>();
  annulees.forEach((c) => {
    const key = c.client_telephone;
    const s = clientCount.get(key) ?? { nom: c.client_nom, annul: 0 };
    s.annul++;
    clientCount.set(key, s);
  });
  const clientsRisque = Array.from(clientCount.values()).filter((c) => c.annul >= 2);
  if (clientsRisque.length > 0) {
    failles.push({
      id: "f-client",
      sev: "yellow",
      impact: "yellow",
      impactLabel: "Info",
      title: `${clientsRisque.length} client(s) ont annulé 2× ou plus cette semaine`,
      meta: "Clients à risque de churn — intervention recommandée",
      stats: [
        { val: String(clientsRisque.length), label: "Clients à risque", color: COLORS.yellow },
        { val: String(clientsRisque.reduce((s, c) => s + c.annul, 0)), label: "Annul. total", color: COLORS.amber },
        { val: "0", label: "Rappels effectués", color: COLORS.red },
      ],
      bars: clientsRisque.slice(0, 5).map((c) => ({
        label: c.nom,
        pct: Math.min(100, c.annul * 25),
        color: COLORS.yellow,
      })),
    });
  }

  return failles;
}

function buildDecisions(failles: RapportFaille[]): RapportDecision[] {
  const map: Record<string, RapportDecision[]> = {
    "f-horaire": [
      {
        id: "d-horaire-1",
        title: "Renforcer l'équipe sur le créneau de pic",
        desc: "Ajouter un livreur supplémentaire sur le créneau identifié réduit les annulations par impatience de 30 à 40%.",
        tag: "impact",
        tagLabel: "Fort impact",
      },
      {
        id: "d-horaire-2",
        title: "Envoyer un SMS \"en route\" dès le départ du livreur",
        desc: "Un message de réassurance (\"Le livreur arrive dans ~30 min\") évite les annulations par stress.",
        tag: "facile",
        tagLabel: "Facile à faire",
      },
    ],
    "f-livreur": [
      {
        id: "d-livreur-1",
        title: "Réassigner les zones lointaines aux livreurs les plus rapides",
        desc: "Donner les zones difficiles aux livreurs performants règle automatiquement une grande partie des retards.",
        tag: "urgent",
        tagLabel: "Urgent",
      },
    ],
    "f-zone": [
      {
        id: "d-zone-1",
        title: "Limiter les commandes dans la zone à risque aux heures de pointe",
        desc: "Afficher \"zone temporairement indisponible\" pendant les pics évite les annulations prévisibles.",
        tag: "urgent",
        tagLabel: "Urgent",
      },
    ],
    "f-client": [
      {
        id: "d-client-1",
        title: "Rappeler les clients qui ont annulé 2× cette semaine",
        desc: "Un appel ou message WhatsApp pour comprendre leur problème. Coût : 5 minutes. Gain : leur fidélité.",
        tag: "facile",
        tagLabel: "5 minutes",
      },
    ],
  };
  const decisions: RapportDecision[] = [];
  failles.forEach((f) => {
    (map[f.id] ?? []).forEach((d) => decisions.push(d));
  });
  return decisions;
}

export const rapportService = {
  async charger(weekOffset = 0): Promise<RapportData> {
    const now = new Date();
    const startCurrent = startOfWeek(now);
    startCurrent.setDate(startCurrent.getDate() - weekOffset * 7);
    const endCurrent = new Date(startCurrent);
    endCurrent.setDate(endCurrent.getDate() + 7);

    const startPrev = new Date(startCurrent);
    startPrev.setDate(startPrev.getDate() - 7);

    const [cmdCurrent, cmdPrev, livreurs] = await Promise.all([
      fetchCommandes(startCurrent, endCurrent),
      fetchCommandes(startPrev, startCurrent),
      livreursService.lister(),
    ]);

    const cur = computeMetrics(cmdCurrent);
    const prev = computeMetrics(cmdPrev);

    const failles = buildFailles(cmdCurrent, livreurs, cur);
    const decisions = buildDecisions(failles);

    return {
      weekLabel: fmtDateRange(startCurrent),
      score: cur.score,
      scorePrev: prev.score,
      scoreColor: scoreColor(cur.score),
      annulation: cur.tauxAnnulation,
      annulationPrev: prev.tauxAnnulation,
      revenuPerdu: cur.revenuPerdu,
      revenuPerduPrev: prev.revenuPerdu,
      tempsMoy: cur.tempsMoy,
      tempsMoyPrev: prev.tempsMoy,
      totalCommandes: cur.total,
      failles,
      decisions,
    };
  },
};
