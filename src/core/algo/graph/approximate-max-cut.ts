/**
 * approximate-max-cut.ts - Randomized Local Search Max-Cut
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Max-Cut asks for a split of the vertices that maximizes the number of edges
 * crossing between the two sides. This heuristic starts from a random split
 * and repeatedly moves the vertex whose flip gains the most crossings. It
 * stops at a local optimum, which always captures at least half of all edges
 * because every vertex then has at least as many crossing as same-side edges.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(passes * (V + E)) for repeated delta scans and flips
 *   Space: O(V + E) for adjacency, side labels, and edge entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Side A is BLUE and side B is ORANGE; cut edges are RED.
 *   - The vertex chosen for a flip flashes YELLOW.
 *   - meta tracks the cut before, after, and the number of flips.
 */

import type { AlgorithmModule, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

function rng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Adj; seed?: number; maxPasses?: number } | null) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "C", "E"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C", "E", "F"],
        E: ["A", "D", "F"],
        F: ["D", "E"],
    };
    const vertices = Object.keys(adjacency).sort();
    if (vertices.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - the cut is zero.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { cutSize: 0, initialCut: 0, flips: 0 },
        };
        return;
    }
    const edges: Array<{ a: string; b: string; id: string }> = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ a, b, id: `edge-${[a, b].sort().join("-")}` });
        }
    }
    const next = rng(typeof task.seed === "number" ? Math.floor(task.seed) : 5);
    const maxPasses = typeof task.maxPasses === "number" ? Math.max(1, Math.floor(task.maxPasses)) : 40;
    const side = new Map(vertices.map((v) => [v, next() < 0.5 ? 0 : 1]));
    const cutSize = (): number => edges.filter((e) => side.get(e.a) !== side.get(e.b)).length;
    const initialCut = cutSize();
    const nodes = makeGraphNodes(vertices);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let flips = 0;
    let step = 0;
    let localOptimum = false;

    const snap = (description: string, line: number, chosen: string | null): VisualFrame => {
        for (const node of nodes) node.state = side.get(String(node.value)) === 0 ? "sorted" : "active";
        if (chosen) {
            const n = byId.get(`node-${chosen}`);
            if (n) n.state = "comparing";
        }
        const visualEdges = edges.map((e) => ({
            id: e.id,
            sourceId: `node-${e.a}`,
            targetId: `node-${e.b}`,
            label: "",
            state: side.get(e.a) !== side.get(e.b) ? ("error" as const) : ("idle" as const),
            directed: false,
        }));
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: visualEdges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                cutSize: cutSize(),
                initialCut,
                flips,
                totalEdges: edges.length,
                localOptimum,
                partitionA: vertices.filter((v) => side.get(v) === 0).join(","),
                partitionB: vertices.filter((v) => side.get(v) === 1).join(","),
            },
        };
    };

    yield snap(`Random split created; ${initialCut} of ${edges.length} edges cross.`, 0, null);
    step += 1;

    for (let pass = 0; pass < maxPasses; pass += 1) {
        let bestVertex: string | null = null;
        let bestGain = 0;
        const delta = (v: string): number => {
            let same = 0;
            let cross = 0;
            for (const edge of edges) {
                if (edge.a === v || edge.b === v) {
                    const other = edge.a === v ? edge.b : edge.a;
                    if (side.get(other) === side.get(v)) same += 1;
                    else cross += 1;
                }
            }
            return same - cross;
        };
        for (const v of vertices) {
            const gain = delta(v);
            if (gain > bestGain) {
                bestGain = gain;
                bestVertex = v;
            }
        }
        if (bestVertex === null) {
            localOptimum = true;
            yield snap(`Pass ${pass + 1}: no flip improves the cut, so this is a local optimum.`, 5, null);
            step += 1;
            break;
        }
        side.set(bestVertex, side.get(bestVertex) === 0 ? 1 : 0);
        flips += 1;
        yield snap(
            `Pass ${pass + 1}: flip ${bestVertex} for a gain of ${bestGain}; cut is now ${cutSize()}.`,
            3,
            bestVertex,
        );
        step += 1;
    }

    yield snap(
        `Local-optimal cut: ${cutSize()} of ${edges.length} edges after ${flips} flip(s); at least half of all edges.`,
        6,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split the vertices randomly, then look for a vertex that has more neighbors on its own side than across. Moving such a vertex to the other side can only help, because those same-side edges become crossings. Keep moving the best one until every vertex is happier where it sits.",
        invariants: [
            "Every vertex stays on exactly one of the two sides.",
            "A flip is performed only when it strictly increases the cut.",
            "The cut size never decreases during a run.",
        ],
        correctness:
            "Flipping a vertex changes the cut by its same-side edge count minus its crossing count, so a positive delta strictly improves the cut and the loop terminates because the cut is bounded by the edge count. At a local optimum each vertex has at least as many crossing edges as same-side edges; summing over vertices counts every edge twice and gives two times the cut at least two times the same-side total, hence the cut is at least half of all edges.",
        complexityRationale:
            "Computing a vertex's delta scans its adjacency, so one scan of all vertices costs O(V + E); with a bounded number of improving passes the total is O(passes * (V + E)). Storing sides, adjacency, and edges uses O(V + E) space.",
        uses: [
            "Partitioning integrated circuits to minimize connecting wires",
            "Community detection as a quick baseline split",
            "Approximate solutions to Ising spin-glass energy minimization",
        ],
        references: [
            "Goemans and Williamson, Improved Approximation Algorithms for Maximum Cut, 1995",
            "Papadimitriou, Computational Complexity, local search discussion",
        ],
        workedExample:
            "On a triangle with one extra pendant edge, a random split puts two triangle vertices together. Flipping the third gains two crossings and creates a cut of three out of four edges, which is optimal and at least half of the edges.",
    },
    id: "approximate-max-cut",
    name: "Approximate Max-Cut (Local Search)",
    category: "graph",
    complexity: { time: "O(passes * (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C", "E"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C", "E", "F"],
            E: ["A", "D", "F"],
            F: ["D", "E"],
        },
        seed: 5,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "assign each vertex to one of two random sides",
        "count the edges crossing between the sides",
        "for every vertex compute same-side minus crossing degree",
        "if some vertex has a positive gain, flip the best one",
        "recount the cut after each flip",
        "stop when no vertex has a positive gain",
        "report the local-optimal cut size",
        "confirm the cut is at least half of all edges",
    ],
};

export default module;
