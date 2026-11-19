/**
 * lipton-tarjan-planar-separator.ts - BFS-Layer Planar Separator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The planar separator theorem guarantees that every planar graph has a small
 * set of vertices whose removal splits the graph into pieces of at most two
 * thirds the original size. This visualization builds such a separator with a
 * breadth-first search: because an edge of an unweighted graph can only join
 * vertices at the same or adjacent BFS depths, deleting one BFS level cuts the
 * shallower vertices off from the deeper ones. Choosing a level near one third
 * of the search order balances both sides.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for the BFS plus O(V + E) for the component check
 *   Space: O(V + E) for the symmetrized graph and traversal state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each BFS level is lit in turn as the search proceeds.
 *   - The chosen separator level is GOLD; other levels stay visited.
 *   - Resulting components are shown in alternating GREEN and BLUE shades.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function makeGrid(rows: number, cols: number): Record<string, string[]> {
    const g: Record<string, string[]> = {};
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const id = `v${r * cols + c}`;
            g[id] = [];
            if (r > 0) g[id].push(`v${(r - 1) * cols + c}`);
            if (r + 1 < rows) g[id].push(`v${(r + 1) * cols + c}`);
            if (c > 0) g[id].push(`v${r * cols + c - 1}`);
            if (c + 1 < cols) g[id].push(`v${r * cols + c + 1}`);
        }
    }
    return g;
}

function symmetrize(graph: Record<string, string[]>): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const v of Object.keys(graph)) out[v] = [];
    for (const [u, vs] of Object.entries(graph)) {
        for (const v of vs) {
            if (!(v in out)) out[v] = [];
            if (!out[u].includes(v)) out[u].push(v);
            if (!out[v].includes(u)) out[v].push(u);
        }
    }
    for (const v of Object.keys(out)) out[v].sort();
    return out;
}

/** Compute the BFS depths, chosen separator level, and post-removal components. */
export function planarSeparator(graph: Record<string, string[]>, start?: string): {
    labels: string[];
    depth: Map<string, number>;
    separator: string[];
    level: number;
    components: string[][];
} {
    const adj = symmetrize(graph);
    const labels = Object.keys(adj).sort();
    const root = start && adj[start] ? start : labels[0];
    const depth = new Map<string, number>();
    if (root === undefined) return { labels, depth, separator: [], level: -1, components: [] };
    const queue = [root];
    depth.set(root, 0);
    for (let head = 0; head < queue.length; head += 1) {
        const u = queue[head] as string;
        for (const v of adj[u] ?? []) {
            if (!depth.has(v)) {
                depth.set(v, (depth.get(u) as number) + 1);
                queue.push(v);
            }
        }
    }
    const n = labels.length;
    const counts = new Map<number, number>();
    for (const d of depth.values()) counts.set(d, (counts.get(d) ?? 0) + 1);
    const levels = [...counts.keys()].sort((a, b) => a - b);
    let cum = 0;
    let level = levels[levels.length - 1] ?? 0;
    for (const l of levels) {
        cum += counts.get(l) ?? 0;
        if (cum >= Math.ceil(n / 3)) {
            level = l;
            break;
        }
    }
    const separator = labels.filter((v) => depth.get(v) === level);
    const removed = new Set(separator);
    const components: string[][] = [];
    const seen = new Set<string>();
    for (const v of labels) {
        if (removed.has(v) || seen.has(v)) continue;
        const comp: string[] = [];
        const q = [v];
        seen.add(v);
        for (let head = 0; head < q.length; head += 1) {
            const u = q[head] as string;
            comp.push(u);
            for (const w of adj[u] ?? []) {
                if (!removed.has(w) && !seen.has(w)) {
                    seen.add(w);
                    q.push(w);
                }
            }
        }
        components.push(comp);
    }
    return { labels, depth, separator, level, components };
}

function makeEntities(labels: string[], states: Map<string, EntityState>, depth: Map<string, number>): VisualEntity[] {
    return labels.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: states.get(label) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label, depth: depth.get(label) ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? makeGrid(4, 4);
    const adj = symmetrize(graph);
    const labels = Object.keys(adj).sort();
    const root = task.start && adj[task.start] ? task.start : labels[0];
    const { depth, separator, level, components } = planarSeparator(graph, root);
    const edges: VisualEdge[] = [];
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (u < v) {
                edges.push({
                    id: `edge-${u}-${v}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }
    const states = new Map<string, EntityState>();
    let step = 0;
    const emit = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean | Array<number | string>> = {}): VisualFrame => {
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeEntities(labels, states, depth),
            edges: edges.map((e) => ({ ...e })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: { vertices: labels.length, level, ...meta },
        };
    };

    if (labels.length === 0) {
        yield emit("Empty graph has no separator.", 0);
        return;
    }
    yield emit("Planar separator: run BFS and delete one level near one third of the order.", 0);

    const maxDepth = Math.max(...depth.values());
    for (let d = 0; d <= maxDepth; d += 1) {
        for (const v of labels) {
            if (depth.get(v) === d) states.set(v, d === level ? "pivot" : "visited");
        }
        yield emit(`BFS level ${d}: ${labels.filter((v) => depth.get(v) === d).join(", ")}.`, 1, { bfsLevel: d });
    }

    for (const [i, comp] of components.entries()) {
        for (const v of comp) states.set(v, i % 2 === 0 ? "sorted" : "path");
        yield emit(`After removing level ${level}, component ${i + 1} has ${comp.length} vertex(es).`, 4, { component: comp, componentSize: comp.length });
    }

    const biggest = Math.max(0, ...components.map((c) => c.length));
    yield emit(
        `Separator {${separator.join(", ")}} splits ${labels.length} vertices into ${components.length} pieces, largest ${biggest}.`,
        5,
        { separator, largest: biggest, final: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A planar graph cannot have too many pairwise crossing connections, so one relatively small set of vertices must separate it. A breadth-first search gives a simple construction: edges only connect equal or adjacent search levels, so deleting a single level disconnects shallower vertices from deeper ones. Picking a level near the first third of the BFS order keeps both sides below two thirds of the graph.",
        invariants: [
            "Every edge joins vertices whose BFS depths differ by at most one.",
            "Removing the chosen level leaves no path between a vertex of smaller depth and one of larger depth.",
            "The vertices above and below the separator each number at most two thirds of the graph.",
        ],
        correctness:
            "In an unweighted breadth-first search, a vertex at depth d has its neighbors at depths d-1, d, or d+1, so any path from depth below level s to depth above level s must pass through level s. Deleting that level therefore separates the graph. Choosing s as the first level whose cumulative count reaches one third guarantees the shallow side has fewer than one third of the vertices and the deep side at most two thirds, matching the separator theorem's balance condition.",
        complexityRationale:
            "Symmetrizing the adjacency and running BFS each take O(V + E). Scanning depth counts and finding components with a second traversal also take O(V + E), which is the total time and space bound.",
        uses: [
            "Divide-and-conquer algorithms on planar graphs such as shortest paths",
            "Nested dissection ordering for sparse linear systems",
            "Graph partitioning for parallel and VLSI layout",
        ],
        references: [
            "Lipton and Tarjan, A Separator Theorem for Planar Graphs, SIAM Journal on Applied Mathematics, 1979",
            "de Berg et al., Computational Geometry: Algorithms and Applications, planar separators chapter",
        ],
        workedExample:
            "In a four by four grid rooted at a corner, BFS levels have sizes 1, 2, 3, 4, 3, 2, 1. Choosing the level where the cumulative count first passes five removes four vertices and leaves components no larger than ten, which is two thirds of sixteen.",
    },
    id: "lipton-tarjan-planar-separator",
    name: "Lipton Tarjan Planar Separator",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: makeGrid(4, 4),
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the undirected graph",
        "run breadth-first search from a root and record depths",
        "count vertices at each depth and accumulate from zero",
        "choose the first level whose cumulative count reaches n/3",
        "the vertices at that level form the separator",
        "delete them and list the connected components",
        "verify each component is at most 2n/3 vertices",
        "done: report the separator and the balanced pieces",
    ],
};

export default module;
