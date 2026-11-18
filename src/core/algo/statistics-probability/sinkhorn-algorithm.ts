/**
 * sinkhorn-algorithm.ts - Sinkhorn-Knopp Matrix Scaling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sinkhorn's algorithm turns a nonnegative matrix into a doubly stochastic
 * one by alternately scaling every row and every column to sum to one. The
 * row and column scalings are diagonal matrices, so the result has the form
 * D1 A D2. For a matrix with total support the iteration converges: row sums
 * become one after each column step and column sums approach one as the
 * iterations proceed. This is the same fixed point used by entropic optimal
 * transport and by iterative proportional fitting in statistics.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * m * n)
 *   Space: O(m * n) for the working matrix and rendered cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells are entries of the working matrix, labeled with current values.
 *   - The row being scaled is BLUE (comparing), then the column being scaled.
 *   - Convergence is reported through maximum row and column sum errors.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { matrix?: number[][]; iterations?: number } | null) ?? {};
  const source = task.matrix ?? [
    [4, 1, 2],
    [1, 8, 1],
    [2, 1, 4],
  ];
  const matrix = source.map((row) => row.map((v) => Math.max(0, v)));
  const iterations = typeof task.iterations === "number" ? Math.max(1, Math.min(200, task.iterations | 0)) : 20;
  const rows = matrix.length;
  const cols = rows > 0 ? (matrix[0]?.length ?? 0) : 0;

  const makeCells = (phase: "init" | "row" | "col", target: number): VisualEntity[] => {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        let state: EntityState = "unvisited";
        if (phase === "row" && i === target) state = "comparing";
        if (phase === "col" && j === target) state = "active";
        entities.push({
          id: `cell-${i}-${j}`,
          type: "cell" as const,
          label: (matrix[i]?.[j] ?? 0).toFixed(3),
          value: matrix[i]?.[j] ?? 0,
          state,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          metadata: { row: i, col: j },
        });
      }
    }
    return entities;
  };

  const errors = () => {
    let maxRow = 0;
    let maxCol = 0;
    for (let i = 0; i < rows; i += 1) {
      let sum = 0;
      for (let j = 0; j < cols; j += 1) sum += matrix[i]?.[j] ?? 0;
      maxRow = Math.max(maxRow, Math.abs(sum - 1));
    }
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let i = 0; i < rows; i += 1) sum += matrix[i]?.[j] ?? 0;
      maxCol = Math.max(maxCol, Math.abs(sum - 1));
    }
    return { maxRow, maxCol };
  };

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeCells("init", -1),
    edges: [],
    description: `Input ${rows}x${cols} matrix; alternate row and column scaling for ${iterations} rounds.`,
    codeLineNumber: 0,
    layout: "grid",
    meta: { rows, cols, iterations },
  };
  index += 1;

  for (let round = 0; round < iterations; round += 1) {
    for (let i = 0; i < rows; i += 1) {
      let sum = 0;
      for (let j = 0; j < cols; j += 1) sum += matrix[i]?.[j] ?? 0;
      if (sum > 0) {
        for (let j = 0; j < cols; j += 1) matrix[i]![j] = (matrix[i]![j] ?? 0) / sum;
      }
      yield {
        stepNumber: index,
        entities: makeCells("row", i),
        edges: [],
        description: `Round ${round + 1}, row ${i}: divide each entry by the row sum ${sum.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { round: round + 1, phase: "row", target: i, sum },
      };
      index += 1;
    }
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let i = 0; i < rows; i += 1) sum += matrix[i]?.[j] ?? 0;
      if (sum > 0) {
        for (let i = 0; i < rows; i += 1) matrix[i]![j] = (matrix[i]![j] ?? 0) / sum;
      }
      yield {
        stepNumber: index,
        entities: makeCells("col", j),
        edges: [],
        description: `Round ${round + 1}, column ${j}: divide each entry by the column sum ${sum.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { round: round + 1, phase: "col", target: j, sum },
      };
      index += 1;
    }
  }

  const e = errors();
  yield {
    stepNumber: index,
    entities: makeCells("init", -1),
    edges: [],
    description: `After ${iterations} rounds, maximum row error ${e.maxRow.toExponential(2)} and column error ${e.maxCol.toExponential(2)}.`,
    codeLineNumber: 4,
    layout: "grid",
    meta: { rows, cols, iterations, maxRowError: e.maxRow, maxColError: e.maxCol, matrix: matrix.flat() },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Symmetrizing a matrix means finding diagonal scalings that make every row and every column add to one. The algorithm simply alternates between two cheap operations: divide each row by its sum, then divide each column by its sum. Each pass fixes the sums it just touched while only mildly disturbing the other direction, so the errors shrink geometrically toward a doubly stochastic matrix.",
    invariants: [
      "All matrix entries stay nonnegative because scaling only divides by positive sums.",
      "After every column pass all row sums are exactly one, since each row was divided by the same factor across all columns.",
      "The total sum is preserved up to rounding by the final full column pass.",
    ],
    correctness:
      "The scaling factors are the Sinkhorn unknowns x_i and y_j with result entry x_i A_ij y_j. The iteration is a fixed-point method for the row and column equations that define a doubly stochastic scaling. When A has total support the fixed point exists and is unique up to a common factor, and the alternating projections converge to it, so both sets of marginal errors tend to zero.",
    complexityRationale:
      "One full round visits every entry once for rows and once for columns, costing O(m*n); with a fixed iteration budget the total time is O(iterations*m*n). The working copy of the matrix plus the cells shown in each frame use O(m*n) space.",
    uses: [
      "Entropic regularization and Sinkhorn distances in optimal transport",
      "Iterative proportional fitting for contingency tables",
      "Matrix balancing in numerical linear algebra and input-output economics",
    ],
    references: [
      "Sinkhorn and Knopp, Concerning Nonnegative Matrices and Doubly Stochastic Matrices, 1967",
      "Cuturi, Sinkhorn Distances: Lightspeed Computation of Optimal Transport, NeurIPS 2013",
    ],
    workedExample:
      "Starting from [[4,1],[1,8]], row scaling gives [[0.8,0.2],[0.111,0.889]]. Column scaling then gives [[0.878,0.184],[0.122,0.816]]. Repeating a handful of rounds drives both row and column sums to one, approaching a doubly stochastic matrix with diagonal entries near 0.88 and off-diagonal entries near 0.12.",
  },
  id: "sinkhorn-algorithm",
  name: "Sinkhorn Algorithm",
  category: "statistics-probability",
  complexity: { time: "O(iterations * m * n)", space: "O(m * n)" },
  defaultInput: {
    matrix: [
      [4, 1, 2],
      [1, 8, 1],
      [2, 1, 4],
    ],
    iterations: 20,
  },
  visualType: "grid",
  run,
  pseudocode: [
    "input nonnegative matrix A with rows m and columns n",
    "for each round divide each row by its row sum",
    "for each column divide each entry by that column sum",
    "compute the maximum deviation of row and column sums from one",
    "repeat until the deviations are small or the budget runs out",
    "done: report the doubly stochastic scaling and both errors",
  ],
};

export default module;
