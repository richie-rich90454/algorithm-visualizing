/**
 * customizable-route-planning.ts - Customizable Route Planning (CRP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Customizable route planning splits a road graph into cells and answers
 * shortest-path queries on a small overlay graph. Preprocessing decides which
 * nodes are cell boundaries; customization recomputes the distance between
 * every pair of boundary nodes inside each cell after travel costs change; a
 * query then runs Dijkstra on the overlay made of those shortcut distances
 * plus the edges that cross cells.
 *
 * The overlay is exact: any full path decomposes into intra-cell segments and
 * crossing edges, and each segment can be replaced by a shortcut no larger
 * than the original, while every overlay edge maps back to a real path.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Customization: O(sum over cells of b_c * (m_c log b_c)) for b_c boundary
 *                  nodes and m_c intra-cell edges
 *   Query:         O((V' + E') log V') on the overlay graph
 *   Space:         O(V + E)
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface WeightedEdge {
    u: string;
    v: string;
    w: number;
}

interface AdjEntry {
    to: string;
    w: number;
    id: string;
}

/** Undirected edge key, independent of endpoint order. */
function edgeKey(u: string, v: string): string {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
}

/** Dijkstra over an adjacency map; returns distances and predecessor edges. */
function dijkstra(
    adjacency: Map<string, AdjEntry[]>,
    start: string,
): { dist: Map<string, number>; parentEdge: Map<string, string> } {
    const dist = new Map<string, number>();
    const parentEdge = new Map<string, string>();
    const used = new Set<string>();
    for (const key of adjacency.keys()) {
        dist.set(key, Infinity);
    }
    dist.set(start, 0);
    while (true) {
        let best: string | undefined;
        let bestDist = Infinity;
        for (const [key, value] of dist) {
            if (!used.has(key) && value < bestDist) {
                best = key;
                bestDist = value;
            }
        }
        if (best === undefined || bestDist === Infinity) {
            break;
        }
        used.add(best);
        for (const entry of adjacency.get(best) ?? []) {
            if (used.has(entry.to)) {
                continue;
            }
            const candidate = bestDist + entry.w;
            if (candidate < (dist.get(entry.to) as number)) {
                dist.set(entry.to, candidate);
                parentEdge.set(entry.to, entry.id);
            }
        }
    }
    return { dist, parentEdge };
}

/** All-pairs shortest distances among a cell's boundary nodes using intra edges. */
function cellShortcuts(
    boundary: string[],
    edges: WeightedEdge[],
    weightOf: (edge: WeightedEdge) => number,
): Array<{ a: string; b: string; distance: number }> {
    const adjacency = new Map<string, AdjEntry[]>();
    const ids = new Set(boundary);
    for (const id of ids) {
        adjacency.set(id, []);
    }
    for (const edge of edges) {
        if (ids.has(edge.u) && ids.has(edge.v)) {
            const id = edgeKey(edge.u, edge.v);
            const w = weightOf(edge);
            adjacency.get(edge.u)?.push({ to: edge.v, w, id });
            adjacency.get(edge.v)?.push({ to: edge.u, w, id });
        }
    }
    const result: Array<{ a: string; b: string; distance: number }> = [];
    for (let i = 0; i < boundary.length; i += 1) {
        const source = boundary[i];
        if (!source) {
            continue;
        }
        const { dist } = dijkstra(adjacency, source);
        for (let j = i + 1; j < boundary.length; j += 1) {
            const target = boundary[j];
            if (target === undefined) {
                continue;
            }
            const d = dist.get(target) as number;
            if (Number.isFinite(d)) {
                result.push({ a: source, b: target, distance: d });
            }
        }
    }
    return result;
}

/** The CRP generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            cells?: Record<string, number>;
            start?: string;
            target?: string;
            customization?: Record<string, number>;
        } | null) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 4],
            ["D", 3],
        ],
        B: [
            ["C", 1],
            ["D", 5],
        ],
        C: [
            ["D", 2],
            ["E", 3],
        ],
        D: [["G", 2]],
        E: [
            ["F", 2],
            ["G", 3],
        ],
        F: [
            ["G", 1],
            ["H", 6],
        ],
        G: [["H", 5]],
        H: [["I", 4]],
        I: [],
    };
    const cells: Record<string, number> = task.cells ?? {
        A: 0,
        B: 0,
        C: 0,
        D: 0,
        E: 1,
        F: 1,
        G: 1,
        H: 2,
        I: 2,
    };
    const start = task.start ?? "A";
    const target = task.target ?? "I";
    const customization: Record<string, number> = task.customization ?? { "C-E": 8, "G-H": 1 };

    let step = 0;

    // Collect unique undirected edges.
    const edges: WeightedEdge[] = [];
    const seen = new Set<string>();
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const [v, w] of neighbors) {
            const key = edgeKey(u, v);
            if (!seen.has(key)) {
                seen.add(key);
                edges.push({ u, v, w });
            }
        }
    }
    const nodes = Array.from(
        new Set([...edges.flatMap((edge) => [edge.u, edge.v]), start, target]),
    );
    const cellOf = (v: string): number => cells[v] ?? 0;
    const weightOf = (edge: WeightedEdge): number => customization[edgeKey(edge.u, edge.v)] ?? edge.w;
    const crossing = edges.filter((edge) => cellOf(edge.u) !== cellOf(edge.v));
    const intra = edges.filter((edge) => cellOf(edge.u) === cellOf(edge.v));
    const crossingNodes = new Set(crossing.flatMap((edge) => [edge.u, edge.v]));
    const boundaryByCell = new Map<number, Set<string>>();
    for (const node of nodes) {
        if (crossingNodes.has(node) || node === start || node === target) {
            const cell = cellOf(node);
            const set = boundaryByCell.get(cell) ?? new Set<string>();
            set.add(node);
            boundaryByCell.set(cell, set);
        }
    }
    const cellIds = Array.from(new Set(nodes.map(cellOf))).sort((a, b) => a - b);

    const fullFrame = (message: string, codeLine: number, phase: string, cell: number): VisualFrame => {
        const entities: VisualEntity[] = nodes.map((label) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: cellOf(label) === cell ? ("active" as const) : ("unvisited" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, cell: cellOf(label) },
        }));
        const visualEdges: VisualEdge[] = edges.map((edge) => ({
            id: `edge-${edgeKey(edge.u, edge.v)}`,
            sourceId: `node-${edge.u}`,
            targetId: `node-${edge.v}`,
            label: String(weightOf(edge)),
            state:
                cellOf(edge.u) === cell && cellOf(edge.v) === cell
                    ? ("active" as const)
                    : ("idle" as const),
            directed: false,
        }));
        return {
            stepNumber: step,
            entities,
            edges: visualEdges,
            description: message,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: { phase, cell, nodeCount: nodes.length, edgeCount: edges.length },
        };
    };

    // Setup frame.
    yield fullFrame(
        `CRP on ${nodes.length} nodes partitioned into ${cellIds.length} cells; crossing edges connect cells.`,
        0,
        "setup",
        -1,
    );
    step += 1;

    // Preprocessing: identify each cell's boundary nodes.
    for (const cell of cellIds) {
        const members = nodes.filter((node) => cellOf(node) === cell);
        const boundary = Array.from(boundaryByCell.get(cell) ?? []);
        yield fullFrame(
            `Preprocess cell ${cell}: ${members.length} node(s), ${boundary.length} boundary node(s) become overlay vertices.`,
            2,
            "preprocess",
            cell,
        );
        step += 1;
    }

    // Customization: recompute within-cell boundary-to-boundary shortcuts.
    const shortcuts: Array<{ cell: number; a: string; b: string; distance: number }> = [];
    for (const cell of cellIds) {
        const boundary = Array.from(boundaryByCell.get(cell) ?? []);
        const cellEdges = intra.filter((edge) => cellOf(edge.u) === cell && cellOf(edge.v) === cell);
        const computed = cellShortcuts(boundary, cellEdges, weightOf);
        for (const shortcut of computed) {
            shortcuts.push({ cell, ...shortcut });
        }
        yield fullFrame(
            `Customize cell ${cell}: recomputed ${computed.length} shortcut distance(s) with the current weights.`,
            4,
            "customize",
            cell,
        );
        step += 1;
    }

    // Build the overlay graph from crossing edges and the customized shortcuts.
    const overlay = new Map<string, AdjEntry[]>();
    const overlayNodes = new Set<string>();
    for (const node of nodes) {
        overlay.set(node, []);
    }
    const addOverlayEdge = (a: string, b: string, w: number, id: string): void => {
        overlayNodes.add(a);
        overlayNodes.add(b);
        overlay.get(a)?.push({ to: b, w, id });
        overlay.get(b)?.push({ to: a, w, id });
    };
    for (const edge of crossing) {
        const id = edgeKey(edge.u, edge.v);
        addOverlayEdge(edge.u, edge.v, weightOf(edge), id);
    }
    for (const shortcut of shortcuts) {
        const id = `shortcut-${shortcut.cell}-${edgeKey(shortcut.a, shortcut.b)}`;
        addOverlayEdge(shortcut.a, shortcut.b, shortcut.distance, id);
    }

    const overlayFrame = (
        visited: Set<string>,
        current: string,
        activeEdges: Set<string>,
        pathNodes: Set<string>,
        pathEdges: Set<string>,
        message: string,
        codeLine: number,
        meta: Record<string, number | string | boolean>,
    ): VisualFrame => {
        const entities: VisualEntity[] = Array.from(overlayNodes).map((label) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: pathNodes.has(label)
                ? ("path" as const)
                : label === current
                  ? ("active" as const)
                  : visited.has(label)
                    ? ("visited" as const)
                    : ("unvisited" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, cell: cellOf(label) },
        }));
        const uniqueEdges = new Map<string, { a: string; b: string; w: number }>();
        for (const [a, list] of overlay) {
            for (const entry of list) {
                const id = entry.id;
                if (!uniqueEdges.has(id)) {
                    uniqueEdges.set(id, { a, b: entry.to, w: entry.w });
                }
            }
        }
        const visualEdges: VisualEdge[] = Array.from(uniqueEdges.entries()).map(([id, e]) => ({
            id,
            sourceId: `node-${e.a}`,
            targetId: `node-${e.b}`,
            label: e.w.toFixed(1),
            state: pathEdges.has(id)
                ? ("path" as const)
                : activeEdges.has(id)
                  ? ("active" as const)
                  : ("idle" as const),
            directed: false,
        }));
        return {
            stepNumber: step,
            entities,
            edges: visualEdges,
            description: message,
            codeLineNumber: codeLine,
            layout: "graph",
            meta,
        };
    };

    // Query: Dijkstra on the overlay graph.
    const { dist, parentEdge } = dijkstra(overlay, start);
    const visited = new Set<string>();
    const order: string[] = [];
    for (const [key, value] of dist) {
        if (Number.isFinite(value)) {
            order.push(key);
        }
    }
    order.sort((a, b) => (dist.get(a) as number) - (dist.get(b) as number));
    const settled = new Set<string>();
    for (const current of order) {
        const activeEdges = new Set<string>();
        let cursor: string | undefined = current;
        while (cursor !== undefined && parentEdge.has(cursor) && !settled.has(cursor)) {
            const edgeId = parentEdge.get(cursor) as string;
            activeEdges.add(edgeId);
            const entry: AdjEntry | undefined = (overlay.get(cursor) ?? []).find(
                (item) => item.id === edgeId,
            );
            cursor = entry?.to;
        }
        settled.add(current);
        visited.add(current);
        yield overlayFrame(
            visited,
            current,
            activeEdges,
            new Set(),
            new Set(),
            `Query settled overlay node ${current} at distance ${(dist.get(current) as number).toFixed(2)}.`,
            6,
            { phase: "query", current, settled: settled.size, found: false },
        );
        step += 1;
    }

    // Reconstruct the overlay path.
    const pathNodes = new Set<string>();
    const pathEdges = new Set<string>();
    const reachable = Number.isFinite(dist.get(target) as number);
    if (reachable) {
        let cursor: string | undefined = target;
        pathNodes.add(target);
        while (cursor !== undefined && parentEdge.has(cursor)) {
            const edgeId = parentEdge.get(cursor) as string;
            pathEdges.add(edgeId);
            const entry: AdjEntry | undefined = (overlay.get(cursor) ?? []).find(
                (item) => item.id === edgeId,
            );
            const prev: string | undefined = entry?.to;
            if (prev === undefined || pathNodes.has(prev)) {
                break;
            }
            pathNodes.add(prev);
            cursor = prev;
        }
    }
    yield overlayFrame(
        settled,
        target,
        new Set(),
        pathNodes,
        pathEdges,
        reachable
            ? `Query found ${start} to ${target} with cost ${(dist.get(target) as number).toFixed(2)} on the overlay.`
            : `${target} is unreachable from ${start}.`,
        7,
        {
            phase: "done",
            found: reachable,
            pathCost: reachable ? (dist.get(target) as number) : -1,
            shortcuts: shortcuts.length,
            crossingEdges: crossing.length,
        },
    );
}

/** The Customizable Route Planning module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than running a single huge shortest-path search on every query, split the map into cells. Only the nodes where roads leave a cell (plus the query endpoints) matter to the outside world, so precompute the distance between each pair of those boundary nodes inside every cell. When travel costs change, refresh just those local distances; a query then hops between boundary nodes on a tiny overlay graph.",
        invariants: [
            "A cell shortcut equals the shortest intra-cell distance between its two boundary nodes.",
            "Every overlay edge maps back to a real path of the same length in the full graph.",
            "Any full path decomposes into intra-cell segments joined by crossing edges.",
        ],
        correctness:
            "Replacing each intra-cell segment of a full shortest path by its shortcut cannot increase cost, so the overlay distance is at most the full distance. Conversely expanding every overlay shortcut into its realizing intra-cell path gives a valid full path of the same cost, so the overlay distance is at least the full distance. The two bounds meet, making the query exactly equivalent to Dijkstra on the full graph.",
        complexityRationale:
            "A cell with b boundary nodes runs b intra-cell Dijkstra searches over its m edges, so customization is O(b * m log b) per cell and is cheap to redo. The overlay has O(V') vertices and O(E') edges, giving O((V' + E') log V') per query and O(V + E) stored space.",
        uses: [
            "Turn-by-turn route planning in digital maps",
            "Fast re-optimization after live traffic updates",
            "Any large graph where many queries share the same topology",
        ],
        references: [
            "Geisberger, Sanders, Schultes, and Delling, Customizable Route Planning, 2011",
            "Dijkstra, A Note on Two Problems in Connexion with Graphs, 1959",
        ],
        workedExample:
            "Split a small graph into cells where A, C, D belong to cell 0 and E, G to cell 1. Inside cell 0 the shortcut from A to C is 3 via B, cheaper than the direct edge of 4. After a traffic update raises the C to E crossing cost, customization only recomputes local shortcuts; the overlay query then correctly routes through D to G.",
    },
    id: "customizable-route-planning",
    name: "Customizable Route Planning",
    category: "shortest-path",
    complexity: { time: "O(b m log b) customize; O(V' log V') query", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 4],
                ["D", 3],
            ],
            B: [
                ["C", 1],
                ["D", 5],
            ],
            C: [["D", 2]],
            D: [
                ["G", 2],
                ["C", 3],
            ],
            E: [
                ["F", 2],
                ["G", 3],
            ],
            F: [
                ["G", 1],
                ["H", 6],
            ],
            G: [["H", 5]],
            H: [["I", 4]],
            I: [],
        },
        cells: {
            A: 0,
            B: 0,
            C: 0,
            D: 0,
            E: 1,
            F: 1,
            G: 1,
            H: 2,
            I: 2,
        },
        start: "A",
        target: "I",
        customization: { "C-E": 8, "G-H": 1 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the weighted graph and a partition into cells",
        "mark nodes incident to crossing edges as boundary nodes",
        "for each cell list its boundary-to-boundary pairs",
        "recompute each pair's shortest intra-cell distance for current weights",
        "build the overlay from shortcut distances and crossing edges",
        "run Dijkstra on the overlay from the start node",
        "reconstruct the path through predecessor overlay edges",
        "done: report the query cost on the overlay",
    ],
};

export default module;
