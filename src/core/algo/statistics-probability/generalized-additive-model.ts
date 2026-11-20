/**
 * generalized-additive-model.ts - Generalized Additive Model by Backfitting
 *
 * A generalized additive model replaces a single linear combination with a sum
 * of flexible univariate functions, one per predictor. Backfitting estimates
 * each function in turn by smoothing the residual left by all the others, then
 * cycles until the residual sum of squares stabilizes. This captures nonlinear
 * effects while keeping the model interpretable one feature at a time.
 *
 * Time: O(iterations * predictors * n log n). Space: O(predictors * n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Smooth a response by averaging residuals inside equal-count x bins. */
export function binSmoother(xs: number[], residuals: number[], bins: number): number[] {
  const n = xs.length;
  const count = Math.max(2, Math.min(n, Math.floor(bins)));
  const order = xs.map((_, i) => i).sort((a, b) => (xs[a] as number) - (xs[b] as number));
  const binOf = new Array<number>(n).fill(0);
  for (let rank = 0; rank < n; rank += 1) {
    const index = order[rank] as number;
    binOf[index] = Math.min(count - 1, Math.floor((rank * count) / n));
  }
  const sums = new Array<number>(count).fill(0);
  const sizes = new Array<number>(count).fill(0);
  for (let i = 0; i < n; i += 1) {
    const bin = binOf[i] as number;
    sums[bin] = (sums[bin] as number) + (residuals[i] as number);
    sizes[bin] = (sizes[bin] as number) + 1;
  }
  const means = sums.map((sum, i) => ((sizes[i] as number) > 0 ? sum / (sizes[i] as number) : 0));
  return binOf.map((bin) => means[bin] as number);
}

export interface GamFit {
  components: number[][];
  fitted: number[];
  rssTrace: number[];
}

/** Fit an additive model by cyclic backfitting of binned smoothers. */
export function gamBackfit(x: number[][], y: number[], bins: number, iterations: number): GamFit {
  const n = y.length;
  const p = n > 0 ? (x[0] as number[]).length : 0;
  const components = Array.from({ length: p }, () => new Array<number>(n).fill(0));
  const rssTrace: number[] = [];

  for (let step = 0; step < iterations; step += 1) {
    for (let j = 0; j < p; j += 1) {
      const column = x.map((row) => row[j] as number);
      const residual = y.map((target, i) => {
        let rest = 0;
        for (let k = 0; k < p; k += 1) {
          if (k !== j) rest += components[k]?.[i] ?? 0;
        }
        return target - rest;
      });
      components[j] = binSmoother(column, residual, bins);
    }
    const fitted = y.map((_, i) => components.reduce((sum, comp) => sum + (comp[i] ?? 0), 0));
    const rss = y.reduce((sum, target, i) => sum + (target - (fitted[i] as number)) ** 2, 0);
    rssTrace.push(rss);
  }

  const fitted = y.map((_, i) => components.reduce((sum, comp) => sum + (comp[i] ?? 0), 0));
  return { components, fitted, rssTrace };
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `row-${i}`,
    type: "bar" as const,
    label: `row ${i}: ${value.toFixed(2)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { row: i, fitted: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { x?: number[][]; y?: number[]; bins?: number; iterations?: number } | null) ?? {};
  const x = Array.isArray(task.x) && task.x.length > 0
    ? task.x.map((row) => row.map(Number))
    : Array.from({ length: 40 }, (_, i) => {
        const value = -3 + (6 * i) / 39;
        return [value, Math.sin(value)];
      });
  const y = Array.isArray(task.y) && task.y.length === x.length
    ? task.y.map(Number)
    : x.map((row) => Math.sin((row[0] as number) * 1.2) + 0.8 * (row[1] as number));
  const bins = Math.max(2, Math.min(20, Math.floor(Number(task.bins ?? 8)) || 8));
  const iterations = Math.max(1, Math.min(30, Math.floor(Number(task.iterations ?? 6)) || 6));
  const fit = gamBackfit(x, y, bins, iterations);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(fit.fitted, -1),
    edges: [],
    description: `Backfitting a ${(x[0] as number[]).length}-feature additive model on ${y.length} rows.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { rows: y.length, predictors: (x[0] as number[]).length, bins, iterations },
  };
  index += 1;

  const shown = Math.min(iterations, 10);
  for (let i = 0; i < shown; i += 1) {
    yield {
      stepNumber: index,
      entities: bars(fit.fitted, i),
      edges: [],
      description: `Backfit cycle ${i}: residual sum of squares ${(fit.rssTrace[i] as number).toFixed(4)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { cycle: i, rss: fit.rssTrace[i] as number },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(fit.fitted, fit.fitted.length - 1),
    edges: [],
    description: `Final residual sum of squares ${(fit.rssTrace.at(-1) as number).toFixed(4)} across additive components.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { rss: fit.rssTrace.at(-1) as number, rssTrace: fit.rssTrace, fitted: fit.fitted, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "An additive model keeps the interpretability of a linear model but lets each predictor contribute an arbitrary smooth curve. Backfitting learns those curves one at a time: hold all other curves fixed, smooth the leftover residual against the current feature, and cycle through features until nothing changes much.",
    invariants: [
      "Each fitted value is the sum of one component per predictor.",
      "The residual sum of squares does not increase across backfitting cycles.",
      "Each component is a stepwise-smooth function of its own predictor only.",
    ],
    correctness:
      "Each backfitting update chooses the component that minimizes the residual sum of squares given the other components, because a binwise mean is the least-squares constant for its bin. Alternating exact conditional minimizations cannot increase the objective, so the residual sum of squares decreases monotonically to a stationary point. The final fit is additive by construction since it is the sum of the fitted components.",
    complexityRationale:
      "One feature update sorts its column in O(n log n) and averages bins in O(n); over predictors and cycles that is O(iterations * predictors * n log n) time and O(predictors * n) space for the components.",
    uses: [
      "Modeling nonlinear ecological and environmental responses",
      "Interpretable risk scores in actuarial science",
      "Exploratory regression where effects are nonlinear but additive",
    ],
    references: [
      "Hastie and Tibshirani, Generalized Additive Models, 1990",
      "Wood, Generalized Additive Models: An Introduction with R, 2nd edition",
    ],
    workedExample:
      "Given rows with predictors x1 evenly spaced from -3 to 3 and x2 = sin(x1), and response y = sin(1.2 x1) + 0.8 sin(x1), backfitting assigns a curved component to x1 and a near-linear component to x2. The residual sum of squares drops sharply after the first cycle and then levels off, showing the additive structure has been recovered.",
  },
  id: "generalized-additive-model",
  name: "Generalized Additive Model",
  category: "statistics-probability",
  complexity: { time: "O(iterations * predictors * n log n)", space: "O(predictors * n)" },
  defaultInput: { bins: 8, iterations: 6 },
  visualType: "array",
  run,
  pseudocode: [
    "input predictor matrix, response, bin count, and cycle count",
    "initialize every additive component to zero",
    "for each predictor form the residual with all other components removed",
    "smooth that residual against the predictor by averaging within bins",
    "replace the component with the smoothed values",
    "after a full cycle record the residual sum of squares",
    "done: report fitted values and the error trace",
  ],
};

export default module;
