/**
 * min-plus-matrix-multiplication-apsp.ts - Min-Plus APSP by Repeated Squaring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Distance products use addition in place of multiplication and minimum in
 * place of addition. If W is the weighted adjacency matrix, then W squared
 * holds the cheapest two-hop distances, W to the fourth the cheapest four-hop
 * distances, and so on. After log2(V) squarings every entry is the shortest
 * path distance, giving all-pairs shortest paths without a per-source search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3 log V) with ordinary cubic min-plus multiplication
 *   Space: O(V^2) for the two distance matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each distance matrix is drawn as a V by V grid of cells.
 *   - Cells improved in the current squaring are YELLOW.
 *   - The final matrix is GREEN; unreachable entries show a dash.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";

const defaultGraph: Record<string, Array<[string, number]>> = {
    A: [
        ["B", 3],
        ["C", 8],
    ],
    B: [
        ["C", 1],
        ["D", 6],
    ],
    C: [["D", 2]],
    D: [],
};

function makeCells(matrix: number[][], changed: Set<string>): VisualFrame["entities"] {
    return matrix.flatMap((row, i) =>
        row.map((value, j) => ({
            id: `cell-${i}-${j}`,
            type: "cell" as const,
            label: value === Infinity ? "-" : String(value),
            value,
            state: (changed.has(`${i}-${j}`) ? "comparing" : value === Infinity ? "idle" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: j },
        })),
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, Array<[string, number]>> } | null) ?? {};
    const graph = task.graph && typeof task.graph === "object" ? task.graph : defaultGraph;
    const labels = [...new Set([
        ...Object.keys(graph),
        ...Object.values(graph).flatMap((list) => (Array.isArray(list) ? list.map(([v]) => String(v)) : [])),
    ])];
    const n = labels.length;
    const index = new Map(labels.map((v, i) => [v, i]));

    let distance: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
    );
    for (const [u, list] of Object.entries(graph)) {
        const i = index.get(u);
        if (i === undefined || !Array.isArray(list)) {
            continue;
        }
        for (const [v, weight] of list) {
            const j = index.get(String(v));
            if (j === undefined) {
                continue;
            }
            const w = Number(weight);
            if (Number.isFinite(w) && w < (distance[i]![j] ?? Infinity)) {
                distance[i]![j] = w;
            }
        }
    }

    let step = 0;
    const frame = (description: string, codeLineNumber: number, changed: Set<string>, phase: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(distance, changed),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            rows: n,
            cols: n,
            phase,
            labels,
            result: distance.flat().map((value) => (value === Infinity ? -1 : value)),
        },
    });

    if (n === 0) {
        yield frame("Empty graph - there is no distance matrix to compute.", 0, new Set(), 0);
        return;
    }

    yield frame(`Min-plus squaring on ${n} vertices; the initial matrix stores one-edge distances.`, 0, new Set(), 0);

    let phase = 0;
    for (let limit = 1; limit < n; limit *= 2) {
        const next = Array.from({ length: n }, () => Array.from({ length: n }, () => Infinity));
        const changed = new Set<string>();
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                let best = distance[i]![j]!;
                for (let k = 0; k < n; k += 1) {
                    const candidate = (distance[i]![k] ?? Infinity) + (distance[k]![j] ?? Infinity);
                    if (candidate < best) {
                        best = candidate;
                    }
                }
                next[i]![j] = best;
                if (best < (distance[i]![j] ?? Infinity)) {
                    changed.add(`${i}-${j}`);
                }
            }
        }
        distance = next;
        phase += 1;
        yield frame(
            `Squaring ${phase} now covers paths of up to ${Math.min(limit * 2, n - 1)} edge(s); ${changed.size} distance(s) improved.`,
            3,
            changed,
            phase,
        );
    }

    yield frame(`All-pairs shortest distances are ready after ${phase} squaring phase(s).`, 6, new Set(), phase);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Matrix multiplication normally multiplies and adds. Swap those operations: add path lengths and take the smallest total. Multiplying the adjacency matrix by itself then gives the best two-step routes, squaring again gives four-step routes, and a logarithmic number of squarings covers every possible simple path.",
        invariants: [
            "After phase k, entry i,j is the cheapest path using at most 2^k edges.",
            "Diagonal entries stay zero because an empty path costs nothing.",
            "An unreachable pair keeps the infinite sentinel until a route appears.",
        ],
        correctness:
            "The min-plus product satisfies (A tensor A)[i][j] = min over k of A[i][k] + A[k][j], which concatenates any two routes represented by A. Inductively, phase k stores the cheapest route using at most 2^k edges. Any shortest simple path has at most V-1 edges, which is below 2^ceil(log2 V), so after that many squarings every entry is the true shortest distance.",
        complexityRationale:
            "Each min-plus product checks all intermediate vertices for every ordered pair, O(V^3) work, and there are ceil(log2 V) products, giving O(V^3 log V) time. Two V by V matrices are stored, O(V^2) space.",
        uses: [
            "All-pairs shortest paths in dense networks",
            "Transitive closure style reachability with costs",
            "A building block for faster algebraic shortest-path algorithms",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, chapter on shortest paths",
            "Floyd, Algorithm 97: Shortest Path, 1962",
        ],
        workedExample:
            "With A to B cost 3, B to C cost 1, and C to D cost 2, the first square discovers A to C cost 4 and B to D cost 3. The second square discovers A to D cost 6, so the final matrix holds the shortest distances between every pair.",
    },
    id: "min-plus-matrix-multiplication-apsp",
    name: "Min-Plus Matrix Multiplication APSP",
    category: "shortest-path",
    complexity: { time: "O(V^3 log V)", space: "O(V^2)" },
    defaultInput: { graph: defaultGraph },
    visualType: "grid",
    run,
    pseudocode: [
        "build the weighted adjacency matrix W with zero diagonal",
        "let D start as W and set phase to zero",
        "while two to the phase is less than the vertex count",
        "compute the min-plus product of D with itself",
        "each entry takes the minimum over all intermediate vertices",
        "replace D with the product and increment the phase",
        "repeat until paths of every length are covered",
        "done: entry i,j is the shortest distance from i to j",
    ],
};

export default module;
