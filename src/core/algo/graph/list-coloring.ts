/**
 * list-coloring.ts - List Coloring by Backtracking with Forward Checking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In list coloring each vertex may only use colors from its own palette. The
 * question is whether a proper assignment exists at all, which is a
 * generalization of ordinary k-coloring. Vertices are tried in order of
 * smallest remaining palette, and a branch is abandoned as soon as a vertex
 * has no color left that its already colored neighbors allow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(product of list sizes * (V + E)) worst case
 *   Space: O(V + E) for adjacency, palettes, and the assignment
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are undirected connections.
 *   - The vertex being colored is highlighted; its label shows its palette.
 *   - The feasible assignment is green and reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]>; lists?: Record<string, number[]> } | null) ?? {};
    const adjacencyInput = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C"],
    };
    const vertices = Object.keys(adjacencyInput).sort();
    const lists: Map<string, number[]> = new Map(
        vertices.map((v) => {
            const raw = task.lists?.[v];
            const values = Array.isArray(raw) && raw.length > 0 ? raw.map(Number) : [0, 1, 2];
            return [v, [...new Set(values)].sort((a, b) => a - b)];
        }),
    );
    const neighbor = new Map<string, Set<string>>(
        vertices.map((v) => [
            v,
            new Set((adjacencyInput[v] ?? []).map(String).filter((u) => vertices.includes(u))),
        ]),
    );
    const edges: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const b of neighbor.get(a) ?? []) {
            const key = [a, b].sort().join("|");
            if (a !== b && !seen.has(key)) {
                seen.add(key);
                edges.push([a, b]);
            }
        }
    }
    const order = [...vertices].sort(
        (a, b) => (lists.get(a)?.length ?? 0) - (lists.get(b)?.length ?? 0) || a.localeCompare(b),
    );
    let attempts = 0;
    let feasible = false;
    let result: Map<string, number> | null = null;
    const shots: Array<{ vertex: string; color: number; assignment: Map<string, number> }> = [];

    const assignmentOf = (assignment: Map<string, number>): string[] =>
        vertices.map((v) => `${v}:${assignment.get(v) ?? -1}`);

    const snap = (message: string, line: number, current: string, assignment: Map<string, number>): VisualFrame => {
        const nodes: VisualEntity[] = vertices.map((v) => ({
            id: `node-${v}`,
            type: "node" as const,
            label: `${v}[${(lists.get(v) ?? []).join(",")}]`,
            value: v,
            state: v === current ? "active" : assignment.has(v) ? "path" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label: v, color: assignment.get(v) ?? -1 },
        }));
        const visualEdges: VisualEdge[] = edges.map(([a, b], i) => ({
            id: `edge-${i}-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state:
                assignment.has(a) && assignment.has(b) && assignment.get(a) !== assignment.get(b)
                    ? "sorted"
                    : "idle",
            directed: false,
        }));
        return {
            stepNumber: 0,
            entities: nodes,
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                edgeCount: edges.length,
                attempts,
                feasible,
                assignment: assignmentOf(assignment),
                lists: vertices.map((v) => `${v}:${(lists.get(v) ?? []).join(",")}`),
            },
        };
    };

    const search = (index: number, assignment: Map<string, number>): boolean => {
        if (index >= order.length) {
            return true;
        }
        const v = order[index];
        if (v === undefined) {
            return false;
        }
        const forbidden = new Set<number>();
        for (const u of neighbor.get(v) ?? []) {
            const color = assignment.get(u);
            if (color !== undefined) {
                forbidden.add(color);
            }
        }
        for (const color of lists.get(v) ?? []) {
            if (forbidden.has(color)) {
                continue;
            }
            attempts += 1;
            assignment.set(v, color);
            if (shots.length < 80) {
                shots.push({ vertex: v, color, assignment: new Map(assignment) });
            }
            if (search(index + 1, assignment)) {
                return true;
            }
            assignment.delete(v);
        }
        return false;
    };

    yield {
        ...snap("Checking whether each vertex can pick a color from its own list.", 1, "", new Map()),
        stepNumber: 0,
    };
    let step = 1;

    const assignment = new Map<string, number>();
    feasible = search(0, assignment);
    if (feasible) {
        result = assignment;
    }

    for (const shot of shots) {
        yield {
            ...snap(`Assign ${shot.vertex} color ${shot.color} from its list.`, 3, shot.vertex, shot.assignment),
            stepNumber: step,
        };
        step += 1;
    }

    const final = result ?? new Map<string, number>();
    yield {
        ...snap(
            feasible
                ? `A proper list coloring exists using ${new Set(final.values()).size} distinct color(s).`
                : "No proper list coloring exists for these palettes.",
            6,
            "",
            final,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ordinary coloring gives every vertex the same palette; list coloring gives each its own. A vertex with few available colors is the most constrained, so it is colored first, and as soon as a color is used by a neighbor it is crossed off every adjacent palette. If some vertex runs out of colors, that branch cannot succeed.",
        invariants: [
            "Each assigned color belongs to the palette of its vertex.",
            "No two adjacent vertices share a color.",
            "An empty remaining palette proves the current branch infeasible.",
        ],
        correctness:
            "Backtracking tries every color in each vertex's list and rejects exactly the assignments that clash with an already colored neighbor, so a returned assignment is proper and any existing proper assignment is eventually found. Failure means all combinations were excluded, so no list coloring exists.",
        complexityRationale:
            "With list sizes L_v there are at most the product of the L_v assignments, each checked against the neighbor set in O(V + E), giving the stated product bound. Adjacency, palettes, and the assignment use O(V + E) space.",
        uses: [
            "Frequency planning with station-specific channel sets",
            "Scheduling tasks whose allowed time slots differ",
            "Register allocation with pre-colored or restricted registers",
        ],
        references: [
            "Erdos, Rubin and Taylor, Choosability in Graphs, 1979",
            "Jensen and Toft, Graph Coloring Problems, list coloring chapter",
        ],
        workedExample:
            "For an edge A-B where A allows colors 1 and 2 and B allows only 1, choosing color 1 for A leaves B with no color, but choosing color 2 for A lets B take 1, so a proper list coloring exists.",
    },
    id: "list-coloring",
    name: "List Coloring",
    category: "graph",
    complexity: { time: "O(product(list sizes) * (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["C"],
        },
        lists: {
            A: [1, 2],
            B: [2, 3],
            C: [1, 3],
            D: [1, 2],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build adjacency and each vertex palette",
        "order vertices by increasing palette size",
        "for the next vertex, collect colors used by neighbors",
        "try each list color that is not forbidden",
        "record the choice and recurse on the next vertex",
        "backtrack when no color works",
        "on a full assignment, report success and the coloring",
        "otherwise report that no list coloring exists",
    ],
};

export default module;
