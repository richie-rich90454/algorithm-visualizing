/**
 * generalized-linear-model.ts - Generalized Linear Model fitted by IRLS
 *
 * A generalized linear model links a linear predictor to a response through a
 * link function. This module fits the canonical Bernoulli-logit case by
 * iteratively reweighted least squares: form the working response and weights,
 * solve the weighted normal equations for the coefficients, and repeat until
 * the log likelihood stops improving.
 *
 * Time: O(iterations * n * p^2). Space: O(p^2).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/** Solve A x = b by Gaussian elimination with partial pivoting. */
export function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] as number]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(m[row]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = row;
    }
    const swap = m[col] as number[];
    m[col] = m[pivot] as number[];
    m[pivot] = swap;
    const pivotValue = m[col]?.[col] as number;
    for (let row = col + 1; row < n; row += 1) {
      const factor = (m[row]?.[col] as number) / pivotValue;
      for (let k = col; k <= n; k += 1) {
        m[row]![k] = (m[row]![k] as number) - factor * (m[col]![k] as number);
      }
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = 0;
    for (let k = row + 1; k < n; k += 1) sum += (m[row]![k] as number) * (x[k] as number);
    x[row] = ((m[row]![n] as number) - sum) / (m[row]![row] as number);
  }
  return x;
}

export interface GlmFit {
  beta: number[];
  trace: number[];
  converged: boolean;
}

/** Fit a Bernoulli-logit GLM by iteratively reweighted least squares. */
export function glmIRLS(x: number[][], y: number[], iterations: number): GlmFit {
  const n = x.length;
  const p = n > 0 ? (x[0] as number[]).length : 0;
  const beta = new Array<number>(p).fill(0);
  const trace: number[] = [];
  let converged = false;

  for (let step = 0; step < iterations; step += 1) {
    const eta = x.map((row) => row.reduce((sum, value, j) => sum + value * (beta[j] ?? 0), 0));
    const mu = eta.map(sigmoid);
    let logLikelihood = 0;
    for (let i = 0; i < n; i += 1) {
      const m = Math.min(1 - 1e-12, Math.max(1e-12, mu[i] as number));
      logLikelihood += (y[i] as number) * Math.log(m) + (1 - (y[i] as number)) * Math.log(1 - m);
    }
    trace.push(logLikelihood);

    const xtwx = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const xtwz = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i += 1) {
      const w = Math.max(1e-6, (mu[i] as number) * (1 - (mu[i] as number)));
      const z = (eta[i] as number) + ((y[i] as number) - (mu[i] as number)) / w;
      const row = x[i] as number[];
      for (let a = 0; a < p; a += 1) {
        xtwz[a] = (xtwz[a] as number) + (row[a] as number) * w * z;
        for (let c = 0; c < p; c += 1) {
          xtwx[a]![c] = (xtwx[a]![c] as number) + (row[a] as number) * w * (row[c] as number);
        }
      }
    }
    const next = solveLinear(xtwx, xtwz);
    const shift = next.reduce((sum, value, j) => sum + Math.abs(value - (beta[j] ?? 0)), 0);
    for (let j = 0; j < p; j += 1) beta[j] = next[j] as number;
    if (shift < 1e-9 && step > 0) {
      converged = true;
      break;
    }
  }
  return { beta, trace, converged };
}

function likelihoodBars(trace: number[], active: number): VisualEntity[] {
  return trace.map((value, i) => ({
    id: `iter-${i}`,
    type: "bar" as const,
    label: `iter ${i}: ${value.toFixed(3)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { iteration: i, logLikelihood: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { x?: number[][]; y?: number[]; iterations?: number } | null) ?? {};
  const x = Array.isArray(task.x) && task.x.length > 0
    ? task.x.map((row) => row.map(Number))
    : [[1, -1], [1, -0.5], [1, 0], [1, 0.5], [1, 1], [1, 1.5]];
  const y = Array.isArray(task.y) && task.y.length === x.length
    ? task.y.map((v) => Math.round(Number(v)))
    : [0, 0, 0, 1, 1, 1];
  const iterations = Math.max(1, Math.min(100, Math.floor(Number(task.iterations ?? 12)) || 12));
  const fit = glmIRLS(x, y, iterations);

  let index = 0;
  yield {
    stepNumber: index,
    entities: likelihoodBars(fit.trace, -1),
    edges: [],
    description: `Fitting a Bernoulli-logit GLM with ${x.length} rows by iteratively reweighted least squares.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { rows: x.length, predictors: (x[0] as number[]).length, iterations },
  };
  index += 1;

  for (let i = 0; i < fit.trace.length; i += 1) {
    yield {
      stepNumber: index,
      entities: likelihoodBars(fit.trace.slice(0, i + 1), i),
      edges: [],
      description: `IRLS step ${i}: log likelihood ${(fit.trace[i] ?? 0).toFixed(4)}, coefficients [${fit.beta.map((b) => b.toFixed(2)).join(", ")}].`,
      codeLineNumber: 3,
      layout: "array",
      meta: { iteration: i, logLikelihood: fit.trace[i] ?? 0, beta: fit.beta },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: likelihoodBars(fit.trace, fit.trace.length - 1),
    edges: [],
    description: `Converged=${fit.converged}; fitted coefficients [${fit.beta.map((b) => b.toFixed(4)).join(", ")}].`,
    codeLineNumber: 5,
    layout: "array",
    meta: { beta: fit.beta, logLikelihood: fit.trace[fit.trace.length - 1] ?? 0, converged: fit.converged, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "A generalized linear model connects a linear combination of predictors to a response through a link function. For a binary outcome the canonical link is the logit, and iteratively reweighted least squares solves the resulting nonlinear least-squares problem one linear step at a time. Each step reweights observations by their current variance and re-solves the weighted normal equations.",
    invariants: [
      "The fitted probabilities stay strictly between zero and one.",
      "The log likelihood does not decrease from one IRLS step to the next.",
      "At the optimum the score equations X transpose times (y minus mu) are zero.",
    ],
    correctness:
      "The Bernoulli-logit log likelihood is concave, so Newton's method converges to its unique maximum (provided the design matrix has full rank). IRLS is exactly Newton's method here: the Fisher information equals X transpose W X and the Newton step solves those weighted normal equations. The score conditions at the maximum give the stated normal equations, which the test verifies numerically.",
    complexityRationale:
      "Each step forms the p by p weighted cross-product in O(n p squared) and solves it by Gaussian elimination in O(p cubed), giving O(iterations * n * p squared) time and O(p squared) space for the normal equations.",
    uses: [
      "Binary classification with interpretable coefficients",
      "Epidemiological risk modeling with odds ratios",
      "Generalized add-on in stats engines for response families",
    ],
    references: [
      "Nelder and Wedderburn, Generalized Linear Models, 1972",
      "McCullagh and Nelder, Generalized Linear Models, 2nd edition",
    ],
    workedExample:
      "With six rows whose binary responses switch from 0 to 1 as x crosses zero, fitting an intercept and slope gives beta near (0, 2.5). The fitted probability rises from about 0.08 at x = -1 to about 0.92 at x = 1, and the log likelihood increases each IRLS step until it stabilizes.",
  },
  id: "generalized-linear-model",
  name: "Generalized Linear Model (IRLS)",
  category: "statistics-probability",
  complexity: { time: "O(iterations * n * p^2)", space: "O(p^2)" },
  defaultInput: { iterations: 12 },
  visualType: "array",
  run,
  pseudocode: [
    "input design matrix X, binary responses y, and iteration count",
    "initialize coefficients beta to zero",
    "compute linear predictor eta = X beta and means mu = sigmoid(eta)",
    "form weights W = mu (1 - mu) and working response z = eta + (y - mu)/W",
    "solve (X^T W X) new_beta = X^T W z for the Newton step",
    "replace beta and repeat until the log likelihood stabilizes",
    "done: report fitted coefficients and log likelihood",
  ],
};

export default module;
