/**
 * benjamini-hochberg-fdr.ts - Benjamini-Hochberg False Discovery Rate Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When many hypotheses are tested at once, requiring a Bonferroni correction
 * is overly strict. The Benjamini-Hochberg procedure sorts the p-values, finds
 * the largest rank k whose p-value is at most k/m times the target FDR q, and
 * declares every hypothesis up to that rank a discovery. Under independence
 * this keeps the expected fraction of false discoveries among the rejections
 * at or below q.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m log m) for the sort, then O(m) for the step-up scan
 *   Space: O(m) for the sorted order and results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are p-values arranged in increasing order.
 *   - The rank under test is BLUE (comparing); rejected ranks end GREEN.
 *   - The threshold line k*q/m is reported in the frame caption and metadata.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { pValues?: number[]; q?: number } | null) ?? {};
  const raw = task.pValues ?? [0.001, 0.012, 0.02, 0.03, 0.08, 0.2, 0.4, 0.9];
  const pValues = raw.map((p) => Math.min(1, Math.max(0, p)));
  const q = typeof task.q === "number" ? Math.min(1, Math.max(0, task.q)) : 0.1;
  const m = pValues.length;

  const makeBars = (rankUnderTest: number, cutoff: number): VisualEntity[] =>
    order.map((entry, rank) => {
      let state: EntityState = "unvisited";
      if (rank < cutoff) state = "sorted";
      if (rank === rankUnderTest) state = "comparing";
      return {
        id: `bar-${entry.index}`,
        type: "bar" as const,
        label: `p${entry.index}=${entry.p.toFixed(3)}`,
        value: entry.p,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: rank, originalIndex: entry.index, p: entry.p },
      };
    });

  let index = 0;
  if (m === 0) {
    yield {
      stepNumber: index,
      entities: [],
      edges: [],
      description: "No p-values supplied, so there are no hypotheses to test.",
      codeLineNumber: 0,
      layout: "array",
      meta: { q, m: 0, rejections: 0, threshold: 0, rejected: [] },
    };
    return;
  }

  const order = pValues
    .map((p, i) => ({ p, index: i }))
    .sort((a, b) => a.p - b.p || a.index - b.index);

  yield {
    stepNumber: index,
    entities: makeBars(-1, 0),
    edges: [],
    description: `Sorting ${m} p-values in increasing order for BH control at q=${q}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { q, m, sortedP: order.map((e) => e.p) },
  };
  index += 1;

  let largest = 0;
  for (let r = 0; r < m; r += 1) {
    const rank = r + 1;
    const p = order[r]?.p as number;
    const threshold = (rank / m) * q;
    const passes = p <= threshold;
    if (passes) largest = rank;
    yield {
      stepNumber: index,
      entities: makeBars(r, largest),
      edges: [],
      description: `Rank ${rank}: p=${p.toFixed(4)} versus BH line ${((rank / m) * q).toFixed(4)}; ${passes ? "passes, cutoff advances to rank " + largest : "fails, cutoff stays at rank " + largest}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { q, m, rank, p, line: threshold, passes, cutoffRank: largest },
    };
    index += 1;
  }

  const threshold = largest > 0 ? (order[largest - 1]?.p as number) : 0;
  const rejected = largest > 0 ? order.slice(0, largest).map((e) => e.index).sort((a, b) => a - b) : [];
  yield {
    stepNumber: index,
    entities: makeBars(-1, largest),
    edges: [],
    description:
      largest > 0
        ? `Reject ${largest} of ${m} hypotheses at p-value cutoff ${threshold.toFixed(4)} (BH line at rank ${largest}).`
        : `Reject no hypotheses at q=${q}; no rank clears its BH line.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { q, m, threshold, rejections: largest, rejected, cutoffRank: largest },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Testing hundreds of hypotheses with a strict familywise correction throws away real effects. The Benjamini-Hochberg procedure is a step-up rule: sort the p-values, compare each one to a line that rises with its rank, and accept every hypothesis up to the largest rank that falls below that line. Because weak signals are tested at looser thresholds, more discoveries survive while false discoveries stay controlled on average.",
    invariants: [
      "P-values are sorted in nondecreasing order before the scan.",
      "The BH line at rank k is k divided by the number of tests, times the target rate q.",
      "The rejected set is always a prefix of the sorted p-values.",
    ],
    correctness:
      "Let k be the largest rank with p_(k) at most kq/m. Every rejected p-value is at most p_(k), which is at most kq/m, so the ratio of false rejections to total rejections has expectation at most q times m_0/m, which is no greater than q under independence. The step-up choice of the largest qualifying rank makes the procedure more powerful than step-down alternatives while preserving this bound.",
    complexityRationale:
      "Sorting m p-values dominates at O(m log m), and the single left-to-right scan with an integer rank costs O(m). The sorted array and the rejected index list use O(m) additional space.",
    uses: [
      "Genomics and proteomics differential-expression screens",
      "A/B test families with many simultaneous metrics",
      "Any large batch of significance tests where some false positives are tolerable",
    ],
    references: [
      "Benjamini and Hochberg, Controlling the False Discovery Rate, Journal of the Royal Statistical Society B, 1995",
      "Benjamini and Yekutieli, The Control of the False Discovery Rate in Multiple Testing Under Dependency, 2001",
    ],
    workedExample:
      "With p-values 0.001, 0.012, 0.02, 0.03, 0.08, 0.2, 0.4, 0.9 and q=0.1 over eight tests, the BH lines are 0.0125, 0.025, and so on. Ranks one through three pass while rank four does not, so the cutoff is 0.02 and three hypotheses are declared discoveries.",
  },
  id: "benjamini-hochberg-fdr",
  name: "Benjamini-Hochberg FDR",
  category: "statistics-probability",
  complexity: { time: "O(m log m)", space: "O(m)" },
  defaultInput: {
    pValues: [0.001, 0.012, 0.02, 0.03, 0.08, 0.2, 0.4, 0.9],
    q: 0.1,
  },
  visualType: "array",
  run,
  pseudocode: [
    "input m p-values and target false discovery rate q",
    "sort the p-values in increasing order and keep original indices",
    "for each rank k from 1 to m compare p(k) with k*q/m",
    "track the largest rank whose p-value clears its line",
    "reject every hypothesis up to that largest qualifying rank",
    "done: report the p-value cutoff and the rejected hypotheses",
  ],
};

export default module;
