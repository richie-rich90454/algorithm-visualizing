/**
 * kinetic-mst.ts - Kinetic Minimum Spanning Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A kinetic MST tracks the minimum spanning tree of a set of points that move
 * continuously over time. As positions change, edge lengths change and the
 * optimal tree swaps edges. This visualization samples the motion at a series
 * of times and recomputes the MST at each sample with Kruskal's algorithm on
 * the complete graph of Euclidean distances.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Per time sample: O(n^2 log n) for n moving points (Kruskal on n^2 edges)
 *   Space:           O(n^2) for the complete edge set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points are drawn at their sampled coordinates.
 *   - Edges in the current MST are GREEN; other candidate edges stay idle.
 *   - The caption reports the sample time and the current MST weight.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface MovingPoint {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface CandidateEdge {
    i: number;
    j: number;
    weight: number;
}

/** Euclidean length of an edge between two sampled positions. */
function distance(
    a: readonly [number, number],
    b: readonly [number, number],
): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Recompute the MST with Kruskal on the complete graph of the sampled points. */
function computeMst(positions: Array<[number, number]>): {
    edges: CandidateEdge[];
    weight: number;
} {
    const edges: CandidateEdge[] = [];
    for (let i = 0; i < positions.length; i += 1) {
        for (let j = i + 1; j < positions.length; j += 1) {
            const a = positions[i];
            const b = positions[j];
            if (a && b) {
                edges.push({ i, j, weight: distance(a, b) });
            }
        }
    }
    edges.sort((a, b) => a.weight - b.weight);
    const parent = positions.map((_, index) => index);
    const find = (x: number): number => {
        while (parent[x] !== x) {
            const next = parent[x] as number;
            parent[x] = parent[next] as number;
            x = next;
        }
        return x;
    };
    const chosen: CandidateEdge[] = [];
    let weight = 0;
    for (const edge of edges) {
        const ra = find(edge.i);
        const rb = find(edge.j);
        if (ra !== rb) {
            parent[ra] = rb;
            chosen.push(edge);
            weight += edge.weight;
        }
    }
    return { edges: chosen, weight };
}

/** The Kinetic MST generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { points?: MovingPoint[]; times?: number[] } | null) ?? {};
    const points: MovingPoint[] = task.points ?? [
        { x: 0, y: 0, vx: 1, vy: 0 },
        { x: 4, y: 0, vx: -1, vy: 1 },
        { x: 3, y: 4, vx: 0, vy: -1 },
        { x: 0, y: 3, vx: 1, vy: 1 },
        { x: 2, y: 2, vx: -0.5, vy: -0.5 },
    ];
    const times: number[] = task.times ?? [0, 1, 2, 3];

    let step = 0;

    const makeFrame = (
        positions: Array<[number, number]>,
        chosen: Set<string>,
        time: number,
        weight: number,
        description: string,
        codeLine: number,
        phase: string,
    ): VisualFrame => {
        const entities: VisualEntity[] = positions.map(([x, y], index) => ({
            id: `pt-${index}`,
            type: "node" as const,
            label: `P${index}`,
            value: [x, y],
            state: "unvisited" as const,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, x, y },
        }));
        if (entities.length === 0) {
            entities.push({
                id: "empty",
                type: "node" as const,
                label: "-",
                value: [0, 0],
                state: "unvisited" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: -1, x: 0, y: 0 },
            });
        }
        const edges: VisualEdge[] = [];
        for (let i = 0; i < positions.length; i += 1) {
            for (let j = i + 1; j < positions.length; j += 1) {
                const a = positions[i];
                const b = positions[j];
                if (!a || !b) {
                    continue;
                }
                const active = chosen.has(`${i}-${j}`);
                edges.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `pt-${i}`,
                    targetId: `pt-${j}`,
                    label: distance(a, b).toFixed(1),
                    state: active ? ("sorted" as const) : ("idle" as const),
                    directed: false,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "point",
            meta: { time, mstWeight: weight, mstEdges: chosen.size, phase },
        };
    };

    // Setup frame: the points at the first sampled time, no tree chosen yet.
    const initial = points.map((p) => [p.x + p.vx * (times[0] ?? 0), p.y + p.vy * (times[0] ?? 0)] as [number, number]);
    yield makeFrame(initial, new Set(), times[0] ?? 0, 0, "Kinetic MST: points move over time; each sample recomputes the tree by Kruskal.", 0, "setup");
    step += 1;

    // One frame per time sample with the freshly recomputed MST highlighted.
    for (const time of times) {
        const positions = points.map(
            (p) => [p.x + p.vx * time, p.y + p.vy * time] as [number, number],
        );
        const mst = computeMst(positions);
        const chosen = new Set(mst.edges.map((edge) => `${edge.i}-${edge.j}`));
        yield makeFrame(
            positions,
            chosen,
            time,
            mst.weight,
            `At time ${time}: MST has ${mst.edges.length} edge(s) and total weight ${mst.weight.toFixed(2)}.`,
            3,
            "sample",
        );
        step += 1;
    }
}

/** The Kinetic MST module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A kinetic MST asks how the cheapest spanning tree changes while the vertices drift. Instead of maintaining the exact event schedule when two edges tie, this visualization samples the motion at several times and solves each snapshot as an ordinary weighted MST problem, making the edge swaps visible one moment at a time.",
        invariants: [
            "At every sampled time the chosen edges form a spanning tree with n-1 edges.",
            "The chosen edges connect all points without a cycle.",
            "Sample time determines each point's position as start plus velocity times time.",
        ],
        correctness:
            "At a fixed time the edge lengths are fixed scalars, so the cut property applies: the lightest edge crossing any cut belongs to some MST, and Kruskal's sorted-edge cycle test produces a minimum spanning tree. The union-find accepts exactly the edges that join distinct components, so the result is acyclic, spanning, and minimum for that sample.",
        complexityRationale:
            "A complete graph on n points has O(n^2) edges; sorting them costs O(n^2 log n), which dominates each sample. Storing the edge list uses O(n^2) space per snapshot.",
        uses: [
            "Tracking network topology as nodes move, such as ad hoc wireless networks",
            "Motion planning and shape matching over time-varying point sets",
            "Teaching kinetic data structures and kinetic events",
        ],
        references: [
            "Basch, Guibas, and Hershberger, Data Structures for Mobile Data, 1997",
            "CLRS, Introduction to Algorithms, Chapter 23 on minimum spanning trees",
        ],
        workedExample:
            "Two points at (0,0) and (3,4) need one edge of length 5. Move the second point along x to (4,4) at time 1 and the edge length becomes sqrt(32); the single-edge MST tracks that growth. With more points, the green set swaps edges whenever a shorter connection overtakes an older one.",
    },
    id: "kinetic-mst",
    name: "Kinetic Minimum Spanning Tree",
    category: "mst",
    complexity: { time: "O(n^2 log n) per sample", space: "O(n^2)" },
    defaultInput: {
        points: [
            { x: 0, y: 0, vx: 1, vy: 0 },
            { x: 4, y: 0, vx: -1, vy: 1 },
            { x: 3, y: 4, vx: 0, vy: -1 },
            { x: 0, y: 3, vx: 1, vy: 1 },
            { x: 2, y: 2, vx: -0.5, vy: -0.5 },
        ],
        times: [0, 1, 2, 3],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read moving points with start positions and velocities",
        "for each sampled time compute each point's current position",
        "build the complete graph with Euclidean edge weights",
        "sort all edges by increasing weight",
        "add an edge when it joins two different components",
        "record the total weight of the accepted edges",
        "emit the sampled MST and advance to the next time",
        "done: all sampled trees have been shown",
    ],
};

export default module;
