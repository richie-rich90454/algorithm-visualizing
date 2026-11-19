/**
 * hypergraph-coloring.ts - Minimum Hypergraph Coloring by Backtracking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a hypergraph a "hyperedge" may join any number of vertices, and a proper
 * coloring forbids a hyperedge from being monochromatic. This is stricter than
 * ordinary graph coloring and cannot be reduced to pairwise edges. The module
 * searches for the fewest colors by trying each color count in turn with a
 * backtracking assignment that checks every fully assigned hyperedge.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^V * H) over color counts k, V vertices, and H hyperedges
 *   Space: O(V + H) for the incidence structure and current assignment
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertex circles are connected to hyperedge circles by incidence edges.
 *   - The vertex being colored is highlighted.
 *   - The proper coloring and its color count appear in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; hyperedges?: string[][] } | null) ?? {};
    const vertices = Array.isArray(task.vertices) && task.vertices.length > 0
        ? task.vertices.map(String)
        : ["A", "B", "C", "D", "E"];
    const hyperedges: string[][] = Array.isArray(task.hyperedges)
        ? task.hyperedges
              .filter((edge) => Array.isArray(edge))
              .map((edge) => edge.map(String).filter((v) => vertices.includes(v)))
        : [
              ["A", "B", "C"],
              ["B", "C", "D"],
              ["C", "D", "E"],
              ["A", "E"],
          ];

    const nodes: VisualEntity[] = [
        ...vertices.map((label) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: "unvisited" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { kind: "vertex", label },
        })),
        ...hyperedges.map((edge, i) => ({
            id: `hyper-${i}`,
            type: "node" as const,
            label: `H${i}`,
            value: `H${i}`,
            state: "idle" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { kind: "hyperedge", index: i },
        })),
    ];
    const incidence: VisualEdge[] = hyperedges.flatMap((edge, i) =>
        edge.map((v) => ({
            id: `inc-${i}-${v}`,
            sourceId: `hyper-${i}`,
            targetId: `node-${v}`,
            label: "",
            state: "idle" as const,
            directed: false,
        })),
    );

    let attempts = 0;
    let chromatic = 0;
    let result: Map<string, number> | null = null;
    const shots: Array<{ k: number; assignment: Map<string, number> }> = [];

    const coloringOf = (assignment: Map<string, number>): string[] =>
        vertices.map((v) => `${v}:${assignment.get(v) ?? -1}`);

    const snap = (message: string, line: number, current: string, assignment: Map<string, number>): VisualFrame => {
        for (const node of nodes) {
            if (node.metadata["kind"] !== "vertex") {
                continue;
            }
            const label = String(node.value);
            node.state = label === current ? "active" : assignment.has(label) ? "path" : "unvisited";
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: incidence.map((edge) => ({
                ...edge,
                state: assignment.has(String(edge.targetId).replace("node-", "")) ? "sorted" : "idle",
            })),
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                hyperedgeCount: hyperedges.length,
                attempts,
                chromaticNumber: chromatic,
                coloring: coloringOf(assignment),
            },
        };
    };

    const tryColor = (k: number, index: number, assignment: Map<string, number>): boolean => {
        if (index >= vertices.length) {
            return true;
        }
        const v = vertices[index];
        if (v === undefined) {
            return false;
        }
        for (let color = 0; color < k; color += 1) {
            attempts += 1;
            assignment.set(v, color);
            let ok = true;
            for (const edge of hyperedges) {
                if (!edge.includes(v)) {
                    continue;
                }
                if (edge.every((u) => assignment.has(u))) {
                    const first = assignment.get(edge[0] ?? "");
                    if (edge.every((u) => assignment.get(u) === first)) {
                        ok = false;
                        break;
                    }
                }
            }
            if (ok && tryColor(k, index + 1, assignment)) {
                return true;
            }
            assignment.delete(v);
        }
        return false;
    };

    yield {
        ...snap("Searching for the fewest colors that leave no hyperedge monochromatic.", 1, "", new Map()),
        stepNumber: 0,
    };
    let step = 1;

    for (let k = 2; k <= vertices.length; k += 1) {
        const assignment = new Map<string, number>();
        if (tryColor(k, 0, assignment)) {
            chromatic = k;
            result = assignment;
            if (shots.length < 80) {
                shots.push({ k, assignment: new Map(assignment) });
            }
            break;
        }
        if (shots.length < 80) {
            shots.push({ k, assignment: new Map() });
        }
    }

    for (const shot of shots) {
        yield {
            ...snap(
                shot.assignment.size > 0
                    ? `A proper ${shot.k}-coloring leaves every hyperedge mixed.`
                    : `${shot.k} colors cannot avoid a monochromatic hyperedge.`,
                3,
                "",
                shot.assignment,
            ),
            stepNumber: step,
        };
        step += 1;
    }

    const final = result ?? new Map<string, number>();
    yield {
        ...snap(
            chromatic > 0
                ? `The minimum hypergraph coloring uses ${chromatic} colors.`
                : "No proper coloring exists for these hyperedges.",
            7,
            "",
            final,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A hyperedge can contain three or more vertices, so forbidding monochromatic pairs is not enough. The search colors one vertex at a time and, as soon as a hyperedge is fully colored, checks that it contains at least two different colors. Raising the color count one at a time makes the first successful count the minimum.",
        invariants: [
            "No fully colored hyperedge is monochromatic during the search.",
            "If a color count fails, every assignment for that count has been ruled out.",
            "The first successful count is the smallest feasible count.",
        ],
        correctness:
            "Backtracking considers every assignment of the chosen number of colors, rejecting exactly those with a monochromatic hyperedge, so success means a proper coloring exists and failure means none does. Since color counts are tried in increasing order, the first success is minimal.",
        complexityRationale:
            "There are k^V assignments for a fixed count and checking all H hyperedges costs O(H), and up to V counts are tried, giving O(k^V H). The incidence list and assignment map use O(V + H) space.",
        uses: [
            "Conflict-free assignment in constraint and database systems",
            "Coloring registers where one constraint covers several variables",
            "Testing property-B satisfiability instances",
        ],
        references: [
            "Berge, Graphs and Hypergraphs",
            "Jensen and Toft, Graph Coloring Problems, hypergraph coloring chapter",
        ],
        workedExample:
            "On vertices A, B, C with the single hyperedge {A, B, C}, one color fails because all three would match, while two colors succeed by giving A color 0 and B and C color 1, so the hypergraph needs two colors.",
    },
    id: "hypergraph-coloring",
    name: "Hypergraph Coloring",
    category: "graph",
    complexity: { time: "O(k^V * H)", space: "O(V + H)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E"],
        hyperedges: [
            ["A", "B", "C"],
            ["B", "C", "D"],
            ["C", "D", "E"],
            ["A", "E"],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the vertex list and hyperedge incidence structure",
        "set the color count to two",
        "assign the next vertex each possible color in turn",
        "reject a fully colored monochromatic hyperedge",
        "backtrack when no color works for the current vertex",
        "on a full assignment, record the coloring and stop",
        "otherwise increase the color count and repeat",
        "report the minimum count and the coloring",
    ],
};

export default module;
