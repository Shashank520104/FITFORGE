type LoggedSet = {
  actualReps?: number | null;
  actualWeight?: number | null;
  completedAt?: Date | string | null;
};

type SessionExercise = {
  exerciseId: string;
  exerciseName: string;
  sets: LoggedSet[];
};

type CompletedSession = {
  _id: { toString(): string } | string;
  startedAt: Date | string;
  exercises: SessionExercise[];
};

type ExercisePerformance = {
  exerciseId: string;
  exerciseName: string;
  sessionId: string;
  performedAt: string;
  completedSets: number;
  volumeKg: number;
  topSet: { weightKg: number; reps: number };
};

export type WorkoutInsight = {
  exerciseId: string;
  exerciseName: string;
  direction: "new" | "up" | "steady" | "down";
  changePercent: number | null;
  latest: ExercisePerformance;
  previous: ExercisePerformance | null;
};

function sessionId(session: CompletedSession): string {
  return session._id.toString();
}

function performanceFrom(
  session: CompletedSession,
  exercise: SessionExercise,
): ExercisePerformance | null {
  const completedSets = exercise.sets.filter(
    (set) =>
      set.completedAt &&
      Number.isFinite(set.actualReps) &&
      Number.isFinite(set.actualWeight),
  );
  if (!completedSets.length) return null;

  const validSets = completedSets.filter(
    (set): set is LoggedSet & { actualReps: number; actualWeight: number } =>
      Number.isFinite(set.actualReps) && Number.isFinite(set.actualWeight),
  );
  const topSet = validSets.reduce(
    (top, set) =>
      set.actualWeight > top.actualWeight ||
      (set.actualWeight === top.actualWeight && set.actualReps > top.reps)
        ? { actualWeight: set.actualWeight, reps: set.actualReps }
        : top,
    { actualWeight: 0, reps: 0 },
  );

  return {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    sessionId: sessionId(session),
    performedAt: new Date(session.startedAt).toISOString(),
    completedSets: validSets.length,
    volumeKg: validSets.reduce(
      (total, set) => total + set.actualWeight * set.actualReps,
      0,
    ),
    topSet: { weightKg: topSet.actualWeight, reps: topSet.reps },
  };
}

export function buildWorkoutInsights(
  sessions: CompletedSession[],
): WorkoutInsight[] {
  const performances = new Map<string, ExercisePerformance[]>();

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const performance = performanceFrom(session, exercise);
      if (!performance) continue;

      const history = performances.get(exercise.exerciseId) ?? [];
      if (history.some((entry) => entry.sessionId === performance.sessionId)) {
        continue;
      }
      history.push(performance);
      performances.set(exercise.exerciseId, history);
    }
  }

  return [...performances.values()]
    .map(([latest, previous]) => {
      if (!previous) {
        return {
          exerciseId: latest.exerciseId,
          exerciseName: latest.exerciseName,
          direction: "new" as const,
          changePercent: null,
          latest,
          previous: null,
        };
      }

      const direction: WorkoutInsight["direction"] =
        latest.volumeKg > previous.volumeKg
          ? "up"
          : latest.volumeKg < previous.volumeKg
            ? "down"
            : "steady";
      const changePercent =
        previous.volumeKg > 0
          ? Math.round(
              ((latest.volumeKg - previous.volumeKg) / previous.volumeKg) *
                1000,
            ) / 10
          : null;

      return {
        exerciseId: latest.exerciseId,
        exerciseName: latest.exerciseName,
        direction,
        changePercent,
        latest,
        previous,
      };
    })
    .sort((first, second) =>
      first.exerciseName.localeCompare(second.exerciseName),
    );
}
