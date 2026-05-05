import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Loader2,
  Flame,
  MapPin,
  Clock,
  Wallet,
  Check,
  FileBarChart,
} from "lucide-react";
import { commandesService } from "@/services/commandesService";
import {
  commissionsService,
  type CommissionLivreur,
} from "@/services/commissionsService";
import { livreursService } from "@/services/livreursService";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import type { Commande, StatutCommande } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { formatDistanceToNow, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/format";

type Periode = "jour" | "semaine" | "mois";

function debutPeriode(p: Periode): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "semaine") d.setDate(d.getDate() - 7);
  if (p === "mois") d.setDate(d.getDate() - 30);
  return d;
}

const STATUT_LABEL: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  livree: "Livrée",
  annulee: "Annulée",
};

const STATUT_VARIANT: Record<
  StatutCommande,
  "default" | "secondary" | "destructive" | "outline"
> = {
  en_attente: "secondary",
  acceptee: "outline",
  livree: "default",
  annulee: "destructive",
};

const STATUT_DOT: Record<StatutCommande, string> = {
  en_attente: "bg-warning",
  acceptee: "bg-info",
  livree: "bg-success",
  annulee: "bg-destructive",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--secondary))",
  "hsl(var(--muted-foreground))",
];

const ANNULATION_COLORS = [
  "hsl(var(--destructive))",
  "hsl(var(--warning))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--secondary))",
  "hsl(var(--muted-foreground))",
];

export default function Dashboard() {
  const [periode, setPeriode] = useState<Periode>("jour");
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<CommissionLivreur[]>([]);
  const [payeEnCours, setPayeEnCours] = useState<Record<string, boolean>>({});

  const charger = async () => {
    try {
      const all = await commandesService.lister();
      setCommandes(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const chargerCommissions = async () => {
    try {
      const items = await commissionsService.calculerJour();
      setCommissions(items);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    charger();
    chargerCommissions();
    const off1 = commandesService.ecouterChangements(() => {
      charger();
      chargerCommissions();
    });
    const id = setInterval(() => {
      charger();
      chargerCommissions();
    }, 15000);

    const channelLivraisons = supabase
      .channel("dashboard-livraisons")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        async (payload) => {
          const oldStatut = (payload.old as { statut?: StatutCommande } | null)?.statut;
          const newRow = payload.new as {
            id: string;
            statut: StatutCommande;
            livreur_id: string | null;
          };
          if (newRow?.statut !== "livree" || oldStatut === "livree") return;

          let nomLivreur = "un livreur";
          if (newRow.livreur_id) {
            try {
              const livreurs = await livreursService.lister();
              const l = livreurs.find((x) => x.id === newRow.livreur_id);
              if (l?.nom) nomLivreur = l.nom;
            } catch {
              /* ignore */
            }
          }
          const shortId = newRow.id.slice(0, 8).toUpperCase();
          sonnerToast.success(
            `Commande #${shortId} livrée par ${nomLivreur}`,
            {
              duration: 5000,
              style: {
                background: "hsl(var(--success))",
                color: "hsl(var(--success-foreground))",
                border: "1px solid hsl(var(--success))",
              },
            },
          );
        },
      )
      .subscribe();

    return () => {
      off1();
      clearInterval(id);
      supabase.removeChannel(channelLivraisons);
    };
  }, []);

  const handlePayer = async (item: CommissionLivreur) => {
    if (item.payee || payeEnCours[item.livreur_id]) return;
    setCommissions((prev) =>
      prev.map((c) =>
        c.livreur_id === item.livreur_id ? { ...c, payee: true } : c,
      ),
    );
    setPayeEnCours((p) => ({ ...p, [item.livreur_id]: true }));
    try {
      await commissionsService.marquerPayee({
        livreur_id: item.livreur_id,
        date_activite: new Date().toISOString().slice(0, 10),
        nb_courses: item.nb_courses,
        montant_commission: item.commission,
        commission_id: item.commission_id,
      });
    } catch (e) {
      console.error(e);
      setCommissions((prev) =>
        prev.map((c) =>
          c.livreur_id === item.livreur_id ? { ...c, payee: false } : c,
        ),
      );
      toast({
        title: "Paiement non enregistré",
        description: "Une erreur est survenue. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setPayeEnCours((p) => {
        const n = { ...p };
        delete n[item.livreur_id];
        return n;
      });
    }
  };

  const filtres = useMemo(() => {
    const debut = debutPeriode(periode);
    return commandes.filter((c) => new Date(c.created_at) >= debut);
  }, [commandes, periode]);

  const stats = useMemo(() => {
    const aujourd = new Date();
    const cmdJour = commandes.filter((c) =>
      isSameDay(new Date(c.created_at), aujourd),
    );
    return {
      commandesJour: cmdJour.length,
      enCours: filtres.filter(
        (c) => c.statut === "en_attente" || c.statut === "acceptee",
      ).length,
      livrees: filtres.filter((c) => c.statut === "livree").length,
      annulees: filtres.filter((c) => c.statut === "annulee").length,
      tempsMoyen: (() => {
        const livrees = filtres.filter((c) => c.statut === "livree" && c.duree_livraison);
        if (livrees.length === 0) return 0;
        return Math.round(livrees.reduce((s, c) => s + (c.duree_livraison || 0), 0) / livrees.length);
      })(),
    };
  }, [commandes, filtres]);

  const repartitionZones = useMemo(() => {
    const map = new Map<string, number>();
    filtres.forEach((c) => {
      const z = (c.zone || "Autre").trim() || "Autre";
      map.set(z, (map.get(z) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtres]);

  const tempsParZone = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    filtres
      .filter((c) => c.statut === "livree" && c.duree_livraison)
      .forEach((c) => {
        const z = (c.zone || "Autre").trim() || "Autre";
        const entry = map.get(z) || { total: 0, count: 0 };
        entry.total += c.duree_livraison || 0;
        entry.count += 1;
        map.set(z, entry);
      });
    return map;
  }, [filtres]);

  const repartitionMotifs = useMemo(() => {
    const map = new Map<string, number>();
    filtres
      .filter((c) => c.statut === "annulee" && c.motif_annulation)
      .forEach((c) => {
        const m = c.motif_annulation || "Autre";
        map.set(m, (map.get(m) ?? 0) + 1);
      });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtres]);

  const totalZones = repartitionZones.reduce((s, z) => s + z.value, 0);
  const totalMotifs = repartitionMotifs.reduce((s, m) => s + m.value, 0);
  const recentes = useMemo(() => commandes.slice(0, 8), [commandes]);

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-elegant">
              <Flame className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-xl font-bold leading-none">
                Jengu-Tech
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Tableau de bord
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Tabs value={periode} onValueChange={(v) => setPeriode(v as Periode)}>
              <TabsList>
                <TabsTrigger value="jour">Jour</TabsTrigger>
                <TabsTrigger value="semaine">7 jours</TabsTrigger>
                <TabsTrigger value="mois">30 jours</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/rapport">
                <FileBarChart className="h-4 w-4" />
                Voir le rapport
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* 5 KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KPI
            icon={ShoppingBag}
            label="Commandes du jour"
            value={stats.commandesJour}
            tone="primary"
          />
          <KPI
            icon={Loader2}
            label="Commandes en cours"
            value={stats.enCours}
            tone="info"
            hint={periode === "jour" ? "Aujourd'hui" : periode === "semaine" ? "7 derniers jours" : "30 derniers jours"}
          />
          <KPI
            icon={CheckCircle2}
            label="Commandes livrées"
            value={stats.livrees}
            tone="success"
            hint={periode === "jour" ? "Aujourd'hui" : periode === "semaine" ? "7 derniers jours" : "30 derniers jours"}
          />
          <KPI
            icon={XCircle}
            label="Commandes annulées"
            value={stats.annulees}
            tone="accent"
            hint={periode === "jour" ? "Aujourd'hui" : periode === "semaine" ? "7 derniers jours" : "30 derniers jours"}
          />
          <KPI
            icon={Clock}
            label="Temps moyen"
            value={`${stats.tempsMoyen} min`}
            tone="info"
            hint={periode === "jour" ? "Aujourd'hui" : periode === "semaine" ? "7 derniers jours" : "30 derniers jours"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Camembert zones */}
          <Card className="lg:col-span-2 p-6 shadow-card border-border">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-5 w-5 text-accent" />
              <h2 className="font-display font-semibold text-lg">
                Répartition par zone
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Toutes commandes · {totalZones} au total
            </p>

            {repartitionZones.length === 0 ? (
              <div className="text-sm text-muted-foreground py-16 text-center">
                Aucune commande sur la période
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={repartitionZones}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {repartitionZones.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => {
                      const tempsZone = tempsParZone.get(name);
                      const tempsMoyen = tempsZone ? Math.round(tempsZone.total / tempsZone.count) : null;
                      return [
                        `${value} commande${value > 1 ? "s" : ""}${tempsMoyen ? ` (${tempsMoyen} min en moy.)` : ""}`,
                        name,
                      ];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(v) => (
                      <span className="text-xs text-foreground">{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Tableau commandes récentes */}
          <Card className="lg:col-span-3 p-6 shadow-card border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" />
                <h2 className="font-display font-semibold text-lg">
                  Commandes récentes
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {recentes.length} affichées
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">
                      Client
                    </th>
                    <th className="text-left font-medium px-4 py-2.5">
                      Équipe
                    </th>
                    <th className="text-left font-medium px-4 py-2.5">
                      Statut
                    </th>
                    <th className="text-right font-medium px-4 py-2.5">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Chargement…
                      </td>
                    </tr>
                  ) : recentes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        Aucune commande
                      </td>
                    </tr>
                  ) : (
                    recentes.map((c, i) => (
                      <tr
                        key={c.id}
                        className={
                          i % 2 === 0
                            ? "bg-card hover:bg-muted/40 transition-smooth"
                            : "bg-muted/30 hover:bg-muted/50 transition-smooth"
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-[180px]">
                            {c.client_nom}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), {
                              locale: fr,
                              addSuffix: true,
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.equipe}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={STATUT_VARIANT[c.statut]}
                            className="gap-1.5 font-medium"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${STATUT_DOT[c.statut]}`}
                            />
                            {STATUT_LABEL[c.statut]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          {formatFCFA(Number(c.montant_repas))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Camembert motifs d'annulation */}
        {stats.annulees > 0 ? (
          repartitionMotifs.length > 0 ? (
            <Card className="p-6 shadow-card border-border">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-5 w-5 text-destructive" />
                <h2 className="font-display font-semibold text-lg">
                  Motifs d'annulation
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {totalMotifs} commande{totalMotifs > 1 ? "s" : ""} annulée{totalMotifs > 1 ? "s" : ""}
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={repartitionMotifs}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {repartitionMotifs.map((_, i) => (
                      <Cell key={i} fill={ANNULATION_COLORS[i % ANNULATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} commande${value > 1 ? "s" : ""}`,
                      name,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(v) => (
                      <span className="text-xs text-foreground">{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <Card className="p-6 shadow-card border-border text-center text-muted-foreground text-sm">
              <XCircle className="h-5 w-5 text-destructive mx-auto mb-2" />
              Aucun motif d'annulation renseigné
            </Card>
          )
        ) : null}

        {/* Gestion des commissions du jour */}
        <Card className="p-6 shadow-card border-border">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">
                Gestion des commissions
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Aujourd'hui · {commissions.length} livreur
              {commissions.length > 1 ? "s" : ""}
            </span>
          </div>

          {commissions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              Aucune course livrée aujourd'hui
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Livreur</th>
                    <th className="text-right font-medium px-4 py-2.5">Courses</th>
                    <th className="text-right font-medium px-4 py-2.5">Commission</th>
                    <th className="text-right font-medium px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c, i) => (
                    <tr
                      key={c.livreur_id}
                      className={
                        i % 2 === 0
                          ? "bg-card hover:bg-muted/40 transition-smooth"
                          : "bg-muted/30 hover:bg-muted/50 transition-smooth"
                      }
                    >
                      <td className="px-4 py-3 font-medium">{c.livreur_nom}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {c.nb_courses}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {formatFCFA(c.commission)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.payee ? (
                          <Button
                            size="sm"
                            disabled
                            className="bg-success text-success-foreground hover:bg-success/90 disabled:opacity-100 gap-1.5"
                          >
                            <Check className="h-4 w-4" />
                            Payé
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handlePayer(c)}
                            disabled={!!payeEnCours[c.livreur_id]}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            Payer
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

type Tone = "primary" | "accent" | "success" | "info";

const TONE_STYLES: Record<Tone, { bg: string; icon: string; ring: string }> = {
  primary: {
    bg: "bg-primary/10",
    icon: "text-primary",
    ring: "ring-primary/20",
  },
  accent: {
    bg: "bg-accent/10",
    icon: "text-accent",
    ring: "ring-accent/20",
  },
  success: {
    bg: "bg-success/10",
    icon: "text-success",
    ring: "ring-success/20",
  },
  info: {
    bg: "bg-info/10",
    icon: "text-info",
    ring: "ring-info/20",
  },
};

function KPI({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone: Tone;
  hint?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Card className="p-5 shadow-card border-border hover:shadow-elegant transition-smooth">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </div>
          <div className="font-display text-3xl font-bold mt-2 tabular-nums">
            {value}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground mt-1">{hint}</div>
          )}
        </div>
        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center ring-4 ${t.bg} ${t.ring}`}
        >
          <Icon className={`h-5 w-5 ${t.icon}`} />
        </div>
      </div>
    </Card>
  );
}