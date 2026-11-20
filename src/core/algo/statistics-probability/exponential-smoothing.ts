/**
 * exponential-smoothing.ts - Simple Exponential Smoothing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Simple exponential smoothing forecasts a univariate series with a single
 * recursively updated level. The next level is a weighted average of the
 * newest observation and the previous level, with weight alpha on the new
 * value. Equivalently, the forecast is an exponentially decaying weighted
 * average of every past observation, which makes the method cheap and reactive
 * for series with no trend or seasonality.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n observations
 *   Space: O(n) for the level trace and rendered points
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grey points are the raw observations at each time index.
 *   - Green points are the smoothed level, added one time step at a time.
 *   - The final caption reports the next-step forecast and forecast error.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { series?: number[]; alpha?: number } | null) ?? {};
  const series = task.series ?? [3, 5, 4, 7, 6, 8, 7, 9, 10, 8];
  const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.4;

  const levels: number[] = series.length > 0 ? [series[0] as number] : [];
  for (let t = 1; t < series.length; t += 1) {
    levels.push(alpha * (series[t] as number) + (1 - alpha) * (levels[t - 1] as number));
  }

  const makePoints = (revealed: number): VisualEntity[] => {
    const entities: VisualEntity[] = series.map((value, t) => ({
      id: `obs-${t}`,
      type: "node" as const,
      label: value.toFixed(2),
      value,
      state: "unvisited" as EntityState,
      x: t,
      y: value,
      width: 0,
      height: 0,
      metadata: { kind: "observation", t },
    }));
    for (let t = 0; t < revealed; t += 1) {
      entities.push({
        id: `level-${t}`,
        type: "node" as const,
        label: (levels[t] as number).toFixed(2),
        value: levels[t] as number,
        state: t === revealed - 1 ? "active" : "sorted",
        x: t,
        y: levels[t] as number,
        width: 0,
        height: 0,
        metadata: { kind: "level", t },
      });
    }
    return entities;
  };

  let index = 0;
  yield {
    stepNumber: index,
    entities: makePoints(0),
    edges: [],
    description: `Observed ${series.length} values; start the smoothed level at ${series[0] ?? 0} with alpha ${alpha}.`,
    codeLineNumber: 0,
    layout: "point",
    meta: { alpha, n: series.length, levels: [] },
  };
  index += 1;

  for (let t = 0; t < series.length; t += 1) {
    const previous = t === 0 ? null : (levels[t - 1] as number);
    const level = levels[t] as number;
    yield {
      stepNumber: index,
      entities: makePoints(t + 1),
      edges: [],
      description:
        t === 0
          ? `Time 0 initializes the level to the first observation ${level.toFixed(4)}.`
          : `Time ${t}: observation ${(series[t] as number).toFixed(4)}, previous level ${previous?.toFixed(4)}, new level ${level.toFixed(4)}.`,
      codeLineNumber: t === 0 ? 1 : 2,
      layout: "point",
      meta: { alpha, t, observation: series[t] as number, previousLevel: previous ?? 0, level },
    };
    index += 1;
  }

  let sse = 0;
  for (let t = 1; t < series.length; t += 1) {
    const error = (series[t] as number) - (levels[t - 1] as number);
    sse += error * error;
  }
  const forecast = levels[levels.length - 1] ?? 0;
  yield {
    stepNumber: index,
    entities: makePoints(series.length),
    edges: [],
    description: `Next-step forecast ${forecast.toFixed(4)}; one-step sum of squared errors ${sse.toFixed(4)}.`,
    codeLineNumber: 5,
    layout: "point",
    meta: { alpha, forecast, sse, levels, n: series.length },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Simple exponential smoothing keeps one running estimate of the current level. Each new observation pulls that level partway toward itself, with the smoothing constant deciding how much. A large alpha follows the data closely; a small alpha ignores noise and reacts slowly. Because the recursion unrolls into a weighted average of all past observations with geometrically shrinking weights, one number summarizes the whole history.",
    invariants: [
      "The level always lies between the previous level and the current observation for alpha in [0,1].",
      "The forecast for time t+1 equals the level computed at time t.",
      "The weights on past observations form a geometric series that sums to one in the infinite limit.",
    ],
    correctness:
      "Unrolling the recursion gives level_t equals alpha times the sum of series at time i weighted by (1-alpha) to the t-i power, plus the initialization term. The weights sum to one in the limit, so the level is a genuine weighted average. Setting alpha to one reproduces the latest observation and setting it to zero freezes the level, both matching the limiting interpretations.",
    complexityRationale:
      "Each observation performs one multiply-add, so fitting the levels takes O(n) time. Storing one level per observation for the plot and reporting uses O(n) space, which could be reduced to O(1) if only the final forecast were needed.",
    uses: [
      "Short-term demand and inventory forecasting",
      "Smoothing noisy sensor readings in control systems",
      "Baseline forecasts that more elaborate models must beat",
    ],
    references: [
      "Brown, Exponential Smoothing for Predicting Demand, 1956",
      "Holt, Forecasting Seasonals and Trends by Exponentially Weighted Moving Averages, 1957",
    ],
    workedExample:
      "For the series 3, 5, 4 with alpha 0.4, the first level is 3. The second is 0.4*5 + 0.6*3 = 3.8. The third is 0.4*4 + 0.6*3.8 = 3.88, which is also the forecast for the next period. The one-step errors are 5-3 = 2 and 4-3.8 = 0.2.",
  },
  id: "exponential-smoothing",
  name: "Exponential Smoothing",
  category: "statistics-probability",
  complexity: { time: "O(n)", space: "O(n)" },
  defaultInput: { series: [3, 5, 4, 7, 6, 8, 7, 9, 10, 8], alpha: 0.4 },
  visualType: "point",
  run,
  pseudocode: [
    "input series x[0..n-1] and smoothing constant alpha",
    "set level[0] to x[0] as the initial level",
    "for each later time t compute level[t] = alpha*x[t] + (1-alpha)*level[t-1]",
    "treat level[t] as the forecast for time t+1",
    "accumulate squared one-step forecast errors",
    "done: report the final level as the next forecast and the error total",
  ],
};

export default module;
