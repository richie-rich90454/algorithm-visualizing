/**
 * graph-coloring-backtracking.ts - Exact Graph Coloring by Backtracking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module finds the chromatic number of an undirected graph: the smallest
 * number of colors that let adjacent vertices differ. Vertices are ordered by
 * decreasing degree, and a backtracking search assigns the lowest admissible
 * color at each step. Trying color counts from a greedy lower bound upward
 * makes the first successful count the exact chromatic number.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^V * (V + E)) worst case over k color counts and V vertices
 *   Space: O(V + E) for adjacency, color assignment, and the ordering
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are undirected connections.
 *   - The vertex currently being colored is highlighted.
 *   - The final proper coloring is green and reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]> } | null) ?? {};
    const adjacencyInput = task.adjacency ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["A", "C", "E"],
        E: ["D"],
    };
    const vertices = Object.keys(adjacencyInput).sort();
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
        (a, b) => (neighbor.get(b)?.size ?? 0) - (neighbor.get(a)?.size ?? 0) || a.localeCompare(b),
    );
    const nodes = makeGraphNodes(vertices);
    let attempts = 0;
    let result: Map<string, number> | null = null;
    let chromatic = 0;
    const shots: Array<{ k: number; assignment: Map<string, number> }> = [];

    const colorsOf = (assignment: Map<string, number>): string[] =>
        vertices.map((v) => `${v}:${assignment.get(v) ?? -1}`);

    const snap = (message: string, line: number, current: string, assignment: Map<string, number>): VisualFrame => {
        for (const node of nodes) {
            const v = String(node.value);
            node.state = v === current ? "active" : assignment.has(v) ? "path" : "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map(([a, b], i) => ({
            id: `edge-${i}-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: assignment.has(a) && assignment.has(b) && assignment.get(a) !== assignment.get(b) ? "sorted" : "idle",
            directed: false,
        }));
        const used = new Set([...assignment.values()]);
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
                attempts,
                chromaticNumber: chromatic,
                colorsUsed: used.size,
                coloring: colorsOf(assignment),
            },
        };
    };

    const lowerBound = (): number => {
        let maxDegree = 0;
        for (const v of vertices) {
            maxDegree = Math.max(maxDegree, neighbor.get(v)?.size ?? 0);
        }
        return maxDegree > 0 ? 2 : 1;
    };

    const tryColor = (k: number, index: number, assignment: Map<string, number>): boolean => {
        if (index >= order.length) {
            return true;
        }
        const v = order[index];
        if (v === undefined) {
            return false;
        }
        for (let color = 0; color < k; color += 1) {
            attempts += 1;
            let ok = true;
            for (const u of neighbor.get(v) ?? []) {
                if (assignment.get(u) === color) {
                    ok = false;
                    break;
                }
            }
            if (!ok) {
                continue;
            }
            assignment.set(v, color);
            if (tryColor(k, index + 1, assignment)) {
                return true;
            }
            assignment.delete(v);
        }
        return false;
    };

    yield {
        ...snap("Searching for the smallest number of colors with backtracking.", 1, "", new Map()),
        stepNumber: 0,
    };
    let step = 1;

    for (let k = lowerBound(); k <= vertices.length; k += 1) {
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
                    ? `A proper ${shot.k}-coloring was found for the current vertex order.`
                    : `${shot.k} colors are not enough for this graph; increasing the count.`,
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
            `The chromatic number is ${chromatic}; adjacent vertices share no color.`,
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
            "Coloring is like assigning exam slots so no student has two exams at once. Trying one color count at a time, the search colors a high-degree vertex first and always picks the smallest color that does not clash with already colored neighbors. If a count fails, every assignment branch has been ruled out and the search moves to the next count.",
        invariants: [
            "No two adjacent vertices ever share a color during the search.",
            "If k colors fail, no k-coloring exists for this graph.",
            "The first successful count is the smallest possible count.",
        ],
        correctness:
            "Backtracking tries every admissible color for every vertex in a fixed order, so if a k-coloring exists the recursion will find it; if it returns failure, all k^V assignments have been excluded. Since counts are tested in increasing order starting from a valid lower bound, the first success is the minimum count, which is the chromatic number.",
        complexityRationale:
            "For a fixed k there are at most k^V assignments, each checked against the neighbor set in O(V + E) total, and up to V values of k are tried, giving the stated bound. The assignment map and adjacency use O(V + E) space.",
        uses: [
            "Register allocation in compilers",
            "Frequency assignment in wireless networks",
            "Exam and meeting scheduling with conflict constraints",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on graph coloring",
            "Jensen and Toft, Graph Coloring Problems",
        ],
        workedExample:
            "A triangle needs three colors: two colors fail because the third vertex touches both colored neighbors, while assigning colors 0, 1 and 2 around the triangle succeeds, so the chromatic number is 3.",
    },
    id: "graph-coloring-backtracking",
    name: "Exact Graph Coloring by Backtracking",
    category: "graph",
    complexity: { time: "O(k^V * (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["A", "C", "E"],
            E: ["D"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "order vertices by decreasing degree",
        "set the color count to a simple lower bound",
        "try to assign each vertex the smallest admissible color",
        "backtrack when a color clashes with an assigned neighbor",
        "on success, record the coloring and stop searching this count",
        "on failure, increase the color count and try again",
        "repeat until a proper coloring is found",
        "report the chromatic number and the coloring",
    ],
};

export default module;
