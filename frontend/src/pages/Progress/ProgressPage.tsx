import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { StrengthChart } from "../../components/charts/StrengthChart.js";
import { TrendChart } from "../../components/charts/TrendChart.js";
import { Notice } from "../../components/common/Notice.js";
import { PageHeading } from "../../components/common/PageHeading.js";
import type {
  ApiResponse,
  Measurement,
  Profile,
  StrengthRecord,
} from "../../types/index.js";
import {
  dateOnly,
  displayWeight,
  localDateAtNoon,
  today,
  weightInKilograms,
} from "../../utils/formatters.js";

export function ProgressPage({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [records, setRecords] = useState<StrengthRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recordResult, setRecordResult] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [currentDate] = useState(today);
  const [range, setRange] = useState<"30" | "90" | "all">("90");
  const [rangeAnchor] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const [summary, history, profile] = await Promise.all([
        api<
          ApiResponse<{
            measurements: Measurement[];
            personalRecords: StrengthRecord[];
          }>
        >("/api/v1/progress/summary"),
        api<ApiResponse<StrengthRecord[]>>(
          "/api/v1/progress/strength-records?limit=366",
        ),
        api<ApiResponse<Profile>>("/api/v1/profile"),
      ]);
      setError("");
      setMeasurements(summary.data.measurements);
      setRecords(history.data);
      setUnits(profile.data.units);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Progress could not be loaded.",
      );
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const exerciseNames = useMemo(
    () => [...new Set(records.map((record) => record.exercise_name))].sort(),
    [records],
  );

  const rangeMeasurements = useMemo(() => {
    if (range === "all") return measurements;
    const cutoff = new Date(rangeAnchor);
    cutoff.setDate(cutoff.getDate() - Number(range));
    return measurements.filter(
      (row) => localDateAtNoon(row.measured_on) >= cutoff,
    );
  }, [measurements, range, rangeAnchor]);

  const selectedRecords = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.exercise_name === (selectedExercise || exerciseNames[0]),
        )
        .filter((record) => {
          if (range === "all") return true;
          const cutoff = new Date(rangeAnchor);
          cutoff.setDate(cutoff.getDate() - Number(range));
          return localDateAtNoon(record.performed_at) >= cutoff;
        })
        .sort((first, second) =>
          first.performed_at.localeCompare(second.performed_at),
        ),
    [exerciseNames, range, rangeAnchor, records, selectedExercise],
  );

  async function saveMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/progress/measurements", {
        method: "POST",
        body: JSON.stringify({
          measuredOn: fields.get("date"),
          weightKg: weightInKilograms(Number(fields.get("weight")), units),
          bodyFatPercent: fields.get("bodyFat")
            ? Number(fields.get("bodyFat"))
            : undefined,
        }),
      });
      form.reset();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Measurement could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveStrength(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setRecordResult("");
    try {
      const response = await api<
        ApiResponse<StrengthRecord> & { isPersonalRecord: boolean }
      >("/api/v1/progress/strength-records", {
        method: "POST",
        body: JSON.stringify({
          exerciseName: fields.get("exercise"),
          performedAt: fields.get("performedAt"),
          weightKg: weightInKilograms(Number(fields.get("weight")), units),
          repetitions: Number(fields.get("reps")),
        }),
      });
      setRecordResult(
        response.isPersonalRecord
          ? "New max-load personal record saved."
          : "Strength record saved.",
      );
      form.reset();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Strength record could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="MEASURE WHAT MATTERS TO YOU"
        title="Progress"
        description="Your measurements and lift history, shown as you recorded them."
      />
      {error && <Notice onRetry={() => void load()}>{error}</Notice>}
      <div className="range-toolbar">
        <span className="eyebrow">DATE RANGE</span>
        <div role="group" aria-label="Choose progress date range">
          {(["30", "90", "all"] as const).map((value) => (
            <button
              className={range === value ? "range-active" : ""}
              aria-pressed={range === value}
              key={value}
              onClick={() => setRange(value)}
            >
              {value === "all" ? "All" : `${value} days`}
            </button>
          ))}
        </div>
      </div>
      <section className="surface chart-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BODY MEASUREMENTS</p>
            <h2>Weight trend</h2>
          </div>
          <span className="chart-unit">{units === "metric" ? "KG" : "LB"}</span>
        </div>
        <TrendChart data={rangeMeasurements} units={units} />
      </section>
      <section className="surface chart-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STRENGTH RECORDS</p>
            <h2>Lift trend</h2>
          </div>
          {exerciseNames.length > 0 && (
            <label className="chart-filter">
              EXERCISE
              <select
                aria-label="Choose exercise for strength chart"
                value={selectedExercise || exerciseNames[0]}
                onChange={(event) => setSelectedExercise(event.target.value)}
              >
                {exerciseNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <StrengthChart data={selectedRecords} units={units} />
      </section>
      <div className="progress-grid">
        <form className="surface form-surface" onSubmit={saveMeasurement}>
          <p className="eyebrow">BODY MEASUREMENT</p>
          <h2>Log weight</h2>
          <div className="stacked-fields">
            <label>
              Date
              <input
                name="date"
                type="date"
                defaultValue={currentDate}
                required
              />
            </label>
            <label>
              Weight ({units === "metric" ? "kg" : "lb"})
              <input
                name="weight"
                type="number"
                min={units === "metric" ? "20" : "44"}
                max={units === "metric" ? "500" : "1102"}
                step="0.1"
                required
              />
            </label>
            <label>
              Body fat (%) · optional
              <input name="bodyFat" type="number" min="1" max="75" step="0.1" />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save measurement"}
          </button>
        </form>
        <form className="surface form-surface" onSubmit={saveStrength}>
          <p className="eyebrow">STRENGTH HISTORY</p>
          <h2>Log a lift</h2>
          <div className="stacked-fields">
            <label>
              Exercise
              <input
                name="exercise"
                maxLength={120}
                placeholder="e.g. Bench press"
                required
              />
            </label>
            <label>
              Date
              <input
                name="performedAt"
                type="date"
                defaultValue={currentDate}
                required
              />
            </label>
            <div className="inline-fields">
              <label>
                Load ({units === "metric" ? "kg" : "lb"})
                <input
                  name="weight"
                  type="number"
                  min="0"
                  max={units === "metric" ? "2000" : "4409"}
                  step="0.5"
                  required
                />
              </label>
              <label>
                Reps
                <input name="reps" type="number" min="1" max="100" required />
              </label>
            </div>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save strength record"}
          </button>
          {recordResult && (
            <p className="success-message" role="status">
              {recordResult}
            </p>
          )}
        </form>
      </div>
      <section className="surface history-surface">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECORDED LIFTS</p>
            <h2>Strength history</h2>
          </div>
          <span className="muted">{records.length} records</span>
        </div>
        {records.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Date</th>
                  <th>Load</th>
                  <th>Reps</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 20).map((record, index) => (
                  <tr
                    key={`${record.exercise_name}-${record.performed_at}-${index}`}
                  >
                    <td>{record.exercise_name}</td>
                    <td>{dateOnly(record.performed_at)}</td>
                    <td>
                      {displayWeight(Number(record.weight_kg), units)}{" "}
                      {units === "metric" ? "kg" : "lb"}
                    </td>
                    <td>{record.repetitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Your strength records will appear here after you log a lift.
          </p>
        )}
      </section>
      <p className="small-note">
        Charts use up to 366 recent entries per series. Personal records are
        based on the highest logged load for an exercise name. FITFORGE does not
        estimate one-rep maxes.
      </p>
    </>
  );
}
