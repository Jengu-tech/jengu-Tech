-- =====================================================================
-- Eguette — Migration sécurité : Row-Level Security (RLS)
-- À exécuter dans le SQL Editor de votre projet Supabase.
-- =====================================================================
-- Contexte : actuellement les tables `commandes`, `livreurs`, `user_roles`
-- et `commissions_journalieres` n'ont pas de RLS. La clé anon Supabase
-- étant publique (embarquée dans le bundle client), n'importe qui peut
-- lire/écrire toutes les lignes via l'API REST en contournant l'UI.
-- Cette migration verrouille l'accès aux seuls rôles `admin` et
-- `gestionnaire` (lus depuis la table `user_roles`).
-- =====================================================================

-- 1) Type enum des rôles (créé seulement s'il n'existe pas déjà)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'gestionnaire', 'livreur');
  END IF;
END$$;

-- 2) Fonction SECURITY DEFINER : vérifie qu'un user a un rôle.
--    Évite la récursion infinie dans les politiques RLS sur user_roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Helper : "est admin ou gestionnaire"
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'gestionnaire'::public.app_role);
$$;

-- 3) Activer RLS sur toutes les tables sensibles
ALTER TABLE public.commandes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livreurs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions_journalieres ENABLE ROW LEVEL SECURITY;

-- 4) Politiques sur `commandes` — staff uniquement
DROP POLICY IF EXISTS "staff read commandes"   ON public.commandes;
DROP POLICY IF EXISTS "staff insert commandes" ON public.commandes;
DROP POLICY IF EXISTS "staff update commandes" ON public.commandes;
DROP POLICY IF EXISTS "staff delete commandes" ON public.commandes;

CREATE POLICY "staff read commandes"   ON public.commandes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert commandes" ON public.commandes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update commandes" ON public.commandes FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete commandes" ON public.commandes FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 5) Politiques sur `livreurs` — staff uniquement
DROP POLICY IF EXISTS "staff read livreurs"   ON public.livreurs;
DROP POLICY IF EXISTS "staff insert livreurs" ON public.livreurs;
DROP POLICY IF EXISTS "staff update livreurs" ON public.livreurs;
DROP POLICY IF EXISTS "staff delete livreurs" ON public.livreurs;

CREATE POLICY "staff read livreurs"   ON public.livreurs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert livreurs" ON public.livreurs FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update livreurs" ON public.livreurs FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete livreurs" ON public.livreurs FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 6) Politiques sur `user_roles` — chacun voit son propre rôle ;
--    seuls les admins peuvent gérer les rôles (création/modification).
DROP POLICY IF EXISTS "self read role"      ON public.user_roles;
DROP POLICY IF EXISTS "admin read roles"    ON public.user_roles;
DROP POLICY IF EXISTS "admin insert roles"  ON public.user_roles;
DROP POLICY IF EXISTS "admin update roles"  ON public.user_roles;
DROP POLICY IF EXISTS "admin delete roles"  ON public.user_roles;

CREATE POLICY "self read role"     ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admin read roles"   ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7) Politiques sur `commissions_journalieres` — staff uniquement
DROP POLICY IF EXISTS "staff read commissions"   ON public.commissions_journalieres;
DROP POLICY IF EXISTS "staff insert commissions" ON public.commissions_journalieres;
DROP POLICY IF EXISTS "staff update commissions" ON public.commissions_journalieres;
DROP POLICY IF EXISTS "staff delete commissions" ON public.commissions_journalieres;

CREATE POLICY "staff read commissions"   ON public.commissions_journalieres FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert commissions" ON public.commissions_journalieres FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update commissions" ON public.commissions_journalieres FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete commissions" ON public.commissions_journalieres FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- 8) Révoquer tout accès de l'anon (clé publique) sur ces tables.
--    Avec RLS activé et aucune policy `TO anon`, l'API REST refusera déjà
--    toute requête anonyme, mais on durcit explicitement.
REVOKE ALL ON public.commandes,
              public.livreurs,
              public.user_roles,
              public.commissions_journalieres
       FROM anon;

-- =====================================================================
-- FIN — Vérifier ensuite que :
--   - Connecté comme admin/gestionnaire : toutes les pages fonctionnent.
--   - Sans token : l'API REST renvoie 401/empty sur ces tables.
-- =====================================================================
