"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Plus, Search, Trash2, Clock, X, Loader2 } from "lucide-react";

interface Item {
  id: string;
  food_name: string;
  qty: number;
  unit: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface Meal {
  id: string;
  name: string;
  time: string | null;
  order: number;
  meal_items: Item[];
}

interface FoodResult {
  id: string;
  name: string;
  category: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
}

interface Patient {
  id: string;
  name: string;
}

function n(v: number | null | undefined) {
  return Math.round((v ?? 0) * 10) / 10;
}

export default function DietaEditorClient({
  patient,
  initialDiet,
  initialMeals,
}: {
  patient: Patient;
  initialDiet: { id: string; name: string; active: boolean } | null;
  initialMeals: Meal[];
}) {
  const supabase = createClient();
  const [dietId, setDietId] = useState<string | null>(initialDiet?.id ?? null);
  const [meals, setMeals] = useState<Meal[]>(initialMeals);
  const [pickerMealId, setPickerMealId] = useState<string | null>(null);
  const [savingMeal, setSavingMeal] = useState(false);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => {
        for (const item of meal.meal_items) {
          acc.kcal += item.kcal ?? 0;
          acc.protein += item.protein ?? 0;
          acc.carbs += item.carbs ?? 0;
          acc.fat += item.fat ?? 0;
        }
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meals]);

  async function ensureDiet(): Promise<string> {
    if (dietId) return dietId;
    const { data, error } = await supabase
      .from("diet_plans")
      .insert({ patient_id: patient.id, name: "Plano alimentar", active: true })
      .select("id")
      .single();
    if (error || !data) throw error;
    setDietId(data.id);
    return data.id;
  }

  async function handleAddMeal() {
    setSavingMeal(true);
    try {
      const diet_id = await ensureDiet();
      const { data, error } = await supabase
        .from("meals")
        .insert({ diet_id, name: "Nova refeição", time: null, order: meals.length })
        .select("id, name, time, order")
        .single();
      if (error || !data) throw error;
      setMeals((prev) => [...prev, { ...data, meal_items: [] }]);
    } finally {
      setSavingMeal(false);
    }
  }

  async function handleRemoveMeal(mealId: string) {
    if (!confirm("Remover essa refeição e todos os itens dela?")) return;
    await supabase.from("meals").delete().eq("id", mealId);
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
  }

  async function handleRenameMeal(mealId: string, name: string) {
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, name } : m)));
    await supabase.from("meals").update({ name }).eq("id", mealId);
  }

  async function handleMealTime(mealId: string, time: string) {
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, time } : m)));
    await supabase.from("meals").update({ time }).eq("id", mealId);
  }

  async function handleAddItem(mealId: string, item: Omit<Item, "id">) {
    const { data, error } = await supabase
      .from("meal_items")
      .insert({ meal_id: mealId, ...item })
      .select("id, food_name, qty, unit, kcal, protein, carbs, fat")
      .single();
    if (error || !data) return;
    setMeals((prev) =>
      prev.map((m) => (m.id === mealId ? { ...m, meal_items: [...m.meal_items, data] } : m))
    );
    setPickerMealId(null);
  }

  async function handleRemoveItem(mealId: string, itemId: string) {
    await supabase.from("meal_items").delete().eq("id", itemId);
    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId ? { ...m, meal_items: m.meal_items.filter((i) => i.id !== itemId) } : m
      )
    );
  }

  async function handleQtyChange(mealId: string, itemId: string, newQty: number) {
    const meal = meals.find((m) => m.id === mealId);
    const item = meal?.meal_items.find((i) => i.id === itemId);
    if (!item || newQty <= 0) return;

    const ratio = newQty / item.qty;
    const updated = {
      qty: newQty,
      kcal: item.kcal !== null ? Math.round(item.kcal * ratio * 10) / 10 : null,
      protein: item.protein !== null ? Math.round(item.protein * ratio * 10) / 10 : null,
      carbs: item.carbs !== null ? Math.round(item.carbs * ratio * 10) / 10 : null,
      fat: item.fat !== null ? Math.round(item.fat * ratio * 10) / 10 : null,
    };

    setMeals((prev) =>
      prev.map((m) =>
        m.id === mealId
          ? {
              ...m,
              meal_items: m.meal_items.map((i) => (i.id === itemId ? { ...i, ...updated } : i)),
            }
          : m
      )
    );
    await supabase.from("meal_items").update(updated).eq("id", itemId);
  }

  return (
    <div className="min-h-full bg-[#F8F8F8]">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white border-b border-surface-muted px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dietas" className="text-ink-muted hover:text-ink transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-ink truncate">{patient.name}</h1>
            <p className="text-xs text-ink-muted">Plano alimentar</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <TotalBadge label="kcal" value={n(totals.kcal)} />
          <TotalBadge label="P" value={n(totals.protein)} suffix="g" />
          <TotalBadge label="C" value={n(totals.carbs)} suffix="g" />
          <TotalBadge label="G" value={n(totals.fat)} suffix="g" />
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onRename={(name) => handleRenameMeal(meal.id, name)}
            onTime={(time) => handleMealTime(meal.id, time)}
            onRemove={() => handleRemoveMeal(meal.id)}
            onAddItemClick={() => setPickerMealId(meal.id)}
            onRemoveItem={(itemId) => handleRemoveItem(meal.id, itemId)}
            onQtyChange={(itemId, qty) => handleQtyChange(meal.id, itemId, qty)}
          />
        ))}

        <button
          onClick={handleAddMeal}
          disabled={savingMeal}
          className="flex items-center justify-center gap-2 h-11 border-2 border-dashed border-surface-muted
                     rounded-md text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand
                     transition-colors disabled:opacity-50"
        >
          {savingMeal ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Nova refeição
        </button>

        {meals.length === 0 && !savingMeal && (
          <p className="text-center text-ink-muted text-sm mt-4">
            Comece adicionando a primeira refeição do dia.
          </p>
        )}
      </div>

      {pickerMealId && (
        <FoodPickerModal
          onClose={() => setPickerMealId(null)}
          onAdd={(item) => handleAddItem(pickerMealId, item)}
        />
      )}
    </div>
  );
}

function TotalBadge({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-ink leading-none">{value}{suffix}</p>
      <p className="text-[10px] text-ink-muted uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

function MealCard({
  meal,
  onRename,
  onTime,
  onRemove,
  onAddItemClick,
  onRemoveItem,
  onQtyChange,
}: {
  meal: Meal;
  onRename: (name: string) => void;
  onTime: (time: string) => void;
  onRemove: () => void;
  onAddItemClick: () => void;
  onRemoveItem: (itemId: string) => void;
  onQtyChange: (itemId: string, qty: number) => void;
}) {
  const mealTotals = meal.meal_items.reduce(
    (acc, i) => {
      acc.kcal += i.kcal ?? 0;
      acc.protein += i.protein ?? 0;
      acc.carbs += i.carbs ?? 0;
      acc.fat += i.fat ?? 0;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-muted">
        <input
          value={meal.name}
          onChange={(e) => onRename(e.target.value)}
          className="text-sm font-semibold text-ink bg-transparent focus:outline-none focus:border-b focus:border-brand flex-1 min-w-0"
        />
        <div className="flex items-center gap-1 text-ink-muted shrink-0">
          <Clock size={13} />
          <input
            type="time"
            value={meal.time ?? ""}
            onChange={(e) => onTime(e.target.value)}
            className="text-xs bg-transparent focus:outline-none w-[70px]"
          />
        </div>
        <span className="text-xs text-ink-muted shrink-0">{n(mealTotals.kcal)} kcal</span>
        <button onClick={onRemove} className="text-ink-muted hover:text-red-500 transition-colors shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="divide-y divide-surface-muted">
        {meal.meal_items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate">{item.food_name}</p>
              <p className="text-xs text-ink-muted">
                {n(item.kcal)} kcal · P {n(item.protein)}g · C {n(item.carbs)}g · G {n(item.fat)}g
              </p>
            </div>
            <input
              type="number"
              value={item.qty}
              onChange={(e) => onQtyChange(item.id, Number(e.target.value))}
              className="w-16 h-8 px-2 text-sm text-center border border-surface-muted rounded-sm
                         focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
            <span className="text-xs text-ink-muted w-4 shrink-0">{item.unit}</span>
            <button onClick={() => onRemoveItem(item.id)} className="text-ink-muted hover:text-red-500 transition-colors shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onAddItemClick}
        className="w-full flex items-center justify-center gap-1.5 h-9 text-xs font-medium text-brand hover:bg-brand-50 transition-colors border-t border-surface-muted"
      >
        <Plus size={13} /> Adicionar alimento
      </button>
    </div>
  );
}

function FoodPickerModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Omit<Item, "id">) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [qty, setQty] = useState(100);
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });

  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleSearch(value: string) {
    setQuery(value);
    clearTimeout(debounceTimer);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceTimer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.rpc("search_foods", { query: value.trim() });
      setResults(data ?? []);
      setLoading(false);
    }, 300);
  }

  function confirmAdd() {
    if (manualMode) {
      onAdd({
        food_name: manual.name || "Alimento",
        qty,
        unit: "g",
        kcal: manual.kcal ? Number(manual.kcal) : null,
        protein: manual.protein ? Number(manual.protein) : null,
        carbs: manual.carbs ? Number(manual.carbs) : null,
        fat: manual.fat ? Number(manual.fat) : null,
      });
      return;
    }
    if (!selected) return;
    const ratio = qty / 100;
    onAdd({
      food_name: selected.name,
      qty,
      unit: "g",
      kcal: selected.kcal_100g !== null ? Math.round(selected.kcal_100g * ratio * 10) / 10 : null,
      protein: selected.protein_100g !== null ? Math.round(selected.protein_100g * ratio * 10) / 10 : null,
      carbs: selected.carbs_100g !== null ? Math.round(selected.carbs_100g * ratio * 10) / 10 : null,
      fat: selected.fat_100g !== null ? Math.round(selected.fat_100g * ratio * 10) / 10 : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-md rounded-t-lg shadow-card-hover max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-muted shrink-0">
          <h3 className="text-sm font-semibold text-ink">Adicionar alimento</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>

        {!manualMode ? (
          <>
            <div className="p-4 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar alimento (ex: arroz, frango...)"
                  className="w-full h-10 pl-9 pr-3 rounded-sm border border-surface-muted text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
              {loading && <p className="text-center text-xs text-ink-muted py-4">Buscando...</p>}
              {!loading && results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className={`w-full text-left px-3 py-2.5 rounded-sm mb-1 transition-colors ${
                    selected?.id === f.id ? "bg-brand-50 border border-brand" : "hover:bg-surface-subtle border border-transparent"
                  }`}
                >
                  <p className="text-sm text-ink">{f.name}</p>
                  <p className="text-xs text-ink-muted">
                    {n(f.kcal_100g)} kcal · P {n(f.protein_100g)}g · C {n(f.carbs_100g)}g · G {n(f.fat_100g)}g <span className="text-ink-disabled">/100g</span>
                  </p>
                </button>
              ))}
              {!loading && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-center text-xs text-ink-muted py-4">Nada encontrado.</p>
              )}
            </div>

            <div className="p-4 border-t border-surface-muted shrink-0 flex flex-col gap-3">
              <button
                onClick={() => setManualMode(true)}
                className="text-xs text-brand hover:text-brand-dark font-medium text-left"
              >
                Não achei — adicionar manualmente
              </button>

              {selected && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-ink-secondary shrink-0">Quantidade (g)</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-20 h-9 px-2 text-sm text-center border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <button
                    onClick={confirmAdd}
                    className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 flex flex-col gap-3 overflow-y-auto">
            <input
              placeholder="Nome do alimento"
              value={manual.name}
              onChange={(e) => setManual({ ...manual, name: e.target.value })}
              className="h-9 px-3 text-sm border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Qtd (g)" value={qty} onChange={(e) => setQty(Number(e.target.value))}
                className="h-9 px-3 text-sm border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <input type="number" placeholder="Kcal (total p/ qtd)" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })}
                className="h-9 px-3 text-sm border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <input type="number" placeholder="Proteína (g)" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })}
                className="h-9 px-3 text-sm border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <input type="number" placeholder="Carbo (g)" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })}
                className="h-9 px-3 text-sm border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <input type="number" placeholder="Gordura (g)" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })}
                className="h-9 px-3 text-sm border border-surface-muted rounded-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setManualMode(false)} className="flex-1 h-9 border border-surface-muted text-ink text-sm rounded-sm hover:bg-surface-subtle transition-colors">
                Voltar pra busca
              </button>
              <button onClick={confirmAdd} className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors">
                Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
