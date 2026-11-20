/**
 * goemans-williamson-max-cut.ts - Goemans-Williamson Max-Cut Rounding
 *
 * The 0.878-approximation algorithm for maximum cut. Each vertex is assigned a
 * unit vector in a relaxed vector program that encourages neighbors to point
 * apart; a random hyperplane through the origin then assigns each vertex to one
 * of two sides, and edges crossing the cut are kept. The expected weight cut by
 * rounding is sum over edges of weight times arccos(u dot v) over pi.
 *
 * This visualization uses a small local search to produce a feasible vector
 * solution, then performs the genuine Goemans-Williamson rounding stage.
 *
 * Time O(rounds * E + samples * E), space O(V + E).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type WeightedAdj = Record<string, Array<[string, number]> | string[]>;
type Edge = { i: number; j: number; w: number };

function normalized(input: WeightedAdj): Record<string, Array<[string, number]>> {
    const out: Record<string, Array<[string, number]>> = {};
    for (const [u, list] of Object.entries(input)) {
        out[u] = (list ?? []).map((item) => (Array.isArray(item) ? [item[0], item[1]] : [item, 1]));
    }
    return out;
}

function makeRng(seed: number): () => number {
    let s = (seed >>> 0) || 1;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: WeightedAdj; samples?: number; seed?: number; rounds?: number } | null) ?? {};
    const graph = normalized(
        task.graph ?? {
            A: [["B", 1], ["E", 2]],
            B: [["A", 1], ["C", 1]],
            C: [["B", 1], ["D", 2]],
            D: [["C", 2], ["E", 1]],
            E: [["D", 1], ["A", 2]],
        },
    );
    const samples = Math.max(1, Math.min(600, Math.floor(task.samples ?? 24)));
    const rounds = Math.max(1, Math.min(30, Math.floor(task.rounds ?? 12)));
    const rng = makeRng(task.seed ?? 7);
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((p) => p[0])])].sort();
    const n = labels.length;
    const indexOf = new Map(labels.map((label, i) => [label, i]));

    const edgeMap = new Map<string, Edge>();
    for (const [u, list] of Object.entries(graph)) {
        const i = indexOf.get(u);
        if (i === undefined) continue;
        for (const [v, w] of list) {
            const j = indexOf.get(v);
            if (j === undefined || i === j) continue;
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            if (!edgeMap.has(key)) edgeMap.set(key, { i: Math.min(i, j), j: Math.max(i, j), w });
        }
    }
    const edges = [...edgeMap.values()];
    const totalWeight = edges.reduce((sum, e) => sum + e.w, 0);
    let step = 0;

    const vectors: Array<{ x: number; y: number }> = labels.map(() => {
        const angle = rng() * 2 * Math.PI;
        return { x: Math.cos(angle), y: Math.sin(angle) };
    });

    const edgesForFrame = (states: Map<string, EntityState>) =>
        edges.map((e) => ({
            id: `edge-${labels[e.i]}-${labels[e.j]}`,
            sourceId: `node-${labels[e.i]}`,
            targetId: `node-${labels[e.j]}`,
            label: String(e.w),
            state: states.get(`${e.i}-${e.j}`) ?? ("idle" as EntityState),
            directed: false,
        }));

    const makeFrame = (
        states: Map<number, EntityState>,
        edgeStates: Map<string, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: labels.map((label, i) => {
            const v = vectors[i]!;
            return {
                id: `node-${label}`,
                type: "node" as const,
                label,
                value: [v.x, v.y],
                state: states.get(i) ?? "unvisited",
                x: v.x,
                y: v.y,
                width: 0,
                height: 0,
                metadata: { label, index: i },
            } satisfies VisualEntity;
        }),
        edges: edgesForFrame(edgeStates),
        description,
        codeLineNumber,
        layout: "point",
        meta: { totalWeight, ...extra },
    });

    if (n === 0 || edges.length === 0) {
        yield makeFrame(
            new Map(),
            new Map(),
            "Empty graph - the maximum cut is empty.",
            0,
            { bestCut: 0, totalWeight, sdpValue: 0, expectedCut: 0, meanCut: 0, sides: [] },
        );
        return;
    }

    yield makeFrame(
        new Map(),
        new Map(),
        `Assigning ${n} vertices unit vectors for the vector-program relaxation.`,
        2,
        { bestCut: 0, totalWeight, sdpValue: 0, expectedCut: 0, meanCut: 0, sides: [] },
    );
    step += 1;

    // Local search on the vector program: move each vector away from the
    // weighted sum of its neighbors' vectors, then renormalize to unit length.
    for (let round = 1; round <= rounds; round += 1) {
        for (let v = 0; v < n; v += 1) {
            let sx = 0;
            let sy = 0;
            for (const e of edges) {
                if (e.i === v) {
                    sx += e.w * vectors[e.j]!.x;
                    sy += e.w * vectors[e.j]!.y;
                } else if (e.j === v) {
                    sx += e.w * vectors[e.i]!.x;
                    sy += e.w * vectors[e.i]!.y;
                }
            }
            const mag = Math.hypot(sx, sy);
            if (mag < 1e-9) continue;
            vectors[v] = { x: -sx / mag, y: -sy / mag };
        }
        if (round % 4 === 0 || round === rounds) {
            yield makeFrame(
                new Map(labels.map((_, i) => [i, "active" as EntityState])),
                new Map(),
                `Vector-program local search round ${round}: neighbors are pushed to opposite sides.`,
                3,
                { bestCut: 0, totalWeight, sdpValue: 0, expectedCut: 0, meanCut: 0, sides: [], round },
            );
            step += 1;
        }
    }

    const dot = (a: number, b: number): number =>
        Math.max(-1, Math.min(1, vectors[a]!.x * vectors[b]!.x + vectors[a]!.y * vectors[b]!.y));
    let sdpValue = 0;
    let expectedCut = 0;
    for (const e of edges) {
        const d = dot(e.i, e.j);
        sdpValue += e.w * (1 - d) / 2;
        expectedCut += (e.w * Math.acos(d)) / Math.PI;
    }

    let bestCut = -1;
    let bestSides: number[] = [];
    let cutSum = 0;
    const reportEvery = Math.max(1, Math.floor(samples / 6));
    for (let s = 0; s < samples; s += 1) {
        const theta = rng() * 2 * Math.PI;
        const nx = Math.cos(theta);
        const ny = Math.sin(theta);
        const sides = vectors.map((v) => (v.x * nx + v.y * ny >= 0 ? 1 : 0));
        let cut = 0;
        const cutEdges = new Map<string, EntityState>();
        for (const e of edges) {
            if (sides[e.i] !== sides[e.j]) {
                cut += e.w;
                cutEdges.set(`${e.i}-${e.j}`, "path");
            }
        }
        cutSum += cut;
        if (cut > bestCut) {
            bestCut = cut;
            bestSides = sides;
        }
        if (s % reportEvery === 0) {
            const nodeStates = new Map<number, EntityState>(
                sides.map((side, i) => [i, side === 1 ? "sorted" : "visited" as EntityState]),
            );
            yield makeFrame(
                nodeStates,
                cutEdges,
                `Random hyperplane ${s + 1}: cut weight ${cut} out of ${totalWeight}.`,
                5,
                {
                    bestCut,
                    totalWeight,
                    sdpValue,
                    expectedCut,
                    meanCut: cutSum / (s + 1),
                    sides,
                    sample: s + 1,
                    sampleCut: cut,
                },
            );
            step += 1;
        }
    }

    const bestEdgeStates = new Map<string, EntityState>();
    for (const e of edges) {
        if (bestSides[e.i] !== bestSides[e.j]) bestEdgeStates.set(`${e.i}-${e.j}`, "active");
    }
    yield makeFrame(
        new Map<number, EntityState>(
            bestSides.map((side, i) => [i, side === 1 ? "sorted" : "visited" as EntityState]),
        ),
        bestEdgeStates,
        `Goemans-Williamson found a cut of weight ${bestCut} of ${totalWeight} after ${samples} hyperplanes.`,
        7,
        {
            bestCut,
            totalWeight,
            sdpValue,
            expectedCut,
            meanCut: cutSum / samples,
            sides: bestSides,
            samples,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Max cut is hard, but relaxing each vertex to a point on a circle makes it easy: just push neighbors to opposite points. A random line through the origin then splits the points into two groups. The probability that an edge is cut is the angle between its endpoints divided by pi, which gives a guaranteed 0.878 fraction of the optimum when the underlying vector program is solved exactly.",
        invariants: [
            "Every vertex vector stays on the unit circle after each local-search move.",
            "A hyperplane assigns each vertex to exactly one of two sides.",
            "The cut weight is the sum of weights of edges whose endpoints land on opposite sides.",
        ],
        correctness:
            "The vector program is a relaxation of max cut because two-side assignments map to antipodal unit vectors whose objective equals the cut weight, so its optimum is an upper bound. For any feasible vectors, a random hyperplane separates two vectors with probability arccos of their dot product divided by pi, so the expected cut weight equals that sum and is at least 0.878 times the relaxed optimum, hence at least 0.878 times the true max cut when the relaxation is solved optimally. The reported cut is computed directly from the hyperplane sides, so it is always a genuine cut.",
        complexityRationale:
            "Each local-search round scans the edge list once, costing O(rounds * E), and each of the samples rounds scans every edge to score the cut, costing O(samples * E). Storing the vectors and edges takes O(V + E) space.",
        uses: [
            "Approximation algorithms for NP-hard partitioning problems",
            "Circuit partitioning and very-large-scale-integration layout",
            "A canonical example of semidefinite programming plus rounding",
        ],
        references: [
            "Goemans and Williamson, Improved Approximation Algorithms for Maximum Cut, Journal of the ACM, 1995",
            "Williamson and Shmoys, The Design of Approximation Algorithms, Chapter on semidefinite programming",
        ],
        workedExample:
            "For a triangle with unit weights, place the three vectors roughly 120 degrees apart. A random line through the origin puts one or two vertices on each side with probability two thirds per edge, so the expected cut is 2 of the 3 edges, which is the true maximum cut.",
    },
    id: "goemans-williamson-max-cut",
    name: "Goemans-Williamson Max-Cut",
    category: "graph",
    complexity: { time: "O(rounds·E + samples·E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [["B", 1], ["E", 2]],
            B: [["A", 1], ["C", 1]],
            C: [["B", 1], ["D", 2]],
            D: [["C", 2], ["E", 1]],
            E: [["D", 1], ["A", 2]],
        },
        samples: 24,
        seed: 7,
    },
    visualType: "point",
    run,
    pseudocode: [
        "build the weighted undirected edge list",
        "assign each vertex a random unit vector",
        "push each vector opposite its neighbors' weighted sum",
        "normalize and repeat the vector local search",
        "draw a random hyperplane through the origin",
        "put each vertex on the side its vector falls",
        "keep the heaviest cut over many hyperplanes",
        "done: report the best cut and its expected weight",
    ],
};

export default module;
