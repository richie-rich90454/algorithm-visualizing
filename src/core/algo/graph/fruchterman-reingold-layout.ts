/**
 * fruchterman-reingold-layout.ts – Fruchterman-Reingold Force Layout
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fruchterman-Reingold is the classic force-directed graph drawing method.
 * Every vertex repels every other with a force of k squared over distance,
 * while edges pull their endpoints together with a force of distance squared
 * over k. Each step caps movement by a cooling temperature, so large motions
 * happen early and the drawing settles into an even, symmetric arrangement.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations · V^2) - all pairs repel each round
 *   Space: O(V + E) for positions, displacements, and edges
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Node positions are the computed coordinates; the point layout keeps them.
 *   - The endpoints of the edge under consideration are YELLOW (comparing).
 *   - The settled final drawing is GREEN (sorted); edges return to idle.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Point {
    x: number;
    y: number;
}

function lcg(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function undirectedEdges(adjacency: Record<string, string[]>): Array<[string, string]> {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [u, neighbors] of Object.entries(adjacency)) {
        for (const v of neighbors) {
            const key = [u, v].sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                out.push([u, v]);
            }
        }
    }
    return out;
}

function makeEntities(
    labels: string[],
    pos: Map<string, Point>,
    edges: Array<[string, string]>,
    states: Map<string, EntityState>,
): { nodes: VisualEntity[]; visualEdges: VisualEdge[] } {
    const nodes = labels.map((label) => {
        const p = pos.get(label) ?? { x: 0, y: 0 };
        return {
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: states.get(label) ?? "visited",
            x: p.x,
            y: p.y,
            width: 0,
            height: 0,
            metadata: { label },
        };
    });
    const visualEdges = edges.map(([u, v], index) => ({
        id: `edge-${index}-${u}-${v}`,
        sourceId: `node-${u}`,
        targetId: `node-${v}`,
        label: "",
        state: "idle" as const,
        directed: false,
    }));
    return { nodes, visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; iterations?: number; width?: number; height?: number } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D"],
        D: ["B", "C", "E"],
        E: ["D"],
    };
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const edges = undirectedEdges(adjacency);
    const iterations = Math.max(1, Math.min(200, typeof task.iterations === "number" ? task.iterations : 30));
    const width = typeof task.width === "number" ? task.width : 600;
    const height = typeof task.height === "number" ? task.height : 600;
    const area = width * height;
    const k = Math.sqrt(area / Math.max(1, labels.length));
    const rand = lcg(0x9e3779b9);

    const pos = new Map<string, Point>();
    labels.forEach((label, index) => {
        const angle = (2 * Math.PI * index) / Math.max(1, labels.length);
        const radius = k * 0.4;
        pos.set(label, {
            x: radius * Math.cos(angle) + (rand() - 0.5) * 0.01,
            y: radius * Math.sin(angle) + (rand() - 0.5) * 0.01,
        });
    });

    let step = 0;
    const snapshot = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState>,
        meta: Record<string, number | string | boolean | string[]>,
    ): VisualFrame => {
        const { nodes, visualEdges } = makeEntities(labels, pos, edges, states);
        return {
            stepNumber: step,
            entities: nodes,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "point",
            meta,
        };
    };

    yield snapshot(
        `Fruchterman-Reingold on ${labels.length} vertices; ideal edge length k = ${k.toFixed(1)}.`,
        0,
        new Map(),
        { iteration: 0, iterations, k, nodes: labels.length, edges: edges.length },
    );
    step += 1;

    const sampleEvery = Math.max(1, Math.floor(iterations / 8));
    for (let iter = 0; iter < iterations; iter += 1) {
        const disp = new Map<string, Point>(labels.map((label) => [label, { x: 0, y: 0 }]));
        // Repulsion between every pair.
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) {
                const a = labels[i] as string;
                const b = labels[j] as string;
                const pa = pos.get(a) as Point;
                const pb = pos.get(b) as Point;
                let dx = pa.x - pb.x;
                let dy = pa.y - pb.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 0.01) {
                    dx = 0.01;
                    dy = 0.01;
                    dist = Math.hypot(dx, dy);
                }
                const force = (k * k) / dist;
                const da = disp.get(a) as Point;
                const db = disp.get(b) as Point;
                da.x += (dx / dist) * force;
                da.y += (dy / dist) * force;
                db.x -= (dx / dist) * force;
                db.y -= (dy / dist) * force;
            }
        }
        // Attraction along each edge.
        for (const [u, v] of edges) {
            const pu = pos.get(u) as Point;
            const pv = pos.get(v) as Point;
            const dx = pu.x - pv.x;
            const dy = pu.y - pv.y;
            const dist = Math.max(0.01, Math.hypot(dx, dy));
            const force = (dist * dist) / k;
            const du = disp.get(u) as Point;
            const dv = disp.get(v) as Point;
            du.x -= (dx / dist) * force;
            du.y -= (dy / dist) * force;
            dv.x += (dx / dist) * force;
            dv.y += (dy / dist) * force;
        }
        const temperature = k * (1 - iter / iterations);
        for (const label of labels) {
            const p = pos.get(label) as Point;
            const d = disp.get(label) as Point;
            const length = Math.hypot(d.x, d.y);
            if (length > 0) {
                const limit = Math.min(length, temperature) / length;
                p.x += d.x * limit;
                p.y += d.y * limit;
            }
        }
        if ((iter + 1) % sampleEvery === 0 || iter === iterations - 1) {
            const focus = edges[iter % Math.max(1, edges.length)] ?? ["", ""];
            const states = new Map<string, EntityState>([
                [focus[0] as string, "comparing"],
                [focus[1] as string, "comparing"],
            ]);
            yield snapshot(
                `Iteration ${iter + 1}/${iterations}: repulsion k^2/d and attraction d^2/k, temperature ${temperature.toFixed(2)}.`,
                iter === iterations - 1 ? 5 : 3,
                states,
                { iteration: iter + 1, iterations, temperature, k, nodes: labels.length, edges: edges.length },
            );
            step += 1;
        }
    }

    const finalStates = new Map<string, EntityState>(
        labels.map((label) => [label, "sorted" as EntityState]),
    );
    yield snapshot(
        `Converged after ${iterations} iterations with ideal edge length ${k.toFixed(1)}.`,
        6,
        finalStates,
        {
            iteration: iterations,
            iterations,
            temperature: 0,
            k,
            nodes: labels.length,
            edges: edges.length,
            positions: labels.map((label) => {
                const p = pos.get(label) as Point;
                return `${label}:${p.x.toFixed(2)},${p.y.toFixed(2)}`;
            }),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of vertices as charged particles and edges as springs. Every vertex pushes every other away, and each edge pulls its two ends together. A temperature starts high so the drawing can reorganize early, then cools so later moves are small. The balance point spreads vertices evenly while keeping connected ones close.",
        invariants: [
            "Each displacement is capped by the current temperature.",
            "The temperature decreases monotonically toward zero.",
            "The ideal length k is sqrt(area over vertex count) and never changes.",
        ],
        correctness:
            "At a fixed point the repulsive push and spring pull on every vertex balance, which corresponds to a low value of the layout's energy function. Cooling guarantees steps shrink, so an iteration sequence settles instead of oscillating. The result is a force-directed drawing in which connected vertices are near each other and unrelated ones are spread apart.",
        complexityRationale:
            "Each round evaluates repulsion for all V squared pairs and attraction for E edges, so one round is O(V^2 + E). With a fixed iteration count the total is O(iterations · V^2), and storing positions, displacements, and edges uses O(V + E) space.",
        uses: [
            "Drawing social, biological, and dependency networks",
            "Producing readable diagrams in graph editors",
            "Initializing positions for other graph layout refinements",
        ],
        references: [
            "Fruchterman and Reingold, Graph Drawing by Force-Directed Placement, 1991",
            "Eades, A Heuristic for Graph Drawing, 1984",
        ],
        workedExample:
            "For a triangle with area 360000, k is sqrt(120000) or about 346. Starting on a tight circle, the three vertices repel until their pairwise distances approach k; the three springs keep the result an even triangle rather than letting it fly apart.",
    },
    id: "fruchterman-reingold-layout",
    name: "Fruchterman-Reingold Layout",
    category: "graph",
    complexity: { time: "O(iterations · V^2)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "D"],
            C: ["A", "D"],
            D: ["B", "C", "E"],
            E: ["D"],
        },
        iterations: 30,
    },
    visualType: "point",
    run,
    pseudocode: [
        "place vertices on a small circle and set k from the canvas area",
        "for each iteration set the temperature by cooling",
        "repel every pair of vertices by k squared over their distance",
        "attract each edge endpoint pair by distance squared over k",
        "cap each displacement by the temperature and move the vertices",
        "repeat until the iteration budget is exhausted",
        "done: return the settled vertex coordinates",
    ],
};

export default module;
