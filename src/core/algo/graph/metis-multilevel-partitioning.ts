/**
 * metis-multilevel-partitioning.ts – Multilevel Graph Partitioning (METIS style)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is the multilevel paradigm behind METIS. Heavy-edge matching collapses
 * the graph into smaller and smaller graphs, a balanced initial partition is
 * cut on the coarsest graph, and the partition is projected back while a
 * Kernighan-Lin style pass moves border vertices to reduce the cut. Coarsening
 * makes global structure cheap to see; refinement repairs local detail.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + E) · levels) - linear work per coarsening or refinement level
 *   Space: O(V + E) for the graph hierarchy and partition arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertex fill color encodes the current part or coarsening cluster.
 *   - Edges crossing between parts are RED (swapped); internal edges are idle.
 *   - The final balanced partition turns every vertex GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Graph {
    nodes: string[];
    adj: Map<string, Set<string>>;
    edges: Array<[string, string]>;
}

const PALETTE: EntityState[] = ["comparing", "highlight", "path", "active", "visited", "pivot"];

function buildGraph(adjacency: Record<string, string[]>): Graph {
    const nodes = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])].sort();
    const adj = new Map<string, Set<string>>(nodes.map((n) => [n, new Set<string>()]));
    const seen = new Set<string>();
    const edges: Array<[string, string]> = [];
    for (const [u, neighbors] of Object.entries(adjacency)) {
        for (const v of neighbors) {
            if (!adj.has(u) || !adj.has(v)) continue;
            adj.get(u)!.add(v);
            adj.get(v)!.add(u);
            const key = [u, v].sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([u, v]);
            }
        }
    }
    return { nodes, adj, edges };
}

function coarsen(g: Graph): { graph: Graph; mapping: Map<string, string[]> } {
    const matched = new Set<string>();
    const clusters: string[][] = [];
    const nodes = [...g.nodes];
    for (const v of nodes) {
        if (matched.has(v)) continue;
        let best: string | undefined;
        let bestWeight = 0;
        for (const w of g.adj.get(v) ?? []) {
            if (matched.has(w)) continue;
            const weight = [...(g.adj.get(v) ?? [])].filter((x) => g.adj.get(w)!.has(x)).length + 1;
            if (weight > bestWeight) {
                bestWeight = weight;
                best = w;
            }
        }
        matched.add(v);
        if (best !== undefined) {
            matched.add(best);
            clusters.push([v, best]);
        } else {
            clusters.push([v]);
        }
    }
    const coarseNodes = clusters.map((_, i) => `g${i}`);
    const nameOf = new Map<string, string>();
    clusters.forEach((members, i) => members.forEach((m) => nameOf.set(m, coarseNodes[i] as string)));
    const adj = new Map<string, Set<string>>(coarseNodes.map((n) => [n, new Set<string>()]));
    const seen = new Set<string>();
    const edges: Array<[string, string]> = [];
    for (const [u, v] of g.edges) {
        const a = nameOf.get(u) as string;
        const b = nameOf.get(v) as string;
        if (a === b) continue;
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
        const key = [a, b].sort().join("|");
        if (!seen.has(key)) {
            seen.add(key);
            edges.push([a, b]);
        }
    }
    return { graph: { nodes: coarseNodes, adj, edges }, mapping: new Map(coarseNodes.map((n, i) => [n, clusters[i] as string[]])) };
}

function cutOf(g: Graph, part: Map<string, number>): number {
    let cut = 0;
    for (const [u, v] of g.edges) {
        if ((part.get(u) ?? 0) !== (part.get(v) ?? 0)) cut += 1;
    }
    return cut;
}

function greedyPartition(g: Graph, k: number): Map<string, number> {
    const part = new Map<string, number>();
    const sizes = new Array<number>(k).fill(0);
    for (const v of g.nodes) {
        // Seed the first k vertices round-robin so no part starts empty.
        let best = part.size < k ? part.size : 0;
        let bestScore = part.size < k ? Infinity : -Infinity;
        if (part.size >= k) {
            for (let p = 0; p < k; p += 1) {
                let score = 0;
                for (const w of g.adj.get(v) ?? []) if (part.get(w) === p) score += 1;
                score -= sizes[p]! * 0.5;
                if (score > bestScore) {
                    bestScore = score;
                    best = p;
                }
            }
        }
        part.set(v, best);
        sizes[best] = (sizes[best] ?? 0) + 1;
    }
    return part;
}

interface RefineMove {
    vertex: string;
    from: number;
    to: number;
    cutAfter: number;
}

function refine(g: Graph, part: Map<string, number>, k: number): RefineMove[] {
    const moves: RefineMove[] = [];
    const sizes = new Array<number>(k).fill(0);
    for (const p of part.values()) sizes[p as number] = (sizes[p as number] ?? 0) + 1;
    const upper = Math.ceil(g.nodes.length / k) + 1;
    const lower = Math.floor(g.nodes.length / k);
    for (let pass = 0; pass < 4; pass += 1) {
        let improved = false;
        for (const v of g.nodes) {
            const current = part.get(v) ?? 0;
            let neighborsCurrent = 0;
            const neighborsPart = new Array<number>(k).fill(0);
            for (const w of g.adj.get(v) ?? []) {
                const p = part.get(w) ?? 0;
                if (p === current) neighborsCurrent += 1;
                else neighborsPart[p] = (neighborsPart[p] ?? 0) + 1;
            }
            let bestPart = current;
            let bestGain = 0;
            for (let p = 0; p < k; p += 1) {
                if (p === current) continue;
                if ((sizes[p] ?? 0) + 1 > upper || (sizes[current] ?? 0) - 1 < lower) continue;
                const gain = (neighborsPart[p] ?? 0) - neighborsCurrent;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestPart = p;
                }
            }
            if (bestPart !== current) {
                part.set(v, bestPart);
                sizes[current] = (sizes[current] ?? 0) - 1;
                sizes[bestPart] = (sizes[bestPart] ?? 0) + 1;
                improved = true;
                moves.push({ vertex: v, from: current, to: bestPart, cutAfter: cutOf(g, part) });
            }
        }
        if (!improved) break;
    }
    return moves;
}

function makeEntities(
    nodes: string[],
    edges: Array<[string, string]>,
    colorOf: (node: string) => number | null,
): { entities: VisualEntity[]; visualEdges: VisualEdge[] } {
    const entities = nodes.map((label) => {
        const color = colorOf(label);
        return {
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: (color === null ? "sorted" : PALETTE[color % PALETTE.length] ?? "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, part: color ?? -1 },
        };
    });
    const visualEdges: VisualEdge[] = edges.map(([u, v], index) => ({
        id: `edge-${index}-${u}-${v}`,
        sourceId: `node-${u}`,
        targetId: `node-${v}`,
        label: "",
        state: (colorOf(u) !== null && colorOf(v) !== null && colorOf(u) !== colorOf(v) ? "swapped" : "idle") as EntityState,
        directed: false,
    }));
    return { entities, visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; k?: number } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["A", "B", "C", "E"],
        E: ["D", "F", "G"],
        F: ["E", "G", "H"],
        G: ["E", "F", "H"],
        H: ["F", "G"],
    };
    const k = Math.max(2, Math.min(6, typeof task.k === "number" ? Math.floor(task.k) : 2));
    const original = buildGraph(adjacency);
    const graphs: Graph[] = [original];
    const mappings: Array<Map<string, string[]>> = [];
    let currentOfOriginal = new Map<string, string>(original.nodes.map((n) => [n, n]));
    const clusterFrames: Array<Map<string, number>> = [];

    let g = original;
    const limit = Math.max(2 * k, 4);
    for (let level = 0; level < 5 && g.nodes.length > limit; level += 1) {
        const { graph: coarse, mapping } = coarsen(g);
        if (coarse.nodes.length >= g.nodes.length) break;
        const clusterId = new Map(coarse.nodes.map((n, i) => [n, i]));
        for (const [coarseNode, finers] of mapping) {
            for (const finer of finers) {
                for (const [orig, cur] of currentOfOriginal) {
                    if (cur === finer) currentOfOriginal.set(orig, coarseNode);
                }
            }
        }
        const clusterOf = new Map<string, number>();
        for (const label of original.nodes) {
            clusterOf.set(label, clusterId.get(currentOfOriginal.get(label) as string) ?? 0);
        }
        clusterFrames.push(clusterOf);
        mappings.push(mapping);
        graphs.push(coarse);
        g = coarse;
    }

    let part = greedyPartition(g, k);
    let initialPart = new Map<string, number>();
    let refinement: RefineMove[] = [];
    for (let i = graphs.length - 1; i >= 0; i -= 1) {
        if (i < graphs.length - 1) {
            const mapping = mappings[i] as Map<string, string[]>;
            const projected = new Map<string, number>();
            for (const [coarseNode, finers] of mapping) {
                const p = part.get(coarseNode) ?? 0;
                for (const finer of finers) projected.set(finer, p);
            }
            part = projected;
        }
        if (i === 0) {
            initialPart = new Map(part);
            refinement = refine(graphs[0] as Graph, part, k);
        } else {
            refine(graphs[i] as Graph, part, k);
        }
    }
    // Fallback when the graph was small enough that no coarsening happened.
    if (initialPart.size === 0) {
        initialPart = new Map(part);
        refinement = refine(original, part, k);
    }

    let step = 0;
    const frame = (
        description: string,
        codeLineNumber: number,
        colorOf: (node: string) => number | null,
        meta: Record<string, number | string | boolean | string[]>,
        final = false,
    ): VisualFrame => {
        const { entities, visualEdges } = makeEntities(original.nodes, original.edges, colorOf);
        if (final) for (const entity of entities) entity.state = "sorted";
        return {
            stepNumber: step,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta,
        };
    };

    yield frame(
        `Multilevel partition of ${original.nodes.length} vertices into ${k} balanced parts.`,
        0,
        () => null,
        { levels: clusterFrames.length, vertices: original.nodes.length, parts: k, cut: cutOf(original, initialPart) },
    );
    step += 1;

    for (let index = 0; index < clusterFrames.length; index += 1) {
        const clusterOf = clusterFrames[index] as Map<string, number>;
        yield frame(
            `Coarsening level ${index + 1}: matched heavy edges into ${new Set(clusterOf.values()).size} clusters.`,
            1,
            (node) => clusterOf.get(node) ?? 0,
            { levels: clusterFrames.length, level: index + 1, clusters: new Set(clusterOf.values()).size, parts: k },
        );
        step += 1;
    }

    yield frame(
        `Initial partition on the coarsest graph, projected back: cut = ${cutOf(original, initialPart)}.`,
        3,
        (node) => initialPart.get(node) ?? 0,
        { levels: clusterFrames.length, parts: k, cut: cutOf(original, initialPart), phase: "initial" },
    );
    step += 1;

    let cut = cutOf(original, initialPart);
    const displayPart = new Map(initialPart);
    for (const move of refinement) {
        cut = move.cutAfter;
        displayPart.set(move.vertex, move.to);
        const snapshotPart = new Map(displayPart);
        yield frame(
            `Refinement moved ${move.vertex} from part ${move.from} to ${move.to}; cut = ${cut}.`,
            5,
            (node) => snapshotPart.get(node) ?? 0,
            { levels: clusterFrames.length, parts: k, cut, phase: "refine" },
        );
        step += 1;
        if (step > 80) break;
    }

    const sizes = new Array<number>(k).fill(0);
    for (const p of part.values()) sizes[p as number] = (sizes[p as number] ?? 0) + 1;
    yield frame(
        `Balanced ${k}-way partition with cut ${cutOf(original, part)} and part sizes ${sizes.join(", ")}.`,
        6,
        (node) => part.get(node) ?? 0,
        {
            levels: clusterFrames.length,
            parts: k,
            cut: cutOf(original, part),
            sizes: sizes.map(String),
            partition: original.nodes.map((node) => `${node}:${part.get(node) ?? 0}`),
        },
        true,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Finding a good global partition of a huge graph is hard, so the multilevel method changes the question. It repeatedly merges heavily connected vertex pairs into super-vertices until the graph is small, partitions that small graph, and then undoes the merges while locally moving border vertices to improve the cut. Each level is cheap and the layers correct one another.",
        invariants: [
            "A coarsening cluster contains only vertices from the finer graph it replaces.",
            "Projecting a partition assigns every original vertex to exactly one part.",
            "Refinement only accepts a move that lowers the cut without breaking balance.",
        ],
        correctness:
            "Heavy-edge matching always maps each finer vertex into exactly one cluster, so projection assigns every original vertex one part. Greedy initial partitioning respects the balance target, and each refinement move is accepted only when its gain is positive and sizes stay within the bound, so the cut never rises during refinement and the final partition remains balanced.",
        complexityRationale:
            "Coarsening halves the vertex count per level, so the hierarchy has O(log V) levels and total size O(V + E). Greedy assignment and each refinement sweep scan vertices and their edges once, giving O((V + E) levels) time and O(V + E) space.",
        uses: [
            "Partitioning meshes for parallel finite-element simulation",
            "Balancing work and minimizing communication in distributed graphs",
            "Preprocessing for VLSI placement and layout",
        ],
        references: [
            "Karypis and Kumar, A Fast and High Quality Multilevel Scheme for Partitioning Irregular Graphs, 1998",
            "Kernighan and Lin, An Efficient Heuristic Procedure for Partitioning Electrical Networks, 1970",
        ],
        workedExample:
            "Two dense triangles joined by a single bridge are matched into two super-vertices on coarsening. The coarse cut separates them with cost one; projecting back and refining keeps the bridge as the only crossing edge, giving a balanced split with cut one.",
    },
    id: "metis-multilevel-partitioning",
    name: "METIS Multilevel Partitioning",
    category: "graph",
    complexity: { time: "O((V + E) · levels)", space: "O(V + E)" },
    defaultInput: { k: 2 },
    visualType: "graph",
    run,
    pseudocode: [
        "match each vertex to its heaviest unmatched neighbor",
        "contract matched pairs into super-vertices to coarsen the graph",
        "repeat coarsening until the graph is small enough",
        "partition the coarsest graph greedily under a balance bound",
        "project the partition back through each coarsening level",
        "at each level move border vertices that reduce the cut",
        "repeat until no improving balanced move remains",
        "done: return the balanced partition and its cut size",
    ],
};

export default module;
