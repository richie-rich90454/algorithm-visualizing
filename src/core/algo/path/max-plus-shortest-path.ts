/**
 * max-plus-shortest-path.ts - Max-Plus Matrix Powers for Heaviest Walks
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In the max-plus semiring, addition is maximum and multiplication is ordinary
 * addition. Multiplying a weighted adjacency matrix by itself under these
 * operations yields, at entry (i, j), the heaviest walk of a given number of
 * edges from i to j. Repeated products therefore answer exact-length path
 * queries, and the same machinery underlies longest-path and maximum-cycle-mean
 * computations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * n^3) for an n-vertex graph and L matrix products
 *   Space: O(L * n^2) to keep every power for walk reconstruction
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each matrix power is drawn as a grid of cells, one per entry.
 *   - A minus-infinity entry is shown as -inf; real weights are shown as is.
 *   - The final frame highlights the largest entry of the last power.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type WeightedAdjacency = Record<string, Array<[string, number]>>;

const NEG = -1e9;

interface MaxPlusInput {
    graph?: WeightedAdjacency;
    steps?: number;
}

/** Max-plus product: C[i][j] = max over k of A[i][k] + B[k][j]. */
function maxPlusMultiply(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const result: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(NEG));
    for (let i = 0; i < n; i += 1) {
        for (let k = 0; k < n; k += 1) {
            const av = a[i]?.[k] ?? NEG;
            if (av === NEG) {
                continue;
            }
            for (let j = 0; j < n; j += 1) {
                const bv = b[k]?.[j] ?? NEG;
                if (bv === NEG) {
                    continue;
                }
                const candidate = av + bv;
                if (candidate > (result[i]?.[j] ?? NEG)) {
                    result[i]![j] = candidate;
                }
            }
        }
    }
    return result;
}

/** Turn the current matrix into grid-cell entities. */
function matrixEntities(matrix: number[][], highlight: Array<[number, number]>): VisualEntity[] {
    const bright = new Set(highlight.map(([r, c]) => `${r},${c}`));
    const entities: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix.length; c += 1) {
            const value = matrix[r]?.[c] ?? NEG;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value === NEG ? "-inf" : String(value),
                value,
                state: (bright.has(`${r},${c}`)
                    ? "sorted"
                    : value === NEG
                      ? "unvisited"
                      : "visited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MaxPlusInput | null) ?? {};
    const graph: WeightedAdjacency = task.graph ?? {
        A: [
            ["B", 3],
            ["C", 1],
        ],
        B: [
            ["D", 2],
            ["E", 5],
        ],
        C: [
            ["D", 4],
            ["E", 1],
        ],
        D: [["E", 2]],
        E: [],
    };
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((p) => p[0])])].sort();
    const n = labels.length;
    const steps = Math.max(0, Math.floor(task.steps ?? 3));

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [
                {
                    id: "cell-0-0",
                    type: "cell" as const,
                    label: "-",
                    value: 0,
                    state: "unvisited" as const,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 0, col: 0 },
                },
            ],
            edges: [],
            description: "The graph is empty, so there is no walk to evaluate.",
            codeLineNumber: 0,
            layout: "matrix",
            meta: { rows: 1, cols: 1, bestWeight: 0, walk: [], steps },
        };
        return;
    }

    const identity: number[][] = Array.from({ length: n }, (_row, i) =>
        Array.from({ length: n }, (_col, j) => (i === j ? 0 : NEG)),
    );
    const weight: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(NEG));
    for (const [source, edges] of Object.entries(graph)) {
        const i = labels.indexOf(source);
        if (i < 0) {
            continue;
        }
        for (const [target, w] of edges) {
            const j = labels.indexOf(target);
            if (j >= 0) {
                weight[i]![j] = w;
            }
        }
    }

    const powers: number[][][] = [identity];
    powers.push(weight);

    const flatten = (matrix: number[][]): number[] => matrix.flat();
    yield {
        stepNumber: 0,
        entities: matrixEntities(weight, []),
        edges: [],
        description: `Weighted adjacency matrix for ${n} vertices; computing walks of exactly ${steps} edge(s).`,
        codeLineNumber: 1,
        layout: "matrix",
        meta: { rows: n, cols: n, matrix: flatten(weight), steps, power: 1 },
    };
    let step = 1;

    for (let t = 2; t <= steps; t += 1) {
        powers.push(maxPlusMultiply(powers[t - 1] as number[][], weight));
        const matrix = powers[t] as number[][];
        yield {
            stepNumber: step,
            entities: matrixEntities(matrix, []),
            edges: [],
            description: `Power ${t}: entry (i, j) is the heaviest walk of exactly ${t} edges from i to j.`,
            codeLineNumber: 3,
            layout: "matrix",
            meta: { rows: n, cols: n, matrix: flatten(matrix), steps, power: t },
        };
        step += 1;
    }

    const last = powers[steps] as number[][];
    let bestWeight = NEG;
    let bestI = 0;
    let bestJ = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = last[i]?.[j] ?? NEG;
            if (value > bestWeight) {
                bestWeight = value;
                bestI = i;
                bestJ = j;
            }
        }
    }

    let walk: string[];
    if (steps === 0) {
        walk = [labels[bestI] as string];
    } else {
        const reversed: string[] = [labels[bestJ] as string];
        let end = bestJ;
        for (let t = steps; t >= 1; t -= 1) {
            const prev = powers[t - 1] as number[][];
            const targetValue = powers[t]?.[bestI]?.[end] ?? NEG;
            let chosen = -1;
            for (let k = 0; k < n; k += 1) {
                const left = prev[bestI]?.[k] ?? NEG;
                const right = weight[k]?.[end] ?? NEG;
                if (left === NEG || right === NEG) {
                    continue;
                }
                if (left + right === targetValue) {
                    chosen = k;
                    break;
                }
            }
            if (chosen < 0) {
                break;
            }
            reversed.push(labels[chosen] as string);
            end = chosen;
        }
        walk = reversed.reverse();
    }

    yield {
        stepNumber: step,
        entities: matrixEntities(last, [[bestI, bestJ]]),
        edges: [],
        description:
            bestWeight === NEG
                ? `No walk of exactly ${steps} edge(s) exists in this graph.`
                : `Heaviest ${steps}-edge walk has weight ${bestWeight}: ${walk.join(" -> ")}.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: {
            rows: n,
            cols: n,
            matrix: flatten(last),
            steps,
            power: steps,
            bestWeight: bestWeight === NEG ? 0 : bestWeight,
            bestStart: labels[bestI] ?? "",
            bestEnd: labels[bestJ] ?? "",
            walk,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Replace ordinary addition with maximum and ordinary multiplication with addition. Under this max-plus arithmetic, squaring a weighted adjacency matrix composes walks: an entry tells you the best total weight for a trip of a fixed number of hops. Repeating the product answers exact-length path questions and powers the same ideas used for longest paths and maximum cycle means.",
        invariants: [
            "The entry (i, j) of power t is the heaviest weight of any walk using exactly t edges from i to j.",
            "A minus-infinity entry means no walk of that length exists between the two vertices.",
            "Each new power is the max-plus product of the previous power with the original weight matrix.",
        ],
        correctness:
            "The base power is the identity, whose entries represent zero-length walks. If power t - 1 records the best walk of length t - 1 ending at an intermediate vertex k, appending one edge k to j and taking the maximum over k yields the best walk of length t ending at j. This is exactly the max-plus product, so induction on t proves each computed entry is correct. Backtracking through stored powers recovers an optimal walk that attains the reported weight.",
        complexityRationale:
            "Each max-plus product examines every triple (i, k, j), costing O(n^3); computing L powers costs O(L * n^3) time. Keeping all L matrices of size n by n uses O(L * n^2) space, which also enables walk reconstruction.",
        uses: [
            "Longest-path and critical-path analysis in scheduling networks",
            "Maximum cycle mean computation in timed discrete-event systems",
            "Performance analysis of queueing networks and max-plus linear systems",
        ],
        references: [
            "Baccelli, Cohen, Olsder and Quadrat, Synchronization and Linearity, 1992",
            "Wikipedia, 'Max-plus algebra'",
        ],
        workedExample:
            "With edges A to B weight 3, B to D weight 2, A to C weight 1 and C to D weight 4, the two-edge heaviest walk from A to D is A to C to D with weight 5. In max-plus terms the (A, D) entry of the squared matrix is max(3 + 2, 1 + 4) = 5.",
    },
    id: "max-plus-shortest-path",
    name: "Max-Plus Matrix Powers for Longest Walks",
    category: "shortest-path",
    complexity: { time: "O(L * n^3)", space: "O(L * n^2)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 3],
                ["C", 1],
            ],
            B: [
                ["D", 2],
                ["E", 5],
            ],
            C: [
                ["D", 4],
                ["E", 1],
            ],
            D: [["E", 2]],
            E: [],
        },
        steps: 3,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "let P0 be the max-plus identity: zero on the diagonal, minus infinity elsewhere",
        "let M hold each edge weight and minus infinity where no edge exists",
        "for t from 1 up to L compute Pt as the max-plus product of Pt-1 and M",
        "entry Pt[i][j] is then the heaviest walk of exactly t edges from i to j",
        "after L steps select the largest entry and note its endpoints",
        "backtrack through the stored powers to recover an optimal walk",
        "done: report the maximum walk weight and the walk itself",
    ],
};

export default module;
