import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Bike } from "lucide-react";
import { livreursService } from "@/services/livreursService";
import { commissionsService, type CommissionLivreur } from "@/services/commissionsService";
import { useAuth } from "@/contexts/AuthContext";
import type { Livreur } from "@/lib/types";
import { toast } from "sonner";
import { formatFCFA, maskTelephone } from "@/lib/format";


export default function Livreurs() {
  const { role } = useAuth();
  // SÉCURITÉ : ne jamais traiter `null` comme admin — un rôle absent doit être refusé.
  const isAdmin = role === "admin";
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [commissions, setCommissions] = useState<CommissionLivreur[]>([]);
  const [open, setOpen] = useState(false);

  const charger = async () => {
    try {
      const [ls, cs] = await Promise.all([livreursService.lister(), commissionsService.calculerJour()]);
      setLivreurs(ls);
      setCommissions(cs);
    } catch {
      // Silencieux — ne pas logger d'éventuelles données sensibles
    }
  };

  useEffect(() => {
    charger();
    const off1 = livreursService.ecouterChangements(charger);
    const id = setInterval(charger, 15000);
    return () => { off1(); clearInterval(id); };
  }, []);

  const totalCommission = useMemo(() => commissionsService.totalCommission(commissions), [commissions]);
  const getCommission = (id: string) => commissions.find((c) => c.livreur_id === id);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Livreurs</h1>
          <p className="text-muted-foreground mt-1">Statut, courses du jour et commissions</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Ajouter un livreur</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau livreur</DialogTitle></DialogHeader>
              <FormulaireLivreur onSuccess={() => { setOpen(false); charger(); toast.success("Livreur ajouté"); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-5 bg-gradient-hero text-primary-foreground border-0 shadow-elegant">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm opacity-80">Commission Eguette du jour</div>
            <div className="font-display text-3xl font-bold mt-1">{formatFCFA(totalCommission)}</div>
            <div className="text-xs opacity-70 mt-1">1 000 F par livreur ayant fait ≥ 5 courses</div>
          </div>
          <Bike className="h-12 w-12 opacity-30" />
        </div>
      </Card>

      {(["Matin", "Soir"] as const).map((eq) => {
        const groupe = livreurs.filter((l) => l.equipe === eq);
        return (
          <section key={eq} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-primary">Équipe {eq}</h2>
              <Badge variant="outline">{groupe.length}</Badge>
            </div>
            {groupe.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Aucun livreur dans cette équipe</Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupe.map((l) => {
                  const c = getCommission(l.id);
                  const nb = c?.nb_courses ?? 0;
                  const progress = Math.min(100, (nb / 5) * 100);
                  return (
                    <Card key={l.id} className="p-5 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{l.nom}</div>
                          <div className="text-xs text-muted-foreground">{maskTelephone(l.telephone)}</div>
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {l.en_service ? (
                              <Badge className="bg-success text-success-foreground">En service</Badge>
                            ) : (
                              <Badge variant="outline">Hors service</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-2xl font-bold">{nb}</div>
                          <div className="text-xs text-muted-foreground">courses aujourd'hui</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Palier 5 courses</span>
                          <span className="font-medium">{nb}/5</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Commission due</span>
                        <span className={`font-semibold ${(c?.commission ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {formatFCFA(c?.commission ?? 0)}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FormulaireLivreur({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ nom: "", telephone: "", equipe: "Matin" as "Matin" | "Soir" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const restaurant_id = "00000000-0000-0000-0000-000000000001";
      await livreursService.ajouter({ ...form, restaurant_id });
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nom complet</Label><Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
      <div><Label>Téléphone</Label><Input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
      <div>
        <Label>Équipe</Label>
        <Select value={form.equipe} onValueChange={(v) => setForm({ ...form, equipe: v as "Matin" | "Soir" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Matin">Matin</SelectItem>
            <SelectItem value="Soir">Soir</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full">{loading ? "Ajout…" : "Ajouter"}</Button>
    </form>
  );
}
