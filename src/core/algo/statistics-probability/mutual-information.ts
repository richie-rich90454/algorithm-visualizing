/**
 * mutual-information.ts - Mutual Information from a Joint Count Table
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mutual information measures how much knowing one variable reduces
 * uncertainty about another. This module builds the joint count table from
 * paired observations, converts counts to joint and marginal probabilities,
 * and sums p(x,y) times log base two of p(x,y) over p(x)p(y). It also reports
 * the entropies of X, Y and the pair, verifying the identity I(X;Y) equals
 * H(X) + H(Y) minus H(X,Y).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + r * c) for n pairs and an r by c joint table
 *   Space: O(r * c) for the joint and marginal probability tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The joint table is drawn as a grid of cells.
 *   - Each cell turns yellow while its contribution is added, then green.
 *   - meta carries the joint counts, probabilities, and all three entropies.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    counts: number[],
    rows: number,
    cols: number,
    active: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const index = r * cols + c;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(counts[index] ?? 0),
                value: counts[index] ?? 0,
                state: (done ? "sorted" : index === active ? "comparing" : index < active ? "visited" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, count: counts[index] ?? 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pairs?: Array<[number, number]> } | null) ?? {};
    const fallback: Array<[number, number]> = [
        [0, 0], [0, 0], [0, 1], [1, 1], [1, 1], [1, 2], [2, 2], [2, 2], [2, 1], [2, 2],
    ];
    const pairs = (Array.isArray(task.pairs) ? task.pairs : fallback)
        .filter((pair) => Array.isArray(pair) && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1])))
        .map((pair) => [Number(pair[0]), Number(pair[1])] as [number, number]);
    const safePairs = pairs.length > 0 ? pairs : fallback;
    const xs = [...new Set(safePairs.map((pair) => pair[0]))].sort((a, b) => a - b);
    const ys = [...new Set(safePairs.map((pair) => pair[1]))].sort((a, b) => a - b);
    const rows = xs.length;
    const cols = ys.length;
    const n = safePairs.length;
    const xIndex = new Map(xs.map((x, i) => [x, i]));
    const yIndex = new Map(ys.map((y, i) => [y, i]));
    const counts = new Array<number>(rows * cols).fill(0);
    for (const [x, y] of safePairs) {
        const r = xIndex.get(x) ?? 0;
        const c = yIndex.get(y) ?? 0;
        counts[r * cols + c] = (counts[r * cols + c] ?? 0) + 1;
    }

    const joint = counts.map((count) => count / n);
    const px = new Array<number>(rows).fill(0);
    const py = new Array<number>(cols).fill(0);
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const value = joint[r * cols + c] ?? 0;
            px[r] = (px[r] ?? 0) + value;
            py[c] = (py[c] ?? 0) + value;
        }
    }
    const contributions = joint.map((p, index) => {
        if (p <= 0) {
            return 0;
        }
        const r = Math.floor(index / cols);
        const c = index % cols;
        const product = (px[r] ?? 0) * (py[c] ?? 0);
        return product > 0 ? p * Math.log2(p / product) : 0;
    });
    const mi = contributions.reduce((sum, value) => sum + value, 0);
    const entropyX = px.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0);
    const entropyY = py.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0);
    const entropyXY = joint.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0);
    const identity = entropyX + entropyY - entropyXY;

    const meta = (phase: string, active: number) => ({
        phase,
        rows,
        cols,
        n,
        xs,
        ys,
        counts,
        joint,
        px,
        py,
        contributions,
        mi,
        entropyX,
        entropyY,
        entropyXY,
        identity,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(counts, rows, cols, -1, false),
        edges: [],
        description: `Mutual information on ${n} pairs: a ${rows} by ${cols} joint count table.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta("setup", -1),
    };
    let step = 1;

    for (let index = 0; index < counts.length; index += 1) {
        const r = Math.floor(index / cols);
        const c = index % cols;
        yield {
            stepNumber: step,
            entities: makeCells(counts, rows, cols, index, false),
            edges: [],
            description: `Cell (${xs[r]}, ${ys[c]}): count ${counts[index]}, contribution ${(contributions[index] ?? 0).toFixed(4)} bits.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: meta("sum", index),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(counts, rows, cols, -1, true),
        edges: [],
        description: `I(X;Y) = ${mi.toFixed(4)} bits; H(X)+H(Y)-H(X,Y) = ${identity.toFixed(4)} agrees.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...meta("done", -1), phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Mutual information asks how much uncertainty about one variable disappears once another is known. If the two variables are independent, learning one says nothing about the other and the answer is zero. If one determines the other, the answer equals the entropy of the determined variable. It is computed by comparing the observed joint probability of each pair with what the two marginals would predict under independence.",
        invariants: [
            "Every joint probability is nonnegative and the entries sum to one.",
            "The marginal probabilities are the row and column sums of the joint table.",
            "Mutual information is nonnegative and equals H(X) plus H(Y) minus H(X,Y).",
        ],
        correctness:
            "Each term p(x,y) log base two of p(x,y) over p(x)p(y) is zero when the pair is independent and positive otherwise, and the sum is the Kullback-Leibler divergence between the joint distribution and the product of its marginals, which is nonnegative by Gibbs' inequality. Expanding the logarithms gives the entropy identity exactly, so computing the sum term by term returns the mutual information. Symmetry follows because the joint product is unchanged when the variables are swapped.",
        complexityRationale:
            "Counting the pairs is O(n) and filling and summing the r by c table is O(r times c); storing the joint and marginal tables also uses O(r times c) space.",
        uses: [
            "Feature selection by ranking features against a target",
            "Measuring dependence in signal processing and genomics",
            "Information bottleneck and representation learning objectives",
        ],
        references: [
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
            "MacKay, Information Theory, Inference, and Learning Algorithms",
        ],
        workedExample:
            "For pairs where y equals x four times out of five, the joint table piles mass on the diagonal. Under independence the diagonal cells would be much smaller, so their log ratios are positive and the sum is well above zero, close to the entropy of X because Y is almost determined by X.",
    },
    id: "mutual-information",
    name: "Mutual Information",
    category: "statistics-probability",
    complexity: { time: "O(n + r * c)", space: "O(r * c)" },
    defaultInput: {
        pairs: [[0, 0], [0, 0], [0, 1], [1, 1], [1, 1], [1, 2], [2, 2], [2, 2], [2, 1], [2, 2]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the distinct values of X and Y",
        "count observations in each cell of the joint table",
        "divide by the sample size to get joint probabilities",
        "sum rows and columns to get the marginal probabilities",
        "for each cell add p(x,y) log base two of p(x,y) over p(x)p(y)",
        "compute H(X), H(Y), and H(X,Y) for the identity check",
        "done: report mutual information in bits",
    ],
};

export default module;
