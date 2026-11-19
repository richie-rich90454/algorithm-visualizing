/**
 * graph-coloring-precoloring-extension.ts – Precoloring Extension
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Precoloring extension asks whether a partial proper coloring of a graph can
 * be completed to a full proper coloring using the same palette. Some vertices
 * arrive with fixed colors; the remaining vertices must be assigned colors so
 * that no adjacent pair shares a color while every precolored vertex keeps its
 * given color. The problem is NP-hard in general, so a DSATUR-ordered
 * backtracking search explores the choices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^n) worst case
 *   Space: O(n + E) for the assignment and adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A colored vertex shows its color in the label and turns BLUE.
 *   - An uncolored vertex stays IDLE.
 *   - A vertex that is being tried turns YELLOW, then RED on backtrack.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Every partial assignment maintained by the search is proper.
 *   - Precolored vertices are never reassigned.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        vertices?: Array<string | number>;
        edges?: Array<[string | number, string | number]>;
        k?: number;
        precolored?: Record<string, number>;
    } | null) ?? {};
    const vertices = (task.vertices ?? [0, 1, 2, 3, 4, 5]).map((v) => Number(v));
    const edges = (task.edges ?? [
        [0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3],
    ]).map(([a, b]) => [Number(a), Number(b)] as [number, number]);
    const k = typeof task.k === "number" ? Math.max(1, task.k) : 3;
    const precolored = task.precolored ?? { 0: 0, 3: 1 };

    const adjacency = new Map<number, number[]>();
    for (const v of vertices) {
        adjacency.set(v, []);
    }
    for (const [a, b] of edges) {
        adjacency.get(a)?.push(b);
        adjacency.get(b)?.push(a);
    }

    const color = new Map<number, number>();
    for (const [v, c] of Object.entries(precolored)) {
        if (vertices.includes(Number(v)) && c >= 0 && c < k) {
            color.set(Number(v), c);
        }
    }

    let step = 0;
    let assignments = 0;
    let backtracks = 0;
    let solved = false;
    let focus = -1;
    let focusState = "";

    const frame = (description: string, codeLineNumber: number): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((v) => ({
            id: `node-${v}`,
            type: "node" as const,
            label: color.has(v) ? `${v}:c${color.get(v)}` : `${v}:?`,
            value: v,
            state: v === focus ? (focusState as VisualEntity["state"]) : color.has(v) ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { vertex: v, color: color.get(v) ?? -1 },
        }));
        const visualEdges: VisualEdge[] = edges.map(([a, b]) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "idle" as const,
            directed: false,
        }));
        return {
            stepNumber: step++,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { assignments, backtracks, solved, k },
        };
    };

    const saturation = (v: number): Set<number> => {
        const used = new Set<number>();
        for (const neighbor of adjacency.get(v) ?? []) {
            const c = color.get(neighbor);
            if (c !== undefined) {
                used.add(c);
            }
        }
        return used;
    };

    // Reject an inconsistent precoloring immediately.
    for (const [a, b] of edges) {
        if (color.has(a) && color.has(b) && color.get(a) === color.get(b)) {
            yield frame("The precoloring is inconsistent; no extension exists.", 1);
            return;
        }
    }

    yield frame(`Extending a ${k}-coloring with ${color.size} precolored vertex(es).`, 0);

    function* search(): Generator<VisualFrame, boolean, unknown> {
        if (color.size === vertices.length) {
            return true;
        }
        let chosen = -1;
        let bestSaturation = -1;
        let bestDegree = -1;
        for (const v of vertices) {
            if (color.has(v)) {
                continue;
            }
            const sat = saturation(v).size;
            const degree = (adjacency.get(v) ?? []).length;
            if (sat > bestSaturation || (sat === bestSaturation && degree > bestDegree)) {
                chosen = v;
                bestSaturation = sat;
                bestDegree = degree;
            }
        }
        if (chosen < 0) {
            return true;
        }

        const forbidden = saturation(chosen);
        for (let c = 0; c < k; c += 1) {
            if (forbidden.has(c)) {
                continue;
            }
            color.set(chosen, c);
            assignments += 1;
            focus = chosen;
            focusState = "comparing";
            yield frame(`Trying color ${c} for vertex ${chosen}.`, 4);

            if (yield* search()) {
                return true;
            }

            color.delete(chosen);
            backtracks += 1;
            focus = chosen;
            focusState = "error";
            yield frame(`Color ${c} failed for vertex ${chosen}; backtracking.`, 5);
        }
        focus = -1;
        return false;
    }

    solved = yield* search();
    focus = -1;
    yield frame(
        solved
            ? `Extended the precoloring successfully with ${assignments} assignment(s).`
            : `No proper extension exists after ${backtracks} backtrack(s).`,
        7,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Some vertices of a graph already have fixed colors. The task is to finish the coloring without ever giving two neighbors the same color or changing a fixed color. The search always colors the most constrained uncolored vertex first, then tries each legal color and undoes a choice if it leads to a dead end.",
        invariants: [
            "Every color assigned during the search differs from the colors of all already colored neighbors.",
            "Precolored vertices are never removed or changed.",
            "A backtrack removes exactly the most recent tentative assignment.",
        ],
        correctness:
            "Choosing the highest-saturation vertex does not restrict which completions exist, only the order they are tried. Trying every color not used by colored neighbors enumerates all legal choices for that vertex, and recursion explores all completions of each. Therefore a full assignment is found if and only if a valid extension exists, and any assignment returned has no monochromatic edge.",
        complexityRationale:
            "In the worst case each of the n vertices tries up to k colors, giving O(k^n) time. The search stores one color per vertex and the adjacency lists, so space is O(n + E).",
        uses: [
            "Timetabling with fixed room or time assignments",
            "Register allocation with preassigned registers",
            "Completing partially specified frequency plans",
        ],
        references: [
            "Brelaz, New Methods to Color the Vertices of a Graph, 1979",
            "CLRS, Introduction to Algorithms, Chapter 12 (backtracking)",
        ],
        workedExample:
            "On a path 0-1-2 with k=2 and vertex 0 precolor 0, vertex 1 cannot take color 0, so it takes 1, and vertex 2 then takes 0. The precoloring is extended to 0,1,0 with no adjacent equal colors.",
    },
    id: "graph-coloring-precoloring-extension",
    name: "Precoloring Extension",
    category: "graph",
    complexity: { time: "O(k^n)", space: "O(n + E)" },
    defaultInput: {
        vertices: [0, 1, 2, 3, 4, 5],
        edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]],
        k: 3,
        precolored: { 0: 0, 3: 1 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with the graph, palette size k, and precolored vertices",
        "reject the input if two precolored neighbors share a color",
        "if every vertex is colored, report success",
        "choose the uncolored vertex with highest saturation then degree",
        "collect colors used by its already colored neighbors",
        "for each legal color, assign it and recurse",
        "if recursion fails, undo the assignment and try the next color",
        "done: report the completed coloring or failure",
    ],
};

export default module;
