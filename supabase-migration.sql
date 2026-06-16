-- ============================================================
-- LAPIDADOS CLUB OS — Migration inicial
-- Execute no Supabase SQL Editor
-- SEGURO: só cria tabelas e políticas NOVAS.
-- Não altera nenhuma tabela existente.
-- ============================================================

-- 1. Tabela de roles (se não existir)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL CHECK (role IN ('nutri', 'paciente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Função helper de role (SECURITY DEFINER para ser usada em outras políticas)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- 2. Coluna user_id na tabela patients (para linkar com Supabase Auth)
-- Só adiciona se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE patients ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- 3. Points ledger (gamificação)
CREATE TABLE IF NOT EXISTS points_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  points      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points_nutri_all" ON points_ledger
  FOR ALL USING (get_user_role() = 'nutri');

CREATE POLICY "points_patient_select" ON points_ledger
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );

-- 4. Dieta
CREATE TABLE IF NOT EXISTS diet_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Plano alimentar',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_id     UUID NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  time        TEXT,
  "order"     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meal_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id     UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_name   TEXT NOT NULL,
  qty         NUMERIC NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'g',
  kcal        NUMERIC,
  protein     NUMERIC,
  carbs       NUMERIC,
  fat         NUMERIC
);

ALTER TABLE diet_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diet_nutri_all"    ON diet_plans  FOR ALL USING (get_user_role() = 'nutri');
CREATE POLICY "meals_nutri_all"   ON meals        FOR ALL USING (get_user_role() = 'nutri');
CREATE POLICY "items_nutri_all"   ON meal_items   FOR ALL USING (get_user_role() = 'nutri');

CREATE POLICY "diet_patient_select" ON diet_plans
  FOR SELECT USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "meals_patient_select" ON meals
  FOR SELECT USING (diet_id IN (
    SELECT id FROM diet_plans WHERE patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  ));
CREATE POLICY "items_patient_select" ON meal_items
  FOR SELECT USING (meal_id IN (
    SELECT m.id FROM meals m
    JOIN diet_plans d ON m.diet_id = d.id
    JOIN patients p ON d.patient_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- 5. Treino
CREATE TABLE IF NOT EXISTS workout_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Plano de treino',
  active      BOOLEAN DEFAULT TRUE,
  split       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  "order"       INTEGER DEFAULT 0,
  muscle_group  TEXT
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id    UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  sets      INTEGER,
  reps      TEXT,
  load      TEXT,
  rest_s    INTEGER,
  video_url TEXT,
  notes     TEXT,
  "order"   INTEGER DEFAULT 0
);

ALTER TABLE workout_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wplan_nutri"   ON workout_plans     FOR ALL USING (get_user_role() = 'nutri');
CREATE POLICY "wday_nutri"    ON workout_days      FOR ALL USING (get_user_role() = 'nutri');
CREATE POLICY "wexer_nutri"   ON workout_exercises FOR ALL USING (get_user_role() = 'nutri');

CREATE POLICY "wplan_patient" ON workout_plans
  FOR SELECT USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "wday_patient" ON workout_days
  FOR SELECT USING (plan_id IN (
    SELECT id FROM workout_plans WHERE patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
  ));
CREATE POLICY "wexer_patient" ON workout_exercises
  FOR SELECT USING (day_id IN (
    SELECT wd.id FROM workout_days wd
    JOIN workout_plans wp ON wd.plan_id = wp.id
    JOIN patients p ON wp.patient_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- 6. IA de análise
CREATE TABLE IF NOT EXISTS ai_analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id       UUID NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  summary          TEXT,
  suggestions      JSONB DEFAULT '[]',
  attention_points JSONB DEFAULT '[]',
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ignored')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_nutri_all" ON ai_analyses FOR ALL USING (get_user_role() = 'nutri');

-- 7. Conteúdos (área de membros)
CREATE TABLE IF NOT EXISTS contents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body          TEXT,
  video_url     TEXT,
  cover_url     TEXT,
  published     BOOLEAN DEFAULT FALSE,
  plan_required BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contents_nutri_all" ON contents FOR ALL USING (get_user_role() = 'nutri');
CREATE POLICY "contents_patient_select" ON contents
  FOR SELECT USING (published = TRUE AND get_user_role() = 'paciente');

-- 8. Storage bucket para fotos de check-in
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-photos', 'checkin-photos', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "checkin_photos_nutri"
  ON storage.objects FOR ALL
  USING (bucket_id = 'checkin-photos' AND get_user_role() = 'nutri');

CREATE POLICY "checkin_photos_patient_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'checkin-photos' AND get_user_role() = 'paciente');

-- ============================================================
-- PRÓXIMO PASSO: Criar o primeiro usuário nutri
-- No Supabase Auth, crie o usuário manualmente ou via invite,
-- depois execute:
--
-- INSERT INTO user_roles (user_id, role) VALUES ('<seu_user_id>', 'nutri');
--
-- O user_id está em Auth > Users no dashboard do Supabase.
-- ============================================================
