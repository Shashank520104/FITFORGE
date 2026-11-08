import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Notice } from "../../components/common/Notice.js";
import { PageHeading } from "../../components/common/PageHeading.js";
import { Stat } from "../../components/common/Stat.js";
import {
  emptyFoodValues,
  type ApiResponse,
  type Food,
  type FoodEstimate,
  type NutritionLog,
  type Totals,
} from "../../types/index.js";
import { formatNumber, today } from "../../utils/formatters.js";

export function NutritionPage({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [addingFood, setAddingFood] = useState(false);
  const [addingMeal, setAddingMeal] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState("breakfast");
  const [mealFoodId, setMealFoodId] = useState("");
  const [mealAmount, setMealAmount] = useState("100");
  const [foodName, setFoodName] = useState("");
  const [foodUnit, setFoodUnit] = useState<"g" | "ml">("g");
  const [foodSource, setFoodSource] = useState("");
  const [foodAiModel, setFoodAiModel] = useState("");
  const [estimateAvailable, setEstimateAvailable] = useState(false);
  const [foodValues, setFoodValues] = useState(emptyFoodValues);

  const mealSections = [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "snack", label: "Snacks" },
  ];

  const selectedMealFood =
    foods.find((food) => food.id === mealFoodId) ?? foods[0];
  const mealAmountValue = Number(mealAmount);
  const mealNutritionPreview =
    selectedMealFood && Number.isFinite(mealAmountValue) && mealAmountValue > 0
      ? {
          calories:
            (Number(selectedMealFood.calories_per_100) * mealAmountValue) / 100,
          protein:
            (Number(selectedMealFood.protein_per_100) * mealAmountValue) / 100,
          carbohydrates:
            (Number(selectedMealFood.carbohydrates_per_100) * mealAmountValue) /
            100,
          fat: (Number(selectedMealFood.fat_per_100) * mealAmountValue) / 100,
        }
      : null;

  function clearAiEstimate() {
    if (!foodAiModel) return;
    setFoodValues(emptyFoodValues);
    setFoodSource("");
    setFoodAiModel("");
  }

  const loadFoods = useCallback(async () => {
    const response = await api<ApiResponse<Food[]>>("/api/v1/foods?limit=100");
    setFoods(response.data);
  }, [api]);

  const loadEstimateAvailability = useCallback(async () => {
    const response = await api<ApiResponse<{ available: boolean }>>(
      "/api/v1/foods/estimate",
    );
    setEstimateAvailable(response.data.available);
  }, [api]);

  const loadLogs = useCallback(async () => {
    const response = await api<ApiResponse<NutritionLog[]>>(
      `/api/v1/nutrition/logs?date=${date}`,
    );
    setLogs(response.data);
    setTotals(response.total ?? null);
  }, [api, date]);

  const load = useCallback(async () => {
    try {
      await Promise.all([loadFoods(), loadLogs(), loadEstimateAvailability()]);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nutrition data could not be loaded.",
      );
    }
  }, [loadEstimateAvailability, loadFoods, loadLogs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/foods", {
        method: "POST",
        body: JSON.stringify({
          name: foodName,
          servingUnit: foodUnit,
          caloriesPer100: Number(foodValues.caloriesPer100),
          proteinPer100: Number(foodValues.proteinPer100),
          carbohydratesPer100: Number(foodValues.carbohydratesPer100),
          fatPer100: Number(foodValues.fatPer100),
          fiberPer100: Number(foodValues.fiberPer100),
          sodiumMgPer100: Number(foodValues.sodiumMgPer100),
          calciumMgPer100: Number(foodValues.calciumMgPer100),
          ironMgPer100: Number(foodValues.ironMgPer100),
          potassiumMgPer100: Number(foodValues.potassiumMgPer100),
          magnesiumMgPer100: Number(foodValues.magnesiumMgPer100),
          sourceLabel: foodSource,
          sourceUrl: fields.get("sourceUrl") || undefined,
        }),
      });
      setAddingFood(false);
      setFoodName("");
      setFoodUnit("g");
      setFoodValues(emptyFoodValues);
      setFoodSource("");
      setFoodAiModel("");
      await loadFoods();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Food could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function estimateFood(_form: HTMLFormElement | null) {
    if (!foodName.trim()) return;
    setEstimating(true);
    setError("");
    try {
      const response = await api<ApiResponse<FoodEstimate>>(
        "/api/v1/foods/estimate",
        {
          method: "POST",
          body: JSON.stringify({
            name: foodName,
            servingUnit: foodUnit,
          }),
        },
      );
      setFoodValues({
        caloriesPer100: String(response.data.caloriesPer100),
        proteinPer100: String(response.data.proteinPer100),
        carbohydratesPer100: String(response.data.carbohydratesPer100),
        fatPer100: String(response.data.fatPer100),
        fiberPer100: String(response.data.fiberPer100),
        sodiumMgPer100: String(response.data.sodiumMgPer100),
        calciumMgPer100: String(response.data.calciumMgPer100),
        ironMgPer100: String(response.data.ironMgPer100),
        potassiumMgPer100: String(response.data.potassiumMgPer100),
        magnesiumMgPer100: String(response.data.magnesiumMgPer100),
      });
      setFoodSource(response.data.sourceLabel);
      setFoodAiModel(response.data.model);
    } catch (estimateError) {
      setError(
        estimateError instanceof Error
          ? estimateError.message
          : "Nutrition could not be estimated.",
      );
    } finally {
      setEstimating(false);
    }
  }

  async function saveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/nutrition/logs", {
        method: "POST",
        body: JSON.stringify({
          date,
          mealType: fields.get("mealType"),
          items: [
            {
              foodId: fields.get("foodId"),
              servingAmount: Number(fields.get("amount")),
            },
          ],
        }),
      });
      setAddingMeal(false);
      await loadLogs();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Meal could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openMealForm(mealType = "breakfast") {
    setSelectedMealType(mealType);
    setAddingMeal(true);
    setAddingFood(false);
  }

  async function removeMeal(logId: string) {
    if (!window.confirm("Remove this meal from your log?")) return;
    setError("");
    try {
      await api(`/api/v1/nutrition/logs/${logId}`, { method: "DELETE" });
      await loadLogs();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Meal could not be removed.",
      );
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="EAT, LOG, UNDERSTAND"
        title="Nutrition log"
        description="Your daily totals come from foods and serving amounts you enter."
        action={
          <label className="date-control">
            LOG DATE
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        }
      />
      {error && <Notice onRetry={() => void load()}>{error}</Notice>}
      <div className="macro-grid">
        <Stat
          label="CALORIES"
          value={totals ? `${formatNumber(totals.calories, 0)} kcal` : "—"}
          detail="Logged meals only"
        />
        <Stat
          label="PROTEIN"
          value={totals ? `${formatNumber(totals.proteinG)} g` : "—"}
          detail="From your food records"
        />
        <Stat
          label="CARBOHYDRATES"
          value={totals ? `${formatNumber(totals.carbohydratesG)} g` : "—"}
          detail="From your food records"
        />
        <Stat
          label="FAT"
          value={totals ? `${formatNumber(totals.fatG)} g` : "—"}
          detail="From your food records"
        />
      </div>
      <p className="small-note">
        Minerals
        {totals
          ? ` · Calcium ${formatNumber(totals.calciumMg)} mg · Iron ${formatNumber(totals.ironMg)} mg · Potassium ${formatNumber(totals.potassiumMg)} mg · Magnesium ${formatNumber(totals.magnesiumMg)} mg`
          : " · Log a meal to see daily totals"}
      </p>
      <div className="toolbar action-toolbar">
        <p className="muted">
          {foods.length} personal food{foods.length === 1 ? "" : "s"} in your
          library
        </p>
        <div>
          <button
            className="button secondary"
            onClick={() => {
              setAddingFood(!addingFood);
              setAddingMeal(false);
            }}
          >
            + Add food
          </button>
          <button
            className="button primary"
            disabled={!foods.length}
            onClick={() => (addingMeal ? setAddingMeal(false) : openMealForm())}
          >
            + Log meal
          </button>
        </div>
      </div>
      {addingFood && (
        <form className="surface form-surface" onSubmit={saveFood}>
          <p className="eyebrow">YOUR FOOD · VALUES PER 100 G / ML</p>
          <p className="muted">
            Add the food name and use the AI estimator to fill typical values
            per 100 g/ml, or enter values from a trusted label. AI values are
            estimates; check them before saving.
          </p>
          <div className="toolbar">
            <button
              className="button secondary"
              type="button"
              disabled={estimating || busy || !foodName.trim()}
              onClick={(event) => void estimateFood(event.currentTarget.form)}
            >
              {estimating ? "Estimating…" : "Estimate nutrition locally"}
            </button>
            <span className="small-note">
              {!estimateAvailable
                ? "Free local AI is starting or its model is missing. Check the Ollama model download; you can enter values manually."
                : foodAiModel
                  ? `Estimated locally with Ollama ${foodAiModel}`
                  : "Free local AI · Ollama"}
            </span>
          </div>
          <div className="form-grid">
            <label>
              Food name
              <input
                name="name"
                maxLength={120}
                value={foodName}
                disabled={estimating}
                onChange={(event) => {
                  clearAiEstimate();
                  setFoodName(event.target.value);
                }}
                required
              />
            </label>
            <label>
              Unit
              <select
                name="servingUnit"
                value={foodUnit}
                disabled={estimating}
                onChange={(event) => {
                  clearAiEstimate();
                  setFoodUnit(event.target.value === "ml" ? "ml" : "g");
                }}
              >
                <option value="g">grams (g)</option>
                <option value="ml">millilitres (ml)</option>
              </select>
            </label>
            <label>
              Calories
              <input
                name="calories"
                type="number"
                min="0"
                max="1000"
                step="0.01"
                value={foodValues.caloriesPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    caloriesPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Protein (g)
              <input
                name="protein"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.proteinPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    proteinPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Carbohydrates (g)
              <input
                name="carbohydrates"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.carbohydratesPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    carbohydratesPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Fat (g)
              <input
                name="fat"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.fatPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    fatPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Fiber (g)
              <input
                name="fiber"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={foodValues.fiberPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    fiberPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Sodium (mg)
              <input
                name="sodium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.sodiumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    sodiumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Calcium (mg)
              <input
                name="calcium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.calciumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    calciumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Iron (mg)
              <input
                name="iron"
                type="number"
                min="0"
                max="10000"
                step="0.01"
                value={foodValues.ironMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    ironMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Potassium (mg)
              <input
                name="potassium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.potassiumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    potassiumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Magnesium (mg)
              <input
                name="magnesium"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={foodValues.magnesiumMgPer100}
                onChange={(event) =>
                  setFoodValues({
                    ...foodValues,
                    magnesiumMgPer100: event.target.value,
                  })
                }
                required
              />
            </label>
            <label>
              Source label
              <input
                name="source"
                maxLength={200}
                placeholder="e.g. package nutrition label"
                value={foodSource}
                onChange={(event) => setFoodSource(event.target.value)}
                required
              />
            </label>
            <label>
              Source URL (optional)
              <input name="sourceUrl" type="url" maxLength={2048} />
            </label>
          </div>
          <button className="button primary" disabled={busy || estimating}>
            {busy ? "Saving…" : "Save food"}
          </button>
        </form>
      )}
      {addingMeal && (
        <form className="surface form-surface" onSubmit={saveMeal}>
          <p className="eyebrow">LOG A MEAL FOR {date}</p>
          <p className="muted">
            Enter how much you actually ate. Nutrition totals are scaled to your
            consumed amount.
          </p>
          <div className="form-grid">
            <label>
              Meal
              <select
                name="mealType"
                value={selectedMealType}
                onChange={(event) => setSelectedMealType(event.target.value)}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </label>
            <label>
              Food
              <select
                name="foodId"
                value={selectedMealFood?.id ?? ""}
                onChange={(event) => setMealFoodId(event.target.value)}
                required
              >
                {foods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name} · {food.source_label}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Amount consumed
              <span className="quantity-input">
                <input
                  name="amount"
                  type="number"
                  min="0.1"
                  max="10000"
                  step="0.1"
                  value={mealAmount}
                  onChange={(event) => setMealAmount(event.target.value)}
                  aria-label={`Amount consumed in ${selectedMealFood?.serving_unit ?? "g"}`}
                  required
                />
                <span className="quantity-unit">
                  {selectedMealFood?.serving_unit ?? "g"}
                </span>
              </span>
            </label>
          </div>
          <p className="small-note" aria-live="polite">
            {mealNutritionPreview && selectedMealFood
              ? `For ${formatNumber(mealAmountValue)} ${selectedMealFood.serving_unit}: ${formatNumber(mealNutritionPreview.calories, 0)} kcal · ${formatNumber(mealNutritionPreview.protein)} g protein · ${formatNumber(mealNutritionPreview.carbohydrates)} g carbs · ${formatNumber(mealNutritionPreview.fat)} g fat`
              : "Enter a consumed amount greater than zero to preview nutrition."}
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save meal"}
          </button>
        </form>
      )}
      <section className="surface meals-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MEALS ON {date}</p>
            <h2>Food log</h2>
          </div>
          <span className="muted">
            {logs.length} meal entr{logs.length === 1 ? "y" : "ies"}
          </span>
        </div>
        {mealSections.map((section) => {
          const sectionLogs = logs.filter(
            (log) => log.meal_type === section.value,
          );
          const sectionItems = sectionLogs.flatMap((log) =>
            log.items.map((item, index) => ({
              ...item,
              logId: log.id,
              key: `${log.id}-${item.foodName}-${index}`,
            })),
          );
          const sectionCalories = sectionItems.reduce(
            (sum, item) => sum + Number(item.calories),
            0,
          );
          const sectionProtein = sectionItems.reduce(
            (sum, item) => sum + Number(item.proteinG),
            0,
          );
          const sectionCarbs = sectionItems.reduce(
            (sum, item) => sum + Number(item.carbohydratesG),
            0,
          );
          return (
            <section className="meal-section" key={section.value}>
              <div className="meal-section-heading">
                <div>
                  <h3>{section.label}</h3>
                  <span className="muted">
                    {sectionItems.length
                      ? `${formatNumber(sectionCalories, 0)} kcal · ${formatNumber(sectionProtein)} g protein · ${formatNumber(sectionCarbs)} g carbs`
                      : "Nothing logged yet"}
                  </span>
                </div>
                <button
                  className="button secondary"
                  disabled={!foods.length}
                  onClick={() => openMealForm(section.value)}
                >
                  + Add food
                </button>
              </div>
              {sectionItems.map((item) => (
                <article className="meal-row" key={item.key}>
                  <div className="meal-entry">
                    <b>{item.foodName}</b>
                    <p className="muted">
                      {formatNumber(item.servingAmount)} {item.servingUnit} ·{" "}
                      {item.source}
                    </p>
                  </div>
                  <span className="meal-calories">
                    {formatNumber(Number(item.calories), 0)} kcal
                  </span>
                  <button
                    className="icon-button danger-text"
                    aria-label={`Remove ${section.label} entry: ${item.foodName}`}
                    onClick={() => void removeMeal(item.logId)}
                  >
                    ×
                  </button>
                </article>
              ))}
            </section>
          );
        })}
        {!logs.length && !foods.length && (
          <p className="small-note">
            Add foods to your library first, then log them under a meal.
          </p>
        )}
      </section>
      <p className="small-note">
        Nutrition totals are arithmetic from your entered food values, not
        dietary guidance.
      </p>
    </>
  );
}
