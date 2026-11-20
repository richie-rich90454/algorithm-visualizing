/**
 * umap.ts - UMAP (Fuzzy Graph Union Core)
 *
 * TEACHING MODEL, NOT THE FULL UMAP OPTIMIZER. UMAP first builds a weighted
 * nearest-neighbor graph for each point and then merges those directed weights
 * into one undirected fuzzy graph using the probabilistic sum a + b - a*b.
 * This module implements exactly that merge step on a small directed weight
 * matrix; the later force-directed embedding is out of scope here.
 *
 * Complexity:
 *   Time:  O(k^2) for a k-point directed weight matrix
 *   Space: O(k^2) for the resulting undirected graph
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function fmt(value: number): string {
    return String(Math.round(value * 1000) / 1000);
}

function makeCells(matrix: Cell[][], revealedRows: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealedRows || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : fmt(value),
                value: value ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** Merge a directed weight matrix into an undirected fuzzy graph. */
function fuzzyUnion(directed: number[][]): number[][] {
    const k = directed.length;
    const undirected: number[][] = [];
    for (let i = 0; i < k; i += 1) {
        const row: number[] = [];
        for (let j = 0; j < k; j += 1) {
            if (i === j) {
                row.push(0);
                continue;
            }
            const a = directed[i]?.[j] ?? 0;
            const b = directed[j]?.[i] ?? 0;
            row.push(a + b - a * b);
        }
        undirected.push(row);
    }
    return undirected;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { directed?: number[][] } | null) ?? {};
    const directed = task.directed?.length
        ? task.directed.map((row) => [...row])
        : [
              [0, 0.9, 0.2, 0.05],
              [0.3, 0, 0.8, 0.1],
              [0.15, 0.6, 0, 0.85],
              [0.02, 0.1, 0.7, 0],
          ];
    const k = directed.length;
    const merged = fuzzyUnion(directed);
    const base = { rows: k, cols: k, points: k };
    yield {
        stepNumber: 0,
        entities: makeCells(directed, 0, -1),
        edges: [],
        description: `Each of the ${k} points records directed membership strengths to its neighbors.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "directed" },
    };
    for (let i = 0; i < k; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeCells(merged, i + 1, i),
            edges: [],
            description: `Row ${i}: merge incoming and outgoing strengths with w = a + b - a*b.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                ...base,
                phase: "union",
                current: i,
                graph: merged.flat().map(fmt),
            },
        };
    }
    yield {
        stepNumber: k + 1,
        entities: makeCells(merged, k, -1),
        edges: [],
        description: "The undirected fuzzy graph is symmetric and every edge weight lies between zero and one.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, phase: "done", graph: merged.flat().map(fmt) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each point in UMAP independently lists the neighbors it finds convincing, with a membership strength for each. Two points may disagree about how strongly they are connected. UMAP resolves the disagreement by combining the two directed strengths with the probabilistic sum, which is more generous than a plain maximum and keeps the result a valid fuzzy membership.",
        invariants: [
            "The merged weight for a pair depends only on the two directed weights between them.",
            "Self weights are set to zero and the final matrix is symmetric.",
            "Because both directed weights lie in the unit interval, their probabilistic sum also lies in the unit interval.",
        ],
        correctness:
            "The probabilistic sum a + b minus a times b equals one minus (1 minus a) times (1 minus b). Since a and b are each in the closed interval from zero to one, the two complements are also in that interval, their product is in the interval, and so is the result. Applying the same symmetric formula in both directions makes the merged matrix symmetric and ensures it is at least as large as either directed weight.",
        complexityRationale:
            "For a k by k directed matrix the algorithm visits each unordered pair once and does constant work, so the time is O(k squared), the same as storing the undirected graph in O(k squared) space.",
        uses: [
            "Dimensionality reduction of high-dimensional data",
            "Building the weighted graph that UMAP later embeds",
            "A teaching model of fuzzy set union for neighbor graphs",
        ],
        references: [
            "McInnes, Healy, and Melville, UMAP: Uniform Manifold Approximation and Projection, 2018",
            "McInnes and Healy, Dense UMAP, 2024",
        ],
        workedExample:
            "If point A gives its link to B a strength of 0.9 while B gives the reverse link 0.3, the merged undirected strength is 0.9 plus 0.3 minus 0.27, which is 0.93, a value no smaller than either input.",
    },
    id: "umap",
    name: "UMAP (Fuzzy Graph Union Core)",
    category: "ml-ai",
    complexity: { time: "O(k^2)", space: "O(k^2)" },
    defaultInput: {
        directed: [
            [0, 0.9, 0.2, 0.05],
            [0.3, 0, 0.8, 0.1],
            [0.15, 0.6, 0, 0.85],
            [0.02, 0.1, 0.7, 0],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build a directed neighbor strength for every ordered pair of points",
        "for each unordered pair of distinct points",
        "combine the two strengths with the probabilistic sum a + b - a*b",
        "write the same value into both symmetric matrix positions",
        "set all self weights to zero",
        "done: return the undirected fuzzy graph",
    ],
};

export default module;
