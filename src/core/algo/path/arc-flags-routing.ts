/**
 * arc-flags-routing.ts - Arc Flags Preprocessing for Point-to-Point Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Arc flags speed up shortest-path queries by preprocessing the graph once.
 * The vertices are partitioned into regions. For each region, a reverse
 * Dijkstra from every region member labels an edge with that region's flag
 * exactly when the edge lies on a shortest route toward the region. A query to
 * a target in region r then only traverses edges carrying flag r, which
 * dramatically shrinks the search while preserving the true shortest path.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R * (V + E) log V) preprocessing plus O((V + E) log V) per query
 *   Space: O(V + E * R) for distances and per-edge flag sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are directed weighted connections.
 *   - Edges carrying the current region flag are green.
 *   - The final shortest path is highlighted and reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface WeightedEdge {
    u: string;
    v: string;
    w: number;
    id: string;
}

/** Dijkstra with an optional edge predicate. */
function dijkstra(
    vertices: string[],
    edges: WeightedEdge[],
    start: string,
    allowed: (edge: WeightedEdge) => boolean,
): Map<string, number> {
    const adjacency = new Map<string, Array<{ to: string; w: number }>>(vertices.map((v) => [v, []]));
    for (const edge of edges) {
        if (allowed(edge)) {
            adjacency.get(edge.u)?.push({ to: edge.v, w: edge.w });
        }
    }
    const dist = new Map<string, number>(vertices.map((v) => [v, Infinity]));
    dist.set(start, 0);
    const visited = new Set<string>();
    for (;;) {
        let current: string | undefined;
        let best = Infinity;
        for (const v of vertices) {
            const d = dist.get(v) ?? Infinity;
            if (!visited.has(v) && d < best) {
                best = d;
                current = v;
            }
        }
        if (current === undefined) {
            break;
        }
        visited.add(current);
        for (const next of adjacency.get(current) ?? []) {
            const candidate = best + next.w;
            if (candidate < (dist.get(next.to) ?? Infinity)) {
                dist.set(next.to, candidate);
            }
        }
    }
    return dist;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            regions?: Record<string, number>;
        } | null
    ) ?? {};
    const graph = task.graph ?? {
        A: [["B", 2], ["C", 5]],
        B: [["A", 2], ["C", 1], ["D", 4]],
        C: [["A", 5], ["B", 1], ["D", 1]],
        D: [["B", 4], ["C", 1]],
    };
    const vertices = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((pair) => String(pair[0]))])].sort();
    const edges: WeightedEdge[] = [];
    for (const u of vertices) {
        for (const pair of graph[u] ?? []) {
            const v = String(pair[0]);
            const w = Number(pair[1]);
            if (vertices.includes(v) && Number.isFinite(w)) {
                edges.push({ u, v, w, id: `edge-${u}-${v}` });
            }
        }
    }
    const regions = new Map<string, number>(
        vertices.map((v) => [v, typeof task.regions?.[v] === "number" ? (task.regions[v] as number) : 0]),
    );
    const start = typeof task.start === "string" && vertices.includes(task.start) ? task.start : (vertices[0] ?? "");
    const target = typeof task.target === "string" && vertices.includes(task.target) ? task.target : (vertices[vertices.length - 1] ?? "");
    const regionIds = [...new Set([...regions.values()])].sort((a, b) => a - b);

    const reverseEdges: WeightedEdge[] = edges.map((edge) => ({ u: edge.v, v: edge.u, w: edge.w, id: `rev-${edge.id}` }));
    const flags = new Map<string, Set<number>>(edges.map((edge) => [edge.id, new Set<number>()]));

    const nodes: VisualEntity[] = vertices.map((v) => ({
        id: `node-${v}`,
        type: "node" as const,
        label: `${v}:R${regions.get(v) ?? 0}`,
        value: v,
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: v, region: regions.get(v) ?? 0 },
    }));
    const pathEdges = new Set<string>();

    const snap = (message: string, line: number, region: number | null, active: string): VisualFrame => {
        for (const node of nodes) {
            const v = String(node.value);
            node.state = v === active ? "active" : v === target ? "path" : "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map((edge) => ({
            id: edge.id,
            sourceId: `node-${edge.u}`,
            targetId: `node-${edge.v}`,
            label: String(edge.w),
            state: pathEdges.has(edge.id)
                ? "sorted"
                : region !== null && (flags.get(edge.id)?.has(region) ?? false)
                  ? "path"
                  : "idle",
            directed: true,
        }));
        const flagList: string[] = [];
        for (const edge of edges) {
            for (const r of flags.get(edge.id) ?? []) {
                flagList.push(`${edge.u}-${edge.v}:${r}`);
            }
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                edgeCount: edges.length,
                regionCount: regionIds.length,
                start,
                target,
                targetRegion: regions.get(target) ?? 0,
                flags: flagList,
                path: [...pathEdges],
                distance: 0,
                bruteForce: 0,
            },
        };
    };

    let step = 0;
    yield {
        ...snap(`Preprocessing arc flags for ${regionIds.length} region(s).`, 1, null, ""),
        stepNumber: step,
    };
    step += 1;

    for (const region of regionIds) {
        const sources = vertices.filter((v) => (regions.get(v) ?? 0) === region);
        const adjacency = new Map<string, Array<{ to: string; w: number }>>(vertices.map((v) => [v, []]));
        for (const edge of reverseEdges) {
            adjacency.get(edge.u)?.push({ to: edge.v, w: edge.w });
        }
        const dTo = new Map<string, number>(vertices.map((v) => [v, Infinity]));
        const visited = new Set<string>();
        for (const source of sources) {
            dTo.set(source, 0);
        }
        for (;;) {
            let current: string | undefined;
            let best = Infinity;
            for (const v of vertices) {
                const d = dTo.get(v) ?? Infinity;
                if (!visited.has(v) && d < best) {
                    best = d;
                    current = v;
                }
            }
            if (current === undefined) {
                break;
            }
            visited.add(current);
            for (const next of adjacency.get(current) ?? []) {
                const candidate = best + next.w;
                if (candidate < (dTo.get(next.to) ?? Infinity)) {
                    dTo.set(next.to, candidate);
                }
            }
        }
        for (const edge of edges) {
            const from = dTo.get(edge.u) ?? Infinity;
            const through = edge.w + (dTo.get(edge.v) ?? Infinity);
            if (Number.isFinite(from) && Math.abs(from - through) < 1e-9) {
                flags.get(edge.id)?.add(region);
            }
        }
        yield {
            ...snap(
                `Region ${region}: flagged edges that lie on a shortest route toward the region.`,
                3,
                region,
                sources[0] ?? "",
            ),
            stepNumber: step,
        };
        step += 1;
    }

    const targetRegion = regions.get(target) ?? 0;
    const startInRegion = (regions.get(start) ?? 0) === targetRegion;
    const filtered = dijkstra(vertices, edges, start, (edge) =>
        startInRegion ||
        (flags.get(edge.id)?.has(targetRegion) ?? false) ||
        ((regions.get(edge.u) ?? 0) === targetRegion && (regions.get(edge.v) ?? 0) === targetRegion),
    );
    const full = dijkstra(vertices, edges, start, () => true);
    let cursor = target;
    let guard = 0;
    while (cursor !== start && guard < vertices.length + 1) {
        let predecessor: string | undefined;
        let best = (filtered.get(cursor) ?? Infinity) + 1;
        for (const edge of edges) {
            if (edge.v !== cursor) {
                continue;
            }
            const candidate = (filtered.get(edge.u) ?? Infinity) + edge.w;
            if (candidate < best) {
                best = candidate;
                predecessor = edge.u;
                pathEdges.add(edge.id);
            }
        }
        if (predecessor === undefined) {
            break;
        }
        cursor = predecessor;
        guard += 1;
    }

    const finalFrame = snap(
        `Query ${start} to ${target}: flagged search gives ${filtered.get(target) ?? Infinity}, full Dijkstra gives ${full.get(target) ?? Infinity}.`,
        6,
        targetRegion,
        target,
    );
    finalFrame.stepNumber = step;
    finalFrame.meta = {
        ...finalFrame.meta,
        distance: Number.isFinite(filtered.get(target)) ? (filtered.get(target) as number) : 0,
        bruteForce: Number.isFinite(full.get(target)) ? (full.get(target) as number) : 0,
    };
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A shortest-path query to a fixed target wastes time exploring edges that lead away from it. If the map is split into regions, a one-time backward search from each region tells us which edges can ever be the last step of a shortest route into that region. During a query we ignore every other edge, so the search stays narrow without changing the answer.",
        invariants: [
            "An edge carries region r's flag only if it lies on a shortest path toward region r.",
            "Every shortest path to a target in region r uses only edges flagged for r.",
            "The flagged search never returns a distance below the true shortest distance.",
        ],
        correctness:
            "For an edge u to v and a region r, the reverse search computes the distance from each vertex to the nearest region member. The flag condition d(u) = w + d(v) means taking that edge is a consistent first step of a shortest route to r. Any shortest path from a source outside r to the target consists of flagged edges until it first enters r; by induction the restricted search reaches the region with the same optimal distance as unrestricted Dijkstra, and edges inside the target region are always allowed so the exact target is reached too.",
        complexityRationale:
            "Preprocessing runs one Dijkstra per region over the reversed graph, costing O(R (V + E) log V). Each query is a single Dijkstra over a subset of edges, O((V + E) log V), and storing one flag bit per edge and region uses O(E R) space.",
        uses: [
            "Fast point-to-point routing in road networks",
            "Preprocessing transit graphs for repeated travel queries",
            "Any setting with many queries to a small set of destination zones",
        ],
        references: [
            "Goldberg, Kaplan and Werneck, Arc Flags: Faster Planet-Wide Shortest Path Queries, 2007",
            "Bast et al., Route Planning in Transportation Networks",
        ],
        workedExample:
            "With regions left = {A, B} and right = {C, D}, the edge B-C of weight one lies on a shortest route into the right region and is flagged, while an edge pointing away from it is not. A query from A to D then follows only right-flagged edges and still obtains the shortest distance.",
    },
    id: "arc-flags-routing",
    name: "Arc Flags Routing",
    category: "shortest-path",
    complexity: { time: "O(R * (V + E) log V) preprocessing", space: "O(E * R)" },
    defaultInput: {
        graph: {
            A: [["B", 2], ["C", 5]],
            B: [["A", 2], ["C", 1], ["D", 4]],
            C: [["A", 5], ["B", 1], ["D", 1]],
            D: [["B", 4], ["C", 1]],
        },
        start: "A",
        target: "D",
        regions: { A: 0, B: 0, C: 1, D: 1 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "partition vertices into numbered regions",
        "for each region, run Dijkstra backward from all its members",
        "flag an edge when it lies on a shortest route to that region",
        "repeat until every region has been processed",
        "for a query, find the target region",
        "run Dijkstra from the start using only flagged edges",
        "reconstruct the path from the settled distances",
        "report the query distance and the flagged path",
    ],
};

export default module;
