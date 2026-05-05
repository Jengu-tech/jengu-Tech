import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rapportService, type RapportData, type RapportFaille } from "@/services/rapportService";
import { exporterRapportPDF } from "@/lib/rapportPdf";
import { toast } from "sonner";

export default function Rapport() {
  const navigate = useNavigate();
  const [data, setData] = useState<RapportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [openFailles, setOpenFailles] = useState<Set<string>>(new Set());
  const [appliedDecisions, setAppliedDecisions] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    rapportService
      .charger(weekOffset)
      .then((d) => setData(d))
      .catch((e) => toast.error(`Erreur chargement rapport : ${e.message}`))
      .finally(() => setLoading(false));
  }, [weekOffset]);

  const toggleFaille = (id: string) => {
    setOpenFailles((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleDecision = (id: string) => {
    setAppliedDecisions((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        toast.success("Décision enregistrée ✓");
      }
      return n;
    });
  };

  const handleExport = () => {
    if (!data) return;
    try {
      exporterRapportPDF(data);
      toast.success("Rapport PDF téléchargé");
    } catch (e) {
      toast.error(`Erreur export : ${(e as Error).message}`);
    }
  };

  return (
    // Thème sombre interne (indépendant du thème global) pour matcher le design
    <div className="min-h-screen" style={{ background: "#080B14", color: "#E8EAF2", fontFamily: "'Sora', system-ui, sans-serif" }}>
      {/* HEADER */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: "#0E1320", borderColor: "#1C2235" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-xs hover:opacity-80"
            style={{ color: "#8892A4" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <div className="h-6 w-px" style={{ background: "#1C2235" }} />
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #FF5A1F, #FFB347)" }}
            >
              <Flame className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm leading-none">Eguette</div>
              <div className="text-[10px] mt-0.5" style={{ color: "#4A5568" }}>
                Diagnostic & Décisions
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Week nav */}
          <div className="flex items-center gap-2 text-xs" style={{ color: "#8892A4" }}>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="h-7 w-7 rounded-md flex items-center justify-center border hover:border-orange-500"
              style={{ background: "#141824", borderColor: "#1C2235" }}
              aria-label="Semaine précédente"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[140px] text-center">{data?.weekLabel ?? "—"}</span>
            <button
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              className="h-7 w-7 rounded-md flex items-center justify-center border disabled:opacity-30"
              style={{ background: "#141824", borderColor: "#1C2235" }}
              aria-label="Semaine suivante"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button
            onClick={handleExport}
            disabled={!data || loading}
            size="sm"
            style={{ background: "#FF5A1F", color: "white" }}
            className="hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-5">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#FF5A1F" }} />
          </div>
        )}

        {!loading && data && (
          <>
            {/* SCORE CARD */}
            <ScoreCard data={data} />

            {/* FAILLES */}
            <section>
              <SectionHead
                title="Failles détectées"
                count={`${data.failles.length} problème${data.failles.length > 1 ? "s" : ""} identifié${data.failles.length > 1 ? "s" : ""}`}
              />
              {data.failles.length === 0 ? (
                <EmptyCard
                  title="Aucune faille critique"
                  sub="Tout roule cette semaine 👌"
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {data.failles.map((f) => (
                    <FailleCard
                      key={f.id}
                      faille={f}
                      open={openFailles.has(f.id)}
                      onToggle={() => toggleFaille(f.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* DÉCISIONS */}
            <section>
              <SectionHead
                title="Décisions recommandées"
                count={`${appliedDecisions.size}/${data.decisions.length} appliquées`}
              />
              {data.decisions.length === 0 ? (
                <EmptyCard
                  title="Pas d'action urgente"
                  sub="Les décisions apparaîtront quand des failles seront détectées"
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {data.decisions.map((dec) => {
                    const applied = appliedDecisions.has(dec.id);
                    return (
                      <div
                        key={dec.id}
                        className="rounded-xl border p-4 flex items-start gap-3 transition-colors"
                        style={{
                          background: applied ? "rgba(16,185,129,0.05)" : "#141824",
                          borderColor: applied ? "rgba(16,185,129,0.3)" : "#1C2235",
                        }}
                      >
                        <button
                          onClick={() => toggleDecision(dec.id)}
                          className="h-5 w-5 rounded-md border flex items-center justify-center text-xs flex-shrink-0 mt-0.5"
                          style={{
                            background: applied ? "#10B981" : "#0E1320",
                            borderColor: applied ? "#10B981" : "#242B3D",
                            color: "white",
                          }}
                          aria-label={applied ? "Annuler" : "Marquer appliquée"}
                        >
                          {applied ? "✓" : ""}
                        </button>
                        <div className="flex-1">
                          <div
                            className="font-bold text-sm"
                            style={{ color: applied ? "#10B981" : "#E8EAF2" }}
                          >
                            {dec.title}
                          </div>
                          <div className="text-xs mt-1 leading-relaxed" style={{ color: "#8892A4" }}>
                            {dec.desc}
                          </div>
                          <DecisionTag tag={dec.tag} label={dec.tagLabel} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="text-center text-xs pt-4" style={{ color: "#4A5568" }}>
              Rapport basé sur {data.totalCommandes} commande(s) cette semaine
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* --------- Sous-composants --------- */

function ScoreCard({ data }: { data: RapportData }) {
  const annDiff = data.annulation - data.annulationPrev;
  const revDiff = data.revenuPerdu - data.revenuPerduPrev;
  const tempsDiff = data.tempsMoy - data.tempsMoyPrev;
  const scoreDiff = data.score - data.scorePrev;

  return (
    <div
      className="rounded-2xl border p-6 grid gap-6 items-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #141824 0%, #1A1F35 100%)",
        borderColor: "#242B3D",
        gridTemplateColumns: "auto 1fr auto",
      }}
    >
      {/* Halo décoratif */}
      <div
        className="absolute -top-16 -right-16 w-52 h-52 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,90,31,0.08) 0%, transparent 70%)" }}
      />

      {/* Cercle score */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${data.scoreColor} ${data.score}%, #1C2235 0)`,
          }}
        />
        <div
          className="absolute inset-1.5 rounded-full flex flex-col items-center justify-center"
          style={{ background: "#141824" }}
        >
          <div className="text-3xl font-extrabold" style={{ color: data.scoreColor }}>
            {data.score}
          </div>
          <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#4A5568" }}>
            Score
          </div>
        </div>
      </div>

      {/* Centre */}
      <div>
        <div className="text-xl font-extrabold tracking-tight">Bilan de la semaine</div>
        <div className="text-xs mt-1" style={{ color: "#8892A4" }}>
          {data.weekLabel}
        </div>
        <div className="flex flex-wrap gap-5 mt-4">
          <Kpi
            val={`${data.annulation}%`}
            label="Taux annulation"
            delta={`${annDiff > 0 ? "+" : ""}${annDiff}% vs sem. préc.`}
            positive={annDiff <= 0}
            color={annDiff <= 0 ? "#10B981" : "#EF4444"}
          />
          <Kpi
            val={`${Math.round(data.revenuPerdu / 1000)}k FCFA`}
            label="Revenu perdu"
            delta={`${revDiff > 0 ? "+" : ""}${Math.round(revDiff / 1000)}k vs sem. préc.`}
            positive={revDiff <= 0}
            color="#EF4444"
          />
          <Kpi
            val={`${data.tempsMoy} min`}
            label="Temps moyen"
            delta={`${tempsDiff > 0 ? "+" : ""}${tempsDiff} min vs sem. préc.`}
            positive={tempsDiff <= 0}
            color={tempsDiff <= 0 ? "#10B981" : "#F59E0B"}
          />
        </div>
      </div>

      {/* Droite */}
      <div className="text-right">
        <div className="text-[11px]" style={{ color: "#4A5568" }}>
          vs semaine dernière
        </div>
        <div
          className="text-sm font-bold mt-1"
          style={{ color: scoreDiff >= 0 ? "#10B981" : "#EF4444" }}
        >
          {scoreDiff >= 0 ? "▲" : "▼"} {Math.abs(scoreDiff)} points
        </div>
      </div>
    </div>
  );
}

function Kpi({
  val,
  label,
  delta,
  positive,
  color,
}: {
  val: string;
  label: string;
  delta: string;
  positive: boolean;
  color: string;
}) {
  return (
    <div>
      <div className="text-lg font-bold" style={{ color }}>
        {val}
      </div>
      <div className="text-[11px]" style={{ color: "#8892A4" }}>
        {label}
      </div>
      <div
        className="text-[11px] font-semibold mt-0.5"
        style={{ color: positive ? "#10B981" : "#EF4444" }}
      >
        {delta}
      </div>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "#4A5568" }}
      >
        {title}
      </div>
      <div className="text-[11px]" style={{ color: "#8892A4" }}>
        {count}
      </div>
    </div>
  );
}

function FailleCard({
  faille,
  open,
  onToggle,
}: {
  faille: RapportFaille;
  open: boolean;
  onToggle: () => void;
}) {
  const sevColors: Record<string, string> = {
    red: "#EF4444",
    amber: "#F59E0B",
    yellow: "#EAB308",
  };
  const impactBgs: Record<string, string> = {
    red: "rgba(239,68,68,0.12)",
    amber: "rgba(245,158,11,0.12)",
    yellow: "rgba(234,179,8,0.12)",
  };
  return (
    <div
      onClick={onToggle}
      className="rounded-xl border overflow-hidden cursor-pointer hover:border-opacity-100 transition-all"
      style={{ background: "#141824", borderColor: open ? "#242B3D" : "#1C2235" }}
    >
      <div className="flex items-center gap-3 p-4">
        <div
          className="h-2 w-2 rounded-full flex-shrink-0 animate-pulse"
          style={{
            background: sevColors[faille.sev],
            boxShadow: `0 0 8px ${sevColors[faille.sev]}66`,
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-snug">{faille.title}</div>
          <div className="text-[11px] mt-1" style={{ color: "#8892A4" }}>
            {faille.meta}
          </div>
        </div>
        <div
          className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: impactBgs[faille.impact], color: sevColors[faille.impact] }}
        >
          {faille.impactLabel}
        </div>
        <div
          className="text-xs flex-shrink-0 transition-transform"
          style={{ color: "#4A5568", transform: open ? "rotate(90deg)" : "none" }}
        >
          ›
        </div>
      </div>
      {open && (
        <div className="border-t p-4" style={{ borderColor: "#1C2235" }}>
          <div className="flex flex-wrap gap-2 mb-4">
            {faille.stats.map((s, i) => (
              <div
                key={i}
                className="rounded-lg px-3.5 py-2.5 flex-1 min-w-[80px]"
                style={{ background: "#0E1320" }}
              >
                <div className="text-lg font-extrabold" style={{ color: s.color }}>
                  {s.val}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "#8892A4" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {faille.bars.map((b, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between text-[11px] mb-1.5" style={{ color: "#8892A4" }}>
                <span>{b.label}</span>
                <span style={{ color: b.color, fontWeight: 700 }}>
                  {b.pct}
                  {b.label.toLowerCase().includes("min") || faille.id === "f-livreur" ? "min" : "%"}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1C2235" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, b.pct)}%`,
                    background: b.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionTag({ tag, label }: { tag: string; label: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    urgent: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
    facile: { bg: "rgba(16,185,129,0.12)", color: "#10B981" },
    moyen: { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" },
    impact: { bg: "rgba(139,92,246,0.12)", color: "#8B5CF6" },
  };
  const s = styles[tag] ?? styles.moyen;
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2"
      style={{ background: s.bg, color: s.color }}
    >
      {label}
    </span>
  );
}

function EmptyCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      className="rounded-xl p-8 text-center border border-dashed"
      style={{ background: "#141824", borderColor: "#242B3D" }}
    >
      <div className="text-3xl mb-2">✨</div>
      <div className="text-sm font-bold" style={{ color: "#8892A4" }}>
        {title}
      </div>
      <div className="text-xs mt-1" style={{ color: "#4A5568" }}>
        {sub}
      </div>
    </div>
  );
}
