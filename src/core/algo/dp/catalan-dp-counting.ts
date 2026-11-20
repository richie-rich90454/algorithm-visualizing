/**
 * catalan-dp-counting.ts - Catalan Numbers (DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: C[i] <- sum over j of C[j] * C[i-1-j].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n\u00b2)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Source cells for the transition are BLUE (active).
   - The optimal value and path are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    matrix: number[][],
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const r = matrix[row];
        if (!r) continue;
        for (let col = 0; col < r.length; col += 1) {
            const value = r[col];
            if (value === undefined) continue;
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(`${row},${col}`) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 4;
    let step = 0;
    if (n < 0) {
        yield {
            stepNumber: step,
            entities: makeCells([[0]]),
            edges: [],
            description: "Negative n \u2013 nothing to count.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const C: number[] = new Array<number>(n + 1).fill(0);
    C[0] = 1;
    yield {
        stepNumber: step,
        entities: makeCells([[...C]]),
        edges: [],
        description: `Catalan numbers up to C[${n}] (BSTs, bracketings, Dyck paths). C[0] = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        let total = 0;
        for (let j = 0; j < i; j += 1) total += (C[j] ?? 0) * (C[i - 1 - j] ?? 0);
        C[i] = total;
        const states = new Map<string, EntityState>([[`0,${i}`, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeCells([[...C]], states),
            edges: [],
            description: `C[${i}] = sum(C[j]*C[${i}-1-j]) = ${total}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { n },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells([[...C]], new Map([[`0,${n}`, "sorted"]])),
        edges: [],
        description: `Traceback: C[${n}] = ${C[n]}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { answer: C[n] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Catalan numbers count many recursive structures such as binary search trees, balanced parentheses, and Dyck paths. The DP builds C[i] from smaller counts by choosing a root or split point: C[i] is the sum over j of C[j] times C[i-1-j]. Each term pairs an independent left and right substructure.",
        "invariants": [
            "C[0] = 1 represents the single empty structure.",
            "Every structure of size i decomposes into left size j and right size i-1-j for some j.",
            "All C[k] with k < i are final before C[i] is computed."
        ],
        "correctness": "For binary trees, choosing which j nodes go to the left subtree determines the right, and the two subtrees are independent, giving C[j]*C[i-1-j] arrangements. Summing over all j counts every tree exactly once by its root split. Induction produces the Catalan recurrence and hence the correct counts for all other interpretations.",
        "complexityRationale": "Computing C[i] sums i products, so building up to n costs O(n^2) time. Only the array of counts is stored, using O(n) space.",
        "uses": [
            "Counting binary tree shapes and balanced parenthesis strings",
            "Counting triangulations and Dyck paths",
            "Analyzing stack permutation counts"
        ],
        "references": [
            "Graham, Knuth and Patashnik, Concrete Mathematics, Chapter 7",
            "Stanley, Enumerative Combinatorics, Vol. 2, Chapter 6"
        ],
        "workedExample": "Starting C[0]=1: C[1]=1, C[2]=C[0]C[1]+C[1]C[0]=2, C[3]=5, C[4]=14. Thus there are 14 binary tree shapes with four nodes."
    },
    id: "catalan-dp-counting",
    name: "Catalan Numbers (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n\u00b2)", space: "O(n)" },
    defaultInput: { n: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "set up C[0] <- 1 as the empty product base case",
        "C[n] counts BSTs, bracketings, and Dyck paths",
        "C[i] <- sum over j of C[j] * C[i-1-j]",
        "iterate i from 1 to n building on smaller counts",
        "each split picks a root with left and right subcounts",
        "accumulate products across all root positions",
        "answer <- C[n] with structures reconstructed from split picks",
    ],
};

export default module;
