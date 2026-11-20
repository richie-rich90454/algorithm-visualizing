/**
 * misra-gries-edge-coloring.ts - Misra-Gries Edge Coloring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Misra-Gries algorithm colors the edges of any simple graph with at most
 * Delta + 1 colors, where Delta is the maximum degree. To color an uncolored
 * edge it builds a fan of neighbors around one endpoint, inverts a two-color
 * alternating path to make a color available, then rotates the fan so the new
 * edge can take that color. Every step keeps the coloring proper.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E) - O(E) edges, each costing O(V) fan and path work
 *   Space: O(V + E) for the graph, colors and support sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The center of the current fan is orange (comparing).
 *   - Fan edges are blue (path); the inverted two-color path is yellow (highlight).
 *   - The newly colored edge is green (sorted).
 *   - Edge labels show the assigned color number.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface ColoringTask {
    graph?: Record<string, string[]>;
}

interface Edge {
    a: string;
    b: string;
    key: string;
}

const keyOf = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ColoringTask | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["A", "B", "C"],
    };
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const seen = new Set<string>();
    const edgeList: Edge[] = [];
    for (const [source, targets] of Object.entries(adjacency)) {
        for (const target of targets) {
            if (source === target) continue;
            const key = keyOf(source, target);
            if (!seen.has(key)) {
                seen.add(key);
                edgeList.push({ a: source, b: target, key });
            }
        }
    }

    const neighborMap = new Map<string, string[]>(labels.map((label) => [label, []]));
    for (const edge of edgeList) {
        (neighborMap.get(edge.a) as string[]).push(edge.b);
        (neighborMap.get(edge.b) as string[]).push(edge.a);
    }
    const delta = Math.max(0, ...[...neighborMap.values()].map((list) => list.length));
    const color = new Map<string, number | null>(edgeList.map((edge) => [edge.key, null]));

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
    const visualEdges: VisualEdge[] = edgeList.map((edge) => ({
        id: `edge-${edge.a}-${edge.b}`,
        sourceId: `node-${edge.a}`,
        targetId: `node-${edge.b}`,
        label: "?",
        state: "idle" as const,
        directed: false,
    }));

    const usedColors = (vertex: string): Set<number> => {
        const result = new Set<number>();
        for (const neighbor of neighborMap.get(vertex) ?? []) {
            const value = color.get(keyOf(vertex, neighbor));
            if (value !== null && value !== undefined) result.add(value);
        }
        return result;
    };
    const freeColors = (vertex: string): Set<number> => {
        const used = usedColors(vertex);
        const result = new Set<number>();
        for (let c = 0; c <= delta; c += 1) {
            if (!used.has(c)) result.add(c);
        }
        return result;
    };
    const smallestFree = (vertex: string): number => {
        const free = freeColors(vertex);
        for (let c = 0; c <= delta; c += 1) {
            if (free.has(c)) return c;
        }
        return delta;
    };
    const coloredEdgeAt = (vertex: string, wanted: number, skip: string | null): Edge | null => {
        for (const neighbor of neighborMap.get(vertex) ?? []) {
            const key = keyOf(vertex, neighbor);
            if (key === skip) continue;
            if (color.get(key) === wanted) return { a: vertex, b: neighbor, key };
        }
        return null;
    };
    const otherEnd = (edge: Edge, vertex: string): string => (edge.a === vertex ? edge.b : edge.a);

    let step = 0;
    let coloredEdges = 0;
    const emit = (
        description: string,
        codeLineNumber: number,
        center: string | null,
        highlight: string | null,
        edgeStates: Map<string, EntityState>,
        extra: VisualFrame["meta"] = {},
    ): VisualFrame => {
        for (const node of nodes) {
            const label = String(node.metadata.label);
            node.state = label === center ? "comparing" : label === highlight ? "highlight" : "unvisited";
        }
        for (const visualEdge of visualEdges) {
            const key = edgeByKeyEntry(visualEdge);
            visualEdge.state = edgeStates.get(key) ?? "idle";
            const value = color.get(key);
            visualEdge.label = value === null || value === undefined ? "?" : String(value);
        }
        const used = new Set([...color.values()].filter((value): value is number => value !== null));
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: { delta, coloredEdges, colorsUsed: used.size, ...extra },
        };
    };
    const edgeByKeyEntry = (visual: VisualEdge): string =>
        `${keyOf(String(visual.sourceId).slice(5), String(visual.targetId).slice(5))}`;

    yield emit("Misra-Gries edge coloring with at most Delta+1 colors.", 0, null, null, new Map());
    step += 1;

    const pending: Edge[] = [...edgeList];
    let guard = 0;
    while (pending.length > 0 && guard < edgeList.length + 5) {
        guard += 1;
        const target = pending.shift() as Edge;
        if (color.get(target.key) !== null) continue;
        const center = target.a;
        const fan: string[] = [target.b];

        let fanGuard = 0;
        while (fanGuard < labels.length + 2) {
            fanGuard += 1;
            const last = fan[fan.length - 1] as string;
            const lastFree = freeColors(last);
            let added: string | null = null;
            for (const neighbor of neighborMap.get(center) ?? []) {
                if (fan.includes(neighbor)) continue;
                const value = color.get(keyOf(center, neighbor));
                if (value !== null && value !== undefined && lastFree.has(value)) {
                    added = neighbor;
                    break;
                }
            }
            if (added === null) break;
            fan.push(added);
        }

        const fanStates = new Map<string, EntityState>();
        for (let i = 0; i < fan.length; i += 1) {
            fanStates.set(keyOf(center, fan[i] as string), i === 0 ? "comparing" : "active");
        }
        yield emit(
            `Building a maximal fan at ${center}: ${fan.join(", ")}.`,
            1,
            center,
            fan[fan.length - 1] as string,
            fanStates,
        );
        step += 1;

        const c = smallestFree(center);
        const d = smallestFree(fan[fan.length - 1] as string);

        const path: Edge[] = [];
        const start = coloredEdgeAt(center, d, null);
        if (start) {
            path.push(start);
            let current = otherEnd(start, center);
            let wanted = c;
            let skip = start.key;
            let pathGuard = 0;
            while (pathGuard < labels.length + 2) {
                pathGuard += 1;
                const next = coloredEdgeAt(current, wanted, skip);
                if (!next) break;
                path.push(next);
                skip = next.key;
                current = otherEnd(next, current);
                wanted = wanted === c ? d : c;
            }
        }
        const pathStates = new Map<string, EntityState>();
        for (const edge of path) pathStates.set(edge.key, "highlight");
        yield emit(
            `Inverting the ${c}-${d} path through ${center} (${path.length} edge(s)).`,
            2,
            center,
            fan[fan.length - 1] as string,
            pathStates,
        );
        step += 1;
        for (const edge of path) {
            const value = color.get(edge.key);
            color.set(edge.key, value === c ? d : c);
        }

        let width = fan.length - 1;
        for (let w = 1; w < fan.length; w += 1) {
            const freeAtW = freeColors(fan[w] as string);
            if (!freeAtW.has(d)) continue;
            let valid = true;
            for (let i = 1; i <= w; i += 1) {
                const value = color.get(keyOf(center, fan[i] as string));
                if (value === null || value === undefined) {
                    valid = false;
                    break;
                }
                if (!freeColors(fan[i - 1] as string).has(value)) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                width = w;
                break;
            }
        }

        const oldColors: Array<number | null> = [];
        for (let i = 0; i <= width; i += 1) oldColors.push(color.get(keyOf(center, fan[i] as string)) ?? null);
        for (let i = 0; i < width; i += 1) {
            color.set(keyOf(center, fan[i] as string), oldColors[i + 1] ?? null);
        }
        color.set(keyOf(center, fan[width] as string), d);
        coloredEdges += 1;

        const finalStates = new Map<string, EntityState>([[keyOf(center, target.b), "sorted"]]);
        yield emit(
            `Colored edge ${center}-${target.b} with color ${oldColors[1] ?? d}; ${coloredEdges}/${edgeList.length} done.`,
            4,
            center,
            fan[width] as string,
            finalStates,
        );
        step += 1;
    }

    yield emit(
        `Finished a proper edge coloring using at most Delta+1 = ${delta + 1} colors.`,
        6,
        null,
        null,
        new Map(edgeList.map((edge) => [edge.key, "sorted" as EntityState])),
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Coloring edges means giving adjacent edges different colors. Vizing's theorem says Delta + 1 colors always suffice. Misra and Gries make that proof constructive: to color one uncolored edge, build a fan of neighbors around a center vertex, swap the colors on a short alternating path to free a color at the far end, and rotate the fan so the color lands on the new edge.",
        invariants: [
            "After every step no vertex has two incident edges of the same color.",
            "The first edge of a fan is always uncolored, and each later fan edge has a color free on its predecessor.",
            "Each pass colors exactly one previously uncolored edge.",
        ],
        correctness:
            "Inverting a two-color path preserves properness because an endpoint loses one of the two colors and gains the other. The inversion guarantees that some prefix of the fan can be rotated while keeping every fan color free at its predecessor; rotating that prefix frees the final edge, which is then colored with a color free at both ends. By induction over edges the final coloring is proper and uses at most Delta + 1 colors.",
        complexityRationale:
            "There are O(E) iterations. Building a fan, finding and inverting a two-color path, and rotating all take O(V) each, so the total is O(EV) time. The graph, the color map and the temporary path use O(V + E) space.",
        uses: [
            "Scheduling pairwise jobs that share a resource",
            "Frequency assignment in wireless networks",
            "A constructive proof tool for Vizing's theorem",
        ],
        references: [
            "Misra and Gries, A Constructive Proof of Vizing's Theorem, 1992",
            "Bollobas, Graph Theory, Springer, 1982",
        ],
        workedExample:
            "On a four-vertex clique, Delta is 3, so four colors are available. The first edge takes color 0. When a later edge at the same vertex has no free color shared with its other endpoint, the algorithm builds a fan, swaps a two-color path ending at that endpoint, and rotates the fan to free a color.",
    },
    id: "misra-gries-edge-coloring",
    name: "Misra-Gries Edge Coloring",
    category: "graph",
    complexity: { time: "O(V·E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["A", "B", "C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "let U be the set of uncolored edges",
        "pick an uncolored edge (X, v) and build a maximal fan at X",
        "choose a color c free at X and a color d free at the fan's end",
        "invert the maximal c-d alternating path through X",
        "find the shortest fan prefix whose end is free of color d",
        "rotate that prefix and color the new edge with d",
        "repeat until every edge is colored",
    ],
};

export default module;
