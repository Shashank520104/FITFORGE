import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWorkoutInsights } from "./services/workoutInsights.js";

test("compares the two latest completed sessions using logged volume", () => {
  const insights = buildWorkoutInsights([
    {
      _id: "latest",
      startedAt: "2026-10-27T10:00:00.000Z",
      exercises: [
        {
          exerciseId: "squat",
          exerciseName: "Back squat",
          sets: [
            { actualReps: 8, actualWeight: 50, completedAt: "2026-10-27" },
            { actualReps: 8, actualWeight: 50, completedAt: "2026-10-27" },
            { actualReps: 8, actualWeight: 50 },
          ],
        },
      ],
    },
    {
      _id: "previous",
      startedAt: "2026-10-20T10:00:00.000Z",
      exercises: [
        {
          exerciseId: "squat",
          exerciseName: "Back squat",
          sets: [
            { actualReps: 8, actualWeight: 45, completedAt: "2026-10-20" },
            { actualReps: 8, actualWeight: 45, completedAt: "2026-10-20" },
          ],
        },
      ],
    },
  ]);

  assert.equal(insights.length, 1);
  assert.equal(insights[0].direction, "up");
  assert.equal(insights[0].changePercent, 11.1);
  assert.equal(insights[0].latest.completedSets, 2);
  assert.equal(insights[0].latest.volumeKg, 800);
  assert.deepEqual(insights[0].latest.topSet, { weightKg: 50, reps: 8 });
  assert.equal(insights[0].previous?.volumeKg, 720);
});

test("reports new, steady, and down trends without inventing comparisons", () => {
  const session = (
    id: string,
    startedAt: string,
    exerciseId: string,
    weight: number,
  ) => ({
    _id: id,
    startedAt,
    exercises: [
      {
        exerciseId,
        exerciseName: exerciseId,
        sets: [{ actualReps: 5, actualWeight: weight, completedAt: startedAt }],
      },
    ],
  });

  const insights = buildWorkoutInsights([
    session("new", "2026-10-27T10:00:00.000Z", "New lift", 10),
    session("steady-latest", "2026-10-27T09:00:00.000Z", "Steady lift", 20),
    session("down-latest", "2026-10-27T08:00:00.000Z", "Down lift", 15),
    session("steady-previous", "2026-10-20T09:00:00.000Z", "Steady lift", 20),
    session("down-previous", "2026-10-20T08:00:00.000Z", "Down lift", 20),
  ]);

  assert.deepEqual(
    insights.map(({ exerciseName, direction, changePercent }) => ({
      exerciseName,
      direction,
      changePercent,
    })),
    [
      { exerciseName: "Down lift", direction: "down", changePercent: -25 },
      { exerciseName: "New lift", direction: "new", changePercent: null },
      { exerciseName: "Steady lift", direction: "steady", changePercent: 0 },
    ],
  );
});
