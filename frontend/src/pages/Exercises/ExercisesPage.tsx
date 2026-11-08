import { useCallback, useEffect, useState } from "react";
import { Empty } from "../../components/common/Empty.js";
import { Notice } from "../../components/common/Notice.js";
import { PageHeading } from "../../components/common/PageHeading.js";
import type { ApiResponse, Exercise } from "../../types/index.js";

export function ExercisesPage({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api<ApiResponse<Exercise[]>>(
        "/api/v1/exercises?limit=100",
      );
      setExercises(result.data);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Exercises could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = exercises.filter((exercise) =>
    `${exercise.name} ${exercise.muscleGroups.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeading
        eyebrow="MOVE WITH PURPOSE"
        title="Exercise library"
        description="Browse movement details from the FITFORGE catalogue."
      />
      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search exercises"
            placeholder="Search by movement or muscle"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="muted">{shown.length} movements</span>
      </div>
      {error && (
        <Notice
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        >
          {error}
        </Notice>
      )}
      {loading ? (
        <p className="muted">Loading exercises…</p>
      ) : shown.length ? (
        <div className="exercise-grid">
          {shown.map((exercise) => (
            <article className="exercise-card" key={exercise._id}>
              <div className={`movement-chip ${exercise.movementType}`}>
                {exercise.movementType}
              </div>
              <div className="exercise-meta">
                {exercise.difficulty} ·{" "}
                {exercise.equipment.join(", ") || "No equipment listed"}
              </div>
              <h2>{exercise.name}</h2>
              <p>{exercise.description}</p>
              <div className="tag-row">
                {exercise.muscleGroups.map((muscle) => (
                  <span className="tag" key={muscle}>
                    {muscle}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface">
          <Empty
            text={
              search
                ? "No movements match that search."
                : "The exercise catalogue is empty right now."
            }
            action={search ? "Clear search" : "Try again"}
            onClick={() => (search ? setSearch("") : void load())}
          />
        </div>
      )}
    </>
  );
}
