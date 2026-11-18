/**
 * bipartite-check-two-coloring.ts – Bipartite Check (Two-Coloring)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A graph is bipartite when its vertices split into two groups with every
 * edge crossing between groups – equivalently, when it contains no odd
 * cycle. The test paints the graph with two colors by breadth-first search:
 * the start gets color 0 and every neighbor takes the opposite color of its
 * parent. If an edge ever joins two equally colored vertices, an odd cycle
 * exists and the graph is not bipartite. The even square A–B–C–D colors
 * cleanly, so it passes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – one BFS pass over all vertices and edges
 *   Space: O(V) for colors and the queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being expanded is YELLOW (comparing).
 *   - Newly colored neighbors are ORANGE (visited), then GREEN/ORANGE by color.
 *   - A conflicting edge flashes RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Two-colorability, odd-cycle freedom, and bipartiteness are equivalent.
 *   - Disconnected graphs need one BFS per component.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "D"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "A"],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const color = new Map<string, number>([[start, 0]]);
    const queue = [start];
    setN(start, "comparing");
    yield snap(`Two-coloring from ${start} (color 0).`, 0, { colored: 1 });
    step += 1;
    let ok = true;
    let bad = "";
    while (queue.length > 0 && ok) {
        const cur = queue.shift();
        if (cur === undefined) break;
        const cc = color.get(cur) ?? 0;
        setN(cur, "comparing");
        for (const nb of adjacency[cur] ?? []) {
            if (!color.has(nb)) {
                color.set(nb, 1 - cc);
                queue.push(nb);
                setE(cur, nb, "active");
                setN(nb, "visited");
                yield snap(`${nb} gets color ${1 - cc} (opposite of ${cur}).`, 1, {
                    colored: color.size,
                });
                step += 1;
            } else if (color.get(nb) === cc) {
                ok = false;
                bad = `${cur}–${nb}`;
                setE(cur, nb, "swapped");
                yield snap(`Conflict on edge ${bad}: both ends color ${cc} – odd cycle.`, 2, {
                    edge: bad,
                });
                step += 1;
                break;
            }
        }
        setN(cur, cc === 0 ? "sorted" : "visited");
    }
    clr();
    for (const [v, c] of color) setN(v, c === 0 ? "sorted" : "visited");
    yield snap(
        ok
            ? `Bipartite: color-0 {${labels.filter((v) => color.get(v) === 0).join(",")}} color-1 {${labels.filter((v) => color.get(v) === 1).join(",")}}.`
            : `Not bipartite – odd cycle at ${bad}.`,
        4,
        { bipartite: ok },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A graph is bipartite exactly when its vertices can be split into two groups with every edge crossing between them, which is equivalent to having no odd cycle. A breadth-first search colors the start one color and every neighbor the opposite color. If an edge ever joins two equally colored vertices, an odd cycle exists and the graph is not bipartite.",
        "invariants": [
            "Every colored vertex's color equals the parity of its distance from the start.",
            "An edge between equally colored vertices implies an odd cycle.",
            "All vertices reached so far respect the two-coloring rule unless a conflict was found."
        ],
        "correctness": "BFS assigns each vertex its distance parity from the start, and any edge in a bipartite graph must connect vertices of opposite parity. If the search finds an edge whose endpoints share a color, the two BFS paths to them plus that edge form an odd cycle, proving non-bipartiteness. If no conflict appears, the coloring itself is a valid bipartition.",
        "complexityRationale": "One BFS visits each vertex and edge once for O(V + E) time, and the color array plus queue use O(V) space.",
        "uses": [
            "Checking whether a graph can be two-colored for scheduling",
            "Detecting odd cycles as a graph property",
            "A prerequisite test for bipartite matching algorithms"
        ],
        "references": [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, breadth-first search",
            "Kleinberg and Tardos, Algorithm Design, bipartite graphs"
        ],
        "workedExample": "The even square A-B-C-D colors cleanly: A gets color 0, B and D get color 1, and C gets color 0. The final edge C-D connects different colors, so no conflict arises and the graph is bipartite with classes {A,C} and {B,D}."
    },
    id: "bipartite-check-two-coloring",
    name: "Bipartite Check (Two-Coloring)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        graph: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] },
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "color start 0 and enqueue start",
        "dequeue u; paint each uncolored neighbor the opposite color",
        "edge joining equal colors proves an odd cycle: not bipartite",
        "repeat until the queue is empty",
        "done: two color classes, or the conflicting odd-cycle edge",
    ],
};

export default module;
