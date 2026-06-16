export type Role = "nutri" | "paciente";

export interface UserProfile {
  id: string;
  role: Role;
  name: string;
  email: string;
  avatar_url?: string;
  phone?: string;
}

// Tabelas existentes no Supabase (compatível com LAPIDADOS_CONTROL)
export interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  goal?: string;
  status: "ativo" | "inativo" | "pausado";
  started_at: string;
  nutritionist_id: string;
  plan_id?: string;
  user_id?: string; // preenchido quando o paciente tiver login
}

export interface Checkin {
  id: string;
  patient_id: string;
  week: number;
  weight?: number;
  adherence?: number;
  hunger?: number;
  energy?: number;
  sleep?: number;
  training?: number;
  notes?: string;
  created_at: string;
  // fotos virão do Storage
}

export interface FinancialRecord {
  id: string;
  patient_id: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
  status: "pago" | "pendente" | "cancelado";
  due_date?: string;
  paid_at?: string;
  created_at: string;
}

// Tabelas novas — ainda não existem no banco
export interface DietPlan {
  id: string;
  patient_id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Meal {
  id: string;
  diet_id: string;
  name: string;
  time?: string;
  order: number;
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_name: string;
  qty: number;
  unit: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface WorkoutPlan {
  id: string;
  patient_id: string;
  name: string;
  active: boolean;
  split?: string;
  created_at: string;
}

export interface WorkoutDay {
  id: string;
  plan_id: string;
  name: string;
  order: number;
  muscle_group?: string;
}

export interface WorkoutExercise {
  id: string;
  day_id: string;
  name: string;
  sets?: number;
  reps?: string;
  load?: string;
  rest_s?: number;
  video_url?: string;
  notes?: string;
  order: number;
}

export interface PointsLedger {
  id: string;
  patient_id: string;
  source: string;
  points: number;
  created_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  icon: string;
  description?: string;
}

export interface PatientAchievement {
  patient_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface AiAnalysis {
  id: string;
  checkin_id: string;
  summary: string;
  suggestions: string[];
  attention_points: string[];
  status: "pending" | "approved" | "ignored";
  created_at: string;
}

export interface Content {
  id: string;
  title: string;
  body?: string;
  video_url?: string;
  cover_url?: string;
  published: boolean;
  plan_required?: boolean;
  created_at: string;
}
