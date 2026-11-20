/**
 * scheffe-method.ts - Scheffe's Simultaneous Comparison Method
 *
 * After a one-way ANOVA, Scheffe's method builds confidence intervals that
 * cover every possible contrast at once with probability 1 - alpha. For two
 * groups the interval for a difference of means is
 * (mean_i - mean_j) plus or minus sqrt((k-1) F_{k-1, N-k, 1-alpha} MSE (1/n_i + 1/n_j)).
 * The F quantile is supplied as input so the method stays deterministic.
 *
 * Time: O(k^2) for all pairwise intervals. Space: O(k^2).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface ScheffeInput {
  means: number[];
  sampleSizes: number[];
  mse: number;
  fCritical: number;
  tCritical?: number;
}

export interface ScheffeInterval {
  i: number;
  j: number;
  difference: number;
  halfWidth: number;
  lower: number;
  upper: number;
  tHalfWidth: number;
}

export function scheffeHalfWidth(
  mse: number,
  nI: number,
  nJ: number,
  groups: number,
  fCritical: number,
): number {
  const dfNumerator = Math.max(1, groups - 1);
  return Math.sqrt(dfNumerator * fCritical * mse * (1 / nI + 1 / nJ));
}

export function scheffePairwise(input: ScheffeInput): ScheffeInterval[] {
  const means = input.means;
  const sizes = input.sampleSizes;
  const k = means.length;
  const result: ScheffeInterval[] = [];
  for (let i = 0; i < k; i += 1) {
    for (let j = i + 1; j < k; j += 1) {
      const difference = (means[i] ?? 0) - (means[j] ?? 0);
      const halfWidth = scheffeHalfWidth(input.mse, sizes[i] ?? 1, sizes[j] ?? 1, k, input.fCritical);
      const tHalfWidth = Math.sqrt(
        (input.tCritical ?? 2) ** 2 * input.mse * (1 / (sizes[i] ?? 1) + 1 / (sizes[j] ?? 1)),
      );
      result.push({
        i,
        j,
        difference,
        halfWidth,
        lower: difference - halfWidth,
        upper: difference + halfWidth,
        tHalfWidth,
      });
    }
  }
  return result;
}

function bars(intervals: ScheffeInterval[], active: number): VisualEntity[] {
  return intervals.map((interval, i) => {
    let state: EntityState = "unvisited";
    if (i < active) state = "sorted";
    if (i === active) state = "comparing";
    return {
      id: `pair-${i}`,
      type: "bar" as const,
      label: `g${interval.i}-g${interval.j}: ${interval.difference.toFixed(2)} +/- ${interval.halfWidth.toFixed(2)}`,
      value: interval.halfWidth,
      state,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { i: interval.i, j: interval.j, lower: interval.lower, upper: interval.upper },
    };
  });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as Partial<ScheffeInput> | null) ?? {};
  const means = Array.isArray(task.means) && task.means.length >= 2 ? task.means.map(Number) : [4, 5, 6, 5.5];
  const sampleSizes = Array.isArray(task.sampleSizes) && task.sampleSizes.length === means.length
    ? task.sampleSizes.map((n) => Math.max(1, Math.floor(Number(n))))
    : means.map(() => 10);
  const mse = Number(task.mse) > 0 ? Number(task.mse) : 2;
  const fCritical = Number(task.fCritical) > 0 ? Number(task.fCritical) : 3.24;
  const tCritical = Number(task.tCritical) > 0 ? Number(task.tCritical) : 2.06;
  const intervals = scheffePairwise({ means, sampleSizes, mse, fCritical, tCritical });

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(intervals, -1),
    edges: [],
    description: `Scheffe method for ${means.length} group means with MSE ${mse} and F critical ${fCritical}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { groups: means.length, mse, fCritical, tCritical, pairs: intervals.length },
  };
  index += 1;

  for (let i = 0; i < intervals.length; i += 1) {
    const interval = intervals[i] as ScheffeInterval;
    yield {
      stepNumber: index,
      entities: bars(intervals, i),
      edges: [],
      description: `Groups ${interval.i} and ${interval.j}: difference ${interval.difference.toFixed(3)}, simultaneous interval [${interval.lower.toFixed(3)}, ${interval.upper.toFixed(3)}].`,
      codeLineNumber: 2,
      layout: "array",
      meta: {
        i: interval.i,
        j: interval.j,
        difference: interval.difference,
        halfWidth: interval.halfWidth,
        lower: interval.lower,
        upper: interval.upper,
      },
    };
    index += 1;
  }

  const significant = intervals.filter((v) => v.lower > 0 || v.upper < 0).length;
  yield {
    stepNumber: index,
    entities: bars(intervals, intervals.length),
    edges: [],
    description: `All ${intervals.length} pairwise contrasts covered simultaneously; ${significant} exclude zero.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { significant, total: intervals.length, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Running many t-tests inflates the chance of at least one false positive. Scheffe's method replaces them with intervals wide enough that the whole family of contrasts is covered at once. The price is wider intervals, controlled by the F statistic with k minus one degrees of freedom, but the method stays valid even for contrasts chosen after looking at the data.",
    invariants: [
      "Every interval is centered on the observed contrast estimate.",
      "Half-widths grow with the mean square error and with group-count terms.",
      "For two groups the Scheffe interval matches the t interval when F equals t squared.",
    ],
    correctness:
      "Scheffe's theorem applies the F distribution to the projected variation among k group means. For any contrast c, the squared standardized estimate divided by MSE times the sum of c squared over sample sizes is at most (k-1) F with probability 1 - alpha, uniformly over all c. Setting the interval half-width to the square-root of that bound therefore covers every contrast simultaneously.",
    complexityRationale:
      "There are k choose two unordered group pairs, each needing constant arithmetic, so the method costs O(k squared) time and O(k squared) space to display all intervals.",
    uses: [
      "Post-hoc comparison of treatment means after ANOVA",
      "Simultaneous confidence bands in designed experiments",
      "Checking arbitrary data-snooped contrasts without inflating error rate",
    ],
    references: [
      "Scheffe, The Analysis of Variance, 1959",
      "Miller, Simultaneous Statistical Inference, 2nd edition",
    ],
    workedExample:
      "With four groups, MSE 2, ten observations each and F critical 3.24, the degrees of freedom numerator is 3. The half-width for any pair is sqrt(3 * 3.24 * 2 * (1/10 + 1/10)), about 1.97. A mean difference of 1 then gives the interval [-0.97, 2.97], which includes zero.",
  },
  id: "scheffe-method",
  name: "Scheffe Method",
  category: "statistics-probability",
  complexity: { time: "O(k^2)", space: "O(k^2)" },
  defaultInput: {
    means: [4, 5, 6, 5.5],
    sampleSizes: [10, 10, 10, 10],
    mse: 2,
    fCritical: 3.24,
    tCritical: 2.06,
  },
  visualType: "array",
  run,
  pseudocode: [
    "input k group means, sample sizes, MSE, and F critical value",
    "set degrees of freedom numerator to k - 1",
    "for each unordered pair of groups form the difference of means",
    "set half width to sqrt((k-1) F MSE (1/n_i + 1/n_j))",
    "form the interval from difference minus to difference plus half width",
    "flag an interval significant when it excludes zero",
    "done: report all simultaneous pairwise intervals",
  ],
};

export default module;
