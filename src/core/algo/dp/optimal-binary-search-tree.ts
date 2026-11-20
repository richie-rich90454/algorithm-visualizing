/**
 * optimal-binary-search-tree.ts - Optimal Binary Search Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given success probabilities for n keys and failure probabilities for the n+1
 * gaps between them, builds the binary search tree with the smallest expected
 * search cost. The recurrence tries every key as the root of each key interval
 * and adds the interval's total probability, since one more comparison is paid
 * for every search that enters the interval.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) - O(n^2) intervals with O(n) root candidates each
 *   Space: O(n^2) for the cost and root tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The DP table e[i][j] is shown as a grid of cells.
 *   - The cell being computed flashes YELLOW (comparing); finished cells GREEN.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - e[i][j] is the minimum expected cost for keys i through j.
 *   - An empty interval i..i-1 has cost q[i], the failure probability of that gap.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(e: number[][], n: number, activeI: number, activeJ: number, done: Set<string>): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const key = `${i},${j}`;
            let state: EntityState = "idle";
            if (done.has(key)) state = "sorted";
            else if (i === activeI && j === activeJ) state = "comparing";
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: i > j ? "-" : (e[i]?.[j] ?? 0).toFixed(2),
                value: i > j ? 0 : (e[i]?.[j] ?? 0),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number[]; q?: number[] } | null) ?? {};
    const p: number[] = Array.isArray(task.p) ? task.p.map((v) => Number(v)) : [0.1, 0.2, 0.1, 0.3];
    const q: number[] = Array.isArray(task.q) ? task.q.map((v) => Number(v)) : [0.05, 0.05, 0.05, 0.05, 0.05];
    const n = p.length;
    let step = 0;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([], 1, -1, -1, new Set()),
            edges: [],
            description: "No keys - the optimal search tree is empty with cost zero.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { n: 0, rows: 1, cols: 1, bestCost: 0, root: -1 },
        };
        return;
    }

    const e: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const w: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const root: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
    const done = new Set<string>();
    const getE = (i: number, j: number): number => (i > j ? (q[i] ?? 0) : (e[i]?.[j] ?? 0));
    const getW = (i: number, j: number): number => (i > j ? (q[i] ?? 0) : (w[i]?.[j] ?? 0));

    yield {
        stepNumber: step,
        entities: makeCells(e, n, -1, -1, done),
        edges: [],
        description: `Computing the minimum expected search cost for ${n} keys and ${n + 1} gaps.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, rows: n, cols: n, bestCost: 0, root: -1 },
    };
    step += 1;

    for (let length = 1; length <= n; length += 1) {
        for (let i = 0; i + length - 1 < n; i += 1) {
            const j = i + length - 1;
            w[i]![j] = getW(i, j - 1) + (p[j] ?? 0) + (q[j + 1] ?? 0);
            let best = Number.POSITIVE_INFINITY;
            let bestRoot = i;
            for (let k = i; k <= j; k += 1) {
                const candidate = getE(i, k - 1) + getE(k + 1, j) + (w[i]?.[j] ?? 0);
                if (candidate < best) {
                    best = candidate;
                    bestRoot = k;
                }
            }
            e[i]![j] = best;
            root[i]![j] = bestRoot;
            done.add(`${i},${j}`);
            yield {
                stepNumber: step,
                entities: makeCells(e, n, i, j, done),
                edges: [],
                description: `Interval keys ${i} to ${j}: minimum cost ${best.toFixed(3)} with root ${bestRoot}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { n, rows: n, cols: n, bestCost: Number(best.toFixed(6)), root: bestRoot, i, j },
            };
            step += 1;
        }
    }

    const finalCost = e[0]?.[n - 1] ?? 0;
    const finalRoot = root[0]?.[n - 1] ?? -1;
    yield {
        stepNumber: step,
        entities: makeCells(e, n, -1, -1, done),
        edges: [],
        description: `Done: optimal expected search cost ${finalCost.toFixed(3)} with key ${finalRoot} at the root.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { n, rows: n, cols: n, bestCost: Number(finalCost.toFixed(6)), root: finalRoot },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Choosing the root of a binary search tree splits the remaining keys into a left and a right interval. A search that enters an interval pays one more comparison, so the cost of an interval is the cost of its two subintervals plus the total probability of all keys and gaps inside it. Try every possible root and keep the cheapest.",
        invariants: [
            "e[i][j] is the minimum expected cost for the keys i through j.",
            "w[i][j] is the sum of all key and gap probabilities in that interval.",
            "Intervals are filled in increasing length, so every shorter subproblem is final before it is read.",
        ],
        correctness:
            "Any binary search tree over keys i..j has some key k at the root, with left and right subtrees that are themselves optimal over i..k-1 and k+1..j. The recurrence enumerates every k and adds the interval weight for the extra comparison level, so the minimum it records is exactly the cost of the optimal tree, and the root table reconstructs that tree.",
        complexityRationale:
            "There are O(n^2) intervals and each tries O(n) roots, so the time is O(n^3); the cost, weight and root tables occupy O(n^2) space.",
        uses: [
            "Compilers choosing optimal keyword lookup trees",
            "Designing static decision trees under known query frequencies",
            "A canonical example of interval dynamic programming",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 6.1.2",
            "CLRS, Chapter 15, optimal BST section",
        ],
        workedExample:
            "With keys A, B, C of probabilities 0.5, 0.1, 0.1 and equal gap probabilities, the recurrence finds that putting A at the root and B above C in the right subtree gives a lower expected cost than balancing the three keys evenly.",
    },
    id: "optimal-binary-search-tree",
    name: "Optimal Binary Search Tree",
    category: "dynamic-programming",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { p: [0.1, 0.2, 0.1, 0.3], q: [0.05, 0.05, 0.05, 0.05, 0.05] },
    visualType: "grid",
    run,
    pseudocode: [
        "set e[i][i-1] to the failure probability q[i]",
        "for every interval length from one to n",
        "for every start index i define the end j",
        "compute w[i][j] as the probability mass in the interval",
        "try each key k from i to j as the root",
        "candidate cost is e[i][k-1] plus e[k+1][j] plus w[i][j]",
        "keep the smallest candidate and remember its root",
        "done: report e[0][n-1] as the minimum expected cost",
    ],
};

export default module;
