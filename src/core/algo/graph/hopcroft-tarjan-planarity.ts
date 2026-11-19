/**
 * hopcroft-tarjan-planarity.ts - Hopcroft-Tarjan Planarity Framework
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A graph is planar when it can be drawn in the plane without crossing edges.
 * The Hopcroft-Tarjan framework builds a depth-first search tree, lists the
 * back edges whose tree paths must be embedded, and decides whether those
 * paths can be drawn without crossings. For the small graphs shown here the
 * embedding decision is carried out by enumerating the cyclic orders of
 * incident edges at each vertex and applying Euler's formula: a rotation
 * system is planar exactly when it traces m - n + 2 faces. The original paper
 * replaces this finite search with linear-time bookkeeping.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((deg!)^n) for the enumeration used here; O(V + E) in the full HT algorithm
 *   Space: O(V + E) plus the current rotation system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree edges are blue (path) and back edges are orange (active).
 *   - A candidate embedding shows the traced edges in yellow (highlight).
 *   - A planar verdict turns every vertex green (sorted).
 *   - A nonplanar verdict turns vertices red (error).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface PlanarityTask {
    graph?: Record<string, string[]>;
}

interface Attempt {
    component: number;
    faces: number;
    target: number;
    planar: boolean;
}

const edgeKey = (a: number, b: number): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

function normalize(adjacency: Record<string, string[]>): { labels: string[]; edges: Array<[number, number]> } {
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const index = new Map<string, number>(labels.map((label, i) => [label, i]));
    const seen = new Set<string>();
    const edges: Array<[number, number]> = [];
    for (const [source, targets] of Object.entries(adjacency)) {
        for (const target of targets) {
            const a = index.get(source);
            const b = index.get(target);
            if (a === undefined || b === undefined || a === b) continue;
            const key = edgeKey(a, b);
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([Math.min(a, b), Math.max(a, b)]);
            }
        }
    }
    return { labels, edges };
}

function components(n: number, edges: Array<[number, number]>): number[][] {
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) {
        (adjacency[a] as number[]).push(b);
        (adjacency[b] as number[]).push(a);
    }
    const seen = new Set<number>();
    const result: number[][] = [];
    for (let start = 0; start < n; start += 1) {
        if (seen.has(start)) continue;
        const group: number[] = [];
        const stack = [start];
        seen.add(start);
        while (stack.length > 0) {
            const current = stack.pop() as number;
            group.push(current);
            for (const neighbor of adjacency[current] as number[]) {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    stack.push(neighbor);
                }
            }
        }
        result.push(group);
    }
    return result;
}

function permutations(values: number[]): number[][] {
    if (values.length <= 1) return [values];
    const result: number[][] = [];
    for (let i = 0; i < values.length; i += 1) {
        const rest = [...values.slice(0, i), ...values.slice(i + 1)];
        for (const tail of permutations(rest)) result.push([values[i] as number, ...tail]);
    }
    return result;
}

function rotationOrders(neighbors: number[]): number[][] {
    if (neighbors.length <= 1) return [neighbors];
    const first = neighbors[0] as number;
    return permutations(neighbors.slice(1)).map((tail) => [first, ...tail]);
}

function traceFaces(rotation: number[][], edges: Array<[number, number]>, n: number): number {
    const visited = new Set<number>();
    let faces = 0;
    for (const [a, b] of edges) {
        for (const [from, to] of [
            [a, b],
            [b, a],
        ]) {
            const start = from * n + to;
            if (visited.has(start)) continue;
            faces += 1;
            let currentFrom = from;
            let currentTo = to;
            let guard = 0;
            while (!visited.has(currentFrom * n + currentTo) && guard < 4 * n * n + 4) {
                guard += 1;
                visited.add(currentFrom * n + currentTo);
                const order = rotation[currentTo] as number[];
                const position = order.indexOf(currentFrom);
                const nextVertex = order[(position - 1 + order.length) % order.length] as number;
                currentFrom = currentTo;
                currentTo = nextVertex;
            }
        }
    }
    return faces;
}

function decidePlanarity(n: number, edges: Array<[number, number]>): { planar: boolean; attempts: Attempt[] } {
    const groups = components(n, edges);
    const attempts: Attempt[] = [];
    let allPlanar = true;

    for (let componentIndex = 0; componentIndex < groups.length; componentIndex += 1) {
        const group = groups[componentIndex] as number[];
        if (group.length < 3) continue;
        const set = new Set(group);
        const localEdges = edges.filter(([a, b]) => set.has(a) && set.has(b));
        const m = localEdges.length;
        if (m > 3 * group.length - 6) {
            attempts.push({ component: componentIndex, faces: 0, target: m - group.length + 2, planar: false });
            allPlanar = false;
            continue;
        }

        const localIndex = new Map<number, number>(group.map((vertex, i) => [vertex, i]));
        const size = group.length;
        const mappedEdges: Array<[number, number]> = localEdges.map(([a, b]) => [
            localIndex.get(a) as number,
            localIndex.get(b) as number,
        ]);
        const adjacency: number[][] = Array.from({ length: size }, () => []);
        for (const [a, b] of mappedEdges) {
            (adjacency[a] as number[]).push(b);
            (adjacency[b] as number[]).push(a);
        }

        const orders = adjacency.map((neighbors) => rotationOrders(neighbors));
        const target = m - size + 2;
        let found = false;
        const rotations: number[][] = Array.from({ length: size }, () => []);

        const search = (vertex: number): void => {
            if (found || vertex >= size) return;
            const options = orders[vertex] as number[][];
            for (const order of options) {
                rotations[vertex] = order;
                if (vertex === size - 1) {
                    const faces = traceFaces(rotations, mappedEdges, size);
                    const planar = faces === target;
                    if (attempts.length < 12) {
                        attempts.push({ component: componentIndex, faces, target, planar });
                    }
                    if (planar) {
                        found = true;
                        return;
                    }
                } else {
                    search(vertex + 1);
                    if (found) return;
                }
            }
        };
        search(0);
        if (!found) allPlanar = false;
    }
    return { planar: allPlanar, attempts };
}

function dfsStructure(n: number, edges: Array<[number, number]>): { tree: Set<string>; back: Array<[number, number]> } {
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) {
        (adjacency[a] as number[]).push(b);
        (adjacency[b] as number[]).push(a);
    }
    const visited = new Set<number>();
    const tree = new Set<string>();
    const back: Array<[number, number]> = [];
    const visit = (u: number, parent: number): void => {
        visited.add(u);
        for (const v of adjacency[u] as number[]) {
            if (v === parent) continue;
            if (!visited.has(v)) {
                tree.add(edgeKey(u, v));
                visit(v, u);
            } else if (!tree.has(edgeKey(u, v))) {
                back.push([u, v]);
            }
        }
    };
    for (let start = 0; start < n; start += 1) {
        if (!visited.has(start)) visit(start, -1);
    }
    return { tree, back };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PlanarityTask | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B"],
    };
    const { labels, edges } = normalize(adjacency);
    const n = labels.length;
    const m = edges.length;

    const nodes: VisualEntity[] = labels.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
    const visualEdges: VisualEdge[] = edges.map(([a, b]) => ({
        id: `edge-${a}-${b}`,
        sourceId: `node-${labels[a]}`,
        targetId: `node-${labels[b]}`,
        label: "",
        state: "idle" as const,
        directed: false,
    }));

    let step = 0;
    const emit = (description: string, codeLineNumber: number, states: Map<string, EntityState>, edgeStates: Map<string, EntityState>, extra: VisualFrame["meta"] = {}): VisualFrame => {
        for (const node of nodes) node.state = states.get(String(node.metadata.label)) ?? "unvisited";
        for (const edge of visualEdges) edge.state = edgeStates.get(edge.id) ?? "idle";
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: { vertices: n, edges: m, ...extra },
        };
    };

    yield emit(`Planarity test on ${n} vertex(es) and ${m} edge(s).`, 0, new Map(), new Map());
    step += 1;

    const structure = dfsStructure(n, edges);
    const treeStates = new Map<string, EntityState>();
    const edgeStates = new Map<string, EntityState>();
    edges.forEach(([a, b]) => {
        const key = edgeKey(a, b);
        edgeStates.set(`edge-${Math.min(a, b)}-${Math.max(a, b)}`, structure.tree.has(key) ? "path" : "active");
    });
    yield emit(
        `DFS tree has ${structure.tree.size} tree edge(s) and ${structure.back.length} back edge(s).`,
        1,
        treeStates,
        edgeStates,
        { treeEdges: structure.tree.size, backEdges: structure.back.length },
    );
    step += 1;

    if (n >= 3 && m > 3 * n - 6) {
        yield emit(
            `With ${m} edges, m > 3n - 6 = ${3 * n - 6}, so the graph cannot be planar.`,
            2,
            new Map(labels.map((label) => [label, "error" as EntityState])),
            new Map(),
            { planar: false },
        );
        return;
    }

    const result = decidePlanarity(n, edges);
    for (const attempt of result.attempts.slice(0, 8)) {
        const highlight = new Map<string, EntityState>();
        edges.forEach(([a, b]) => highlight.set(`edge-${a}-${b}`, "highlight"));
        yield emit(
            `Embedding attempt for component ${attempt.component}: traced ${attempt.faces} face(s), expected ${attempt.target}.`,
            3,
            new Map(labels.map((label) => [label, "comparing" as EntityState])),
            highlight,
            { faces: attempt.faces, target: attempt.target },
        );
        step += 1;
    }

    const verdictState: EntityState = result.planar ? "sorted" : "error";
    yield emit(
        result.planar
            ? `Planar: an embedding with m - n + 2 = ${m - n + 2} face(s) exists.`
            : `Nonplanar: no rotation system gives the required number of faces.`,
        5,
        new Map(labels.map((label) => [label, verdictState])),
        new Map(),
        { planar: result.planar },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A drawing of a graph without crossings is called a planar embedding. Around each vertex the incident edges have a cyclic order, called a rotation. If we fix one rotation per vertex and trace the boundary cycles of the resulting drawing, Euler's formula says the number of faces must be m - n + 2 for an embedding with no crossings. Trying the possible rotations decides planarity; Hopcroft and Tarjan turned that search into a linear-time algorithm.",
        invariants: [
            "A rotation lists every incident edge of a vertex exactly once in cyclic order.",
            "Each directed edge belongs to exactly one traced face boundary.",
            "A rotation system is planar if and only if it traces exactly m - n + 2 faces for a connected graph.",
        ],
        correctness:
            "A planar drawing induces a rotation system at every vertex, and tracing faces in that system gives m - n + 2 faces by Euler's formula. Conversely, a rotation system with that many faces has genus zero, so it can be drawn without crossings. Therefore a graph is planar exactly when some rotation system passes the face-count test; the m > 3n - 6 shortcut is a valid necessary condition for simple planar graphs.",
        complexityRationale:
            "The demonstration enumerates (deg(v) - 1)! rotations per vertex, so its worst-case time is exponential, but the small example graphs keep the enumeration tiny. The full Hopcroft-Tarjan implementation maintains the embedding incrementally and runs in O(V + E) time and space.",
        uses: [
            "Checking whether a circuit or chip layout can avoid crossovers",
            "Deciding embeddability before planar graph drawing algorithms",
            "A first step in Kuratowski subgraph detection",
        ],
        references: [
            "Hopcroft and Tarjan, Planar Subgraphs and their Applications, 1971",
            "de Fraysseix, Ossona de Mendez and Rosenstiehl, A Left-Right Algorithm to Test Planarity, 1988",
        ],
        workedExample:
            "A tree has n - 1 edges and always gives m - n + 2 = 1 traced face, so it is planar. K5 has 5 vertices and 10 edges, violating m <= 3n - 6 = 9, so it is nonplanar. K3,3 satisfies the inequality but no rotation system traces the required 5 faces, so it is also nonplanar.",
    },
    id: "hopcroft-tarjan-planarity",
    name: "Hopcroft-Tarjan Planarity",
    category: "graph",
    complexity: { time: "O(V + E) full HT", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build a depth-first search tree and list the back edges",
        "if m exceeds 3n - 6 the graph is immediately nonplanar",
        "enumerate the cyclic edge order at each vertex",
        "trace the face boundaries of the candidate rotation system",
        "accept when the face count equals m - n + 2",
        "reject when every rotation system has too few faces",
        "done: report planar or nonplanar",
    ],
};

export default module;
