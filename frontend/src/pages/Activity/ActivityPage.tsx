import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ActivityMinutesChart } from "../../components/charts/ActivityMinutesChart.js";
import { SleepTrendChart } from "../../components/charts/SleepTrendChart.js";
import { Notice } from "../../components/common/Notice.js";
import { PageHeading } from "../../components/common/PageHeading.js";
import { Stat } from "../../components/common/Stat.js";
import type {
  ActivityDay,
  ActivityProgressDay,
  ApiResponse,
} from "../../types/index.js";
import {
  addDays,
  dateOnly,
  formatNumber,
  today,
} from "../../utils/formatters.js";

export function ActivityPage({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<ActivityDay>({
    activities: [],
    sleep: [],
    activityMinutes: 0,
    sleepMinutes: 0,
  });
  const [weeklyProgress, setWeeklyProgress] = useState<ActivityProgressDay[]>(
    [],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const weekStart = addDays(date, -6);

  const loadDay = useCallback(async () => {
    try {
      const [dayResponse, weekResponse] = await Promise.all([
        api<ApiResponse<ActivityDay>>(`/api/v1/activity?date=${date}`),
        api<ApiResponse<ActivityProgressDay[]>>(
          `/api/v1/activity/summary?from=${weekStart}&to=${date}`,
        ),
      ]);
      setDay(dayResponse.data);
      setWeeklyProgress(weekResponse.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Activity and sleep records could not be loaded.",
      );
    }
  }, [api, date, weekStart]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/activity/activities", {
        method: "POST",
        body: JSON.stringify({
          activityDate: date,
          activityTime: fields.get("activityTime"),
          activityType: fields.get("activityType"),
          durationMinutes: Number(fields.get("durationMinutes")),
          distanceKm: fields.get("distanceKm")
            ? Number(fields.get("distanceKm"))
            : undefined,
          note: fields.get("note") || undefined,
        }),
      });
      form.reset();
      await loadDay();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Activity could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSleep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/activity/sleep", {
        method: "POST",
        body: JSON.stringify({
          sleepDate: date,
          bedtime: fields.get("bedtime"),
          wakeTime: fields.get("wakeTime"),
          note: fields.get("note") || undefined,
        }),
      });
      form.reset();
      await loadDay();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Sleep could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(path: string) {
    if (!window.confirm("Remove this record?")) return;
    setError("");
    try {
      await api(path, { method: "DELETE" });
      await loadDay();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Record could not be removed.",
      );
    }
  }

  const durationLabel = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (!hours) return `${remainingMinutes} min`;
    return remainingMinutes
      ? `${hours} hr ${remainingMinutes} min`
      : `${hours} hr`;
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR DAY, YOUR WAY"
        title="Activity & sleep"
        description="Manually log movement and sleep to see how your day adds up."
        action={
          <label className="date-control">
            DAY
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        }
      />
      {error && <Notice onRetry={() => void loadDay()}>{error}</Notice>}
      <div className="macro-grid">
        <Stat
          label="ACTIVITY"
          value={durationLabel(day.activityMinutes)}
          detail={`${day.activities.length} logged ${day.activities.length === 1 ? "activity" : "activities"}`}
        />
        <Stat
          label="SLEEP"
          value={durationLabel(day.sleepMinutes)}
          detail={`${day.sleep.length} sleep ${day.sleep.length === 1 ? "record" : "records"} · entered manually`}
        />
      </div>
      <p className="small-note">
        These are your manual entries, not automatic phone or wearable
        measurements.
      </p>
      <section className="activity-progress">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LAST 7 DAYS</p>
            <h2>Progress at a glance</h2>
          </div>
          <span className="muted">
            {dateOnly(weekStart)} – {dateOnly(date)}
          </span>
        </div>
        <div className="activity-progress-summary">
          <div>
            <span className="eyebrow">ACTIVE TIME</span>
            <b>
              {durationLabel(
                weeklyProgress.reduce(
                  (sum, entry) => sum + Number(entry.activity_minutes),
                  0,
                ),
              )}
            </b>
          </div>
          <div>
            <span className="eyebrow">AVERAGE SLEEP</span>
            <b>
              {(() => {
                const recordedNights = weeklyProgress.filter(
                  (entry) => Number(entry.sleep_count) > 0,
                );
                const minutes = recordedNights.length
                  ? Math.round(
                      recordedNights.reduce(
                        (sum, entry) => sum + Number(entry.sleep_minutes),
                        0,
                      ) / recordedNights.length,
                    )
                  : 0;
                return recordedNights.length ? durationLabel(minutes) : "—";
              })()}
            </b>
          </div>
          <div>
            <span className="eyebrow">DISTANCE</span>
            <b>
              {formatNumber(
                weeklyProgress.reduce(
                  (sum, entry) => sum + Number(entry.distance_km),
                  0,
                ),
              )}{" "}
              km
            </b>
          </div>
        </div>
        <div className="activity-chart-grid">
          <ActivityMinutesChart
            key={`activity-${weekStart}-${date}`}
            data={weeklyProgress}
          />
          <SleepTrendChart
            key={`sleep-${weekStart}-${date}`}
            data={weeklyProgress}
          />
        </div>
        <p className="small-note activity-chart-note">
          Only days with manually recorded activity or sleep are shown in the
          trend lines.
        </p>
      </section>
      <div className="activity-forms">
        <form className="surface form-surface" onSubmit={saveActivity}>
          <p className="eyebrow">MOVEMENT · {date}</p>
          <h2>Log an activity</h2>
          <div className="stacked-fields">
            <label>
              Start time
              <input
                name="activityTime"
                type="time"
                defaultValue="12:00"
                required
              />
            </label>
            <label>
              Activity
              <select name="activityType" defaultValue="walking">
                <option value="walking">Walking</option>
                <option value="running">Running</option>
                <option value="cycling">Cycling</option>
                <option value="strength">Strength training</option>
                <option value="yoga">Yoga</option>
                <option value="other">Other</option>
              </select>
            </label>
            <div className="inline-fields">
              <label>
                Duration (minutes)
                <input
                  name="durationMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  placeholder="30"
                  required
                />
              </label>
              <label>
                Distance (km, optional)
                <input
                  name="distanceKm"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                />
              </label>
            </div>
            <label>
              Note (optional)
              <input name="note" maxLength={500} placeholder="How did it go?" />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save activity"}
          </button>
        </form>
        <form className="surface form-surface" onSubmit={saveSleep}>
          <p className="eyebrow">REST · {date}</p>
          <h2>Log sleep</h2>
          <p className="muted">Choose the night that ended on this date.</p>
          <div className="stacked-fields">
            <div className="inline-fields">
              <label>
                Bedtime
                <input
                  name="bedtime"
                  type="time"
                  defaultValue="22:00"
                  required
                />
              </label>
              <label>
                Wake-up time
                <input
                  name="wakeTime"
                  type="time"
                  defaultValue="06:00"
                  required
                />
              </label>
            </div>
            <label>
              Note (optional)
              <input
                name="note"
                maxLength={500}
                placeholder="How did you sleep?"
              />
            </label>
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save sleep"}
          </button>
        </form>
      </div>
      <section className="surface activity-history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ENTRIES · {date}</p>
            <h2>Daily timeline</h2>
          </div>
        </div>
        <div className="meal-section">
          <div className="meal-section-heading">
            <div>
              <h3>Activities</h3>
              <span className="muted">
                {durationLabel(day.activityMinutes)} total
              </span>
            </div>
          </div>
          {day.activities.length ? (
            day.activities.map((activity) => (
              <article className="meal-row" key={activity.id}>
                <div className="meal-entry">
                  <b>
                    {activity.activity_type === "strength"
                      ? "Strength training"
                      : activity.activity_type}
                  </b>
                  <p className="muted">
                    {activity.activity_time.slice(0, 5)} ·{" "}
                    {durationLabel(Number(activity.duration_minutes))}
                    {activity.distance_km
                      ? ` · ${formatNumber(activity.distance_km)} km`
                      : ""}
                    {activity.note ? ` · ${activity.note}` : ""}
                  </p>
                </div>
                <span className="small-note">Manual</span>
                <button
                  className="icon-button danger-text"
                  aria-label={`Remove ${activity.activity_type} record`}
                  onClick={() =>
                    void removeRecord(
                      `/api/v1/activity/activities/${activity.id}`,
                    )
                  }
                >
                  ×
                </button>
              </article>
            ))
          ) : (
            <p className="small-note">No activities logged for this day.</p>
          )}
        </div>
        <div className="meal-section">
          <div className="meal-section-heading">
            <div>
              <h3>Sleep</h3>
              <span className="muted">
                {durationLabel(day.sleepMinutes)} total
              </span>
            </div>
          </div>
          {day.sleep.length ? (
            day.sleep.map((record) => (
              <article className="meal-row" key={record.id}>
                <div className="meal-entry">
                  <b>{durationLabel(Number(record.duration_minutes))}</b>
                  <p className="muted">
                    {record.bedtime.slice(0, 5)}–{record.wake_time.slice(0, 5)}
                    {record.note ? ` · ${record.note}` : ""}
                  </p>
                </div>
                <span className="small-note">Manual</span>
                <button
                  className="icon-button danger-text"
                  aria-label="Remove sleep record"
                  onClick={() =>
                    void removeRecord(`/api/v1/activity/sleep/${record.id}`)
                  }
                >
                  ×
                </button>
              </article>
            ))
          ) : (
            <p className="small-note">No sleep logged for this day.</p>
          )}
        </div>
      </section>
    </>
  );
}
