/**
 * seidel-apsp.ts - Seidel's All-Pairs Shortest Paths by Matrix Squaring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In an unweighted undirected graph, the adjacency matrix with zero diagonal
 * encodes every one-edge path. Squaring it under the min-plus semiring (sum
 * becomes minimum, product becomes addition) captures every two-edge path.
 * Repeated squaring therefore doubles the maximum path length considered each
 * round, and after ceil(log2 n) rounds all simple shortest paths are present.
 * This is Seidel's O(n^omega log n) algebraic alternative to Floyd-Warshall.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 log n) with ordinary matrix multiplication (n^omega with fast MM)
 *   Space: O(n^2) for the distance matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The distance matrix is drawn as a grid of cells.
 *   - Finite distances are CYAN (path), unreachable entries stay idle.
 *   - The cell for the current (i, j) entry flashes YELLOW (comparing).
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const INF = 1e9;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D", "E"],
        D: ["B", "C", "F"],
        E: ["C", "F"],
        F: ["D", "E"],
    };

    const vertices: string[] = [];
    const seen = new Set<string>();
    for (const v of Object.keys(graph)) {
        if (!seen.has(v)) {
            seen.add(v);
            vertices.push(v);
        }
        for (const nb of graph[v] ?? []) {
            if (!seen.has(nb)) {
                seen.add(nb);
                vertices.push(nb);
            }
        }
    }
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));

    const cells = (matrix: number[][], highlight = -1): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const d = (matrix[i] as number[])[j] as number;
                out.push({
                    id: `cell-${i}-${j}`,
                    type: "cell" as const,
                    label: d >= INF ? "inf" : String(d),
                    value: d,
                    state: highlight === i * n + j ? ("comparing" as const) : d >= INF ? ("idle" as const) : ("path" as const),
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: i, col: j },
                });
            }
        }
        return out;
    };

    let step = 0;
    const snap = (
        matrix: number[][],
        description: string,
        line: number,
        highlight = -1,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: cells(matrix, highlight),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: n, cols: n, n, ...extra },
    });

    if (n === 0) {
        yield snap([], "Empty graph - the distance matrix is empty.", 7, -1, {
            rounds: 0,
            distances: [],
        });
        return;
    }

    const dist: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(INF));
    for (let i = 0; i < n; i += 1) (dist[i] as number[])[i] = 0;
    for (const [a, neighbors] of Object.entries(graph)) {
        const ia = index.get(a);
        if (ia === undefined) continue;
        for (const b of neighbors) {
            const ib = index.get(b);
            if (ib === undefined) continue;
            (dist[ia] as number[])[ib] = 1;
            (dist[ib] as number[])[ia] = 1;
        }
    }

    yield snap(dist, `Adjacency matrix for ${n} vertices: 0 on the diagonal, 1 on each edge.`, 0, -1, {
        rounds: 0,
        distances: dist.flat(),
    });
    step += 1;

    const rounds = Math.max(0, Math.ceil(Math.log2(n)));
    for (let round = 1; round <= rounds; round += 1) {
        const next: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(INF));
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                let best = INF;
                for (let k = 0; k < n; k += 1) {
                    const via = (dist[i] as number[])[k] + (dist[k] as number[])[j];
                    if (via < best) best = via;
                }
                (next[i] as number[])[j] = best;
            }
        }
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                (dist[i] as number[])[j] = (next[i] as number[])[j] as number;
            }
        }
        yield snap(
            dist,
            `Min-plus squaring round ${round} of ${rounds}: every path of up to ${2 ** round} edges is captured.`,
            4,
            round * n + 0,
            { rounds: round, distances: dist.flat() },
        );
        step += 1;
    }

    yield snap(dist, `All-pairs shortest distances are final after ${rounds} squaring round(s).`, 7, -1, {
        rounds,
        distances: dist.flat(),
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat the adjacency matrix as encoding one-step distances. Under the min-plus semiring, multiplying this matrix by itself composes two paths: the entry for i to j becomes the cheapest distance through any intermediate k. Each squaring doubles the maximum number of edges considered, so logarithmically many squarings capture every simple path.",
        invariants: [
            "After round r, entry (i, j) is the shortest distance using at most 2 to the r edges.",
            "The diagonal remains zero and every original edge remains one.",
            "Unreachable entries stay large and never produce a finite path.",
        ],
        correctness:
            "Min-plus matrix multiplication exactly implements the recurrence that a shortest path of at most 2r edges either uses at most 2r-1 edges or splits at a midpoint k into two paths of at most 2r-1 edges. Inductively after ceil(log2 n) rounds the bound exceeds n-1, the maximum length of a simple shortest path, so every entry equals the true shortest-path distance. A random vertex permutation can improve running time without affecting correctness.",
        complexityRationale:
            "Each min-plus product is a triple loop over n, giving O(n cubed) with ordinary multiplication, and there are O(log n) rounds. Fast matrix multiplication reduces each product to O(n to the omega). The single distance matrix uses O(n squared) space.",
        uses: [
            "Computing every-pairs distance in dense unweighted graphs",
            "A building block for graph algorithms that need transitive closure with weights",
            "Demonstrating algebraic shortest-path methods distinct from dynamic programming",
        ],
        references: [
            "Seidel, On the Distance Product of Matrices, 1992",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, shortest paths",
        ],
        workedExample:
            "For a triangle A-B-C-A the initial matrix has 1 on each connected pair and 0 on the diagonal. One min-plus squaring already yields distance 2 for every pair reachable by two hops, which is the true shortest distance in the triangle, and a second round changes nothing.",
    },
    id: "seidel-apsp",
    name: "Seidel All-Pairs Shortest Paths",
    category: "shortest-path",
    complexity: { time: "O(n^3 log n)", space: "O(n^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "D"],
            C: ["A", "D", "E"],
            D: ["B", "C", "F"],
            E: ["C", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build matrix with 0 diagonal and 1 on each edge",
        "let D be the current distance matrix",
        "repeat ceil(log2 n) times",
        "compute the min-plus square of D",
        "D[i][j] = min over k of D[i][k] + D[k][j]",
        "keep the diagonal at zero",
        "after log n rounds all simple paths are captured",
        "done: report the all-pairs distance matrix",
    ],
};

export default module;
