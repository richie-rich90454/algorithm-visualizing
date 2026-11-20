/**
 * greedy-maximal-independent-set.ts – Maximal Independent Set (Greedy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An independent set holds vertices with no edge between any two; it is
 * maximal when every outsider touches the set (nothing more can be added).
 * The greedy scan walks the vertices in order and takes each vertex whose
 * neighbors are all still untaken, blocking its neighbors as it goes. On
 * the triangle-plus-tail it takes A (blocking B, C) and then D: {A, D} is
 * maximal, though not the largest possible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – one scan with neighbor marking
 *   Space: O(V) for the taken and blocked sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex under test is YELLOW (comparing).
 *   - Taken vertices turn GREEN (sorted); skipped ones ORANGE (visited).
 *   - The final set flashes GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Maximal (cannot grow) differs from maximum (largest): greed can miss it.
 *   - The complement of a maximal independent set is a minimal vertex cover.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; order?: string[] } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C"],
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
    const order = task.order ?? [...labels].sort();
    const taken = new Set<string>();
    const blocked = new Set<string>();
    yield snap(`Greedy MIS in order ${order.join(", ")}: take a vertex only if free.`, 0, {});
    step += 1;
    for (const v of order) {
        setN(v, "comparing");
        if (!blocked.has(v)) {
            taken.add(v);
            for (const nb of adjacency[v] ?? []) blocked.add(nb);
            setN(v, "sorted");
            for (const nb of adjacency[v] ?? []) setE(v, nb, "active");
            yield snap(
                `Take ${v}: neighbors {${(adjacency[v] ?? []).join(",")}} are now blocked.`,
                1,
                { taken: taken.size },
            );
        } else {
            setN(v, "visited");
            yield snap(`Skip ${v}: a taken neighbor already covers it.`, 1, { taken: taken.size });
        }
        step += 1;
    }
    clr();
    for (const v of taken) setN(v, "path");
    for (const v of labels) if (!taken.has(v)) setN(v, "visited");
    yield snap(
        `Maximal independent set {${[...taken].sort().join(",")}} – every outsider touches it.`,
        4,
        { size: taken.size },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An independent set contains no adjacent vertices, and it is maximal when every outside vertex touches the set. The greedy scan walks vertices in order, taking a vertex when none of its neighbors has been taken and blocking its neighbors as it goes.",
        "invariants": [
            "No two taken vertices are adjacent.",
            "Every vertex skipped because of a neighbor is dominated by the set.",
            "At the end every vertex is either taken or adjacent to a taken vertex."
        ],
        "correctness": "Taking a vertex only when none of its neighbors is already taken preserves independence. At termination any vertex not taken was blocked at the time by a neighbor that was taken, so every outsider touches the set and it is maximal. Note that maximal does not mean maximum.",
        "complexityRationale": "One pass with neighbor marking examines each edge once, O(V + E) time, and the taken and blocked sets use O(V) space.",
        "uses": [
            "Selecting non-conflicting tasks or frequencies",
            "A greedy starting point for maximum independent set heuristics",
            "Computing a maximal set quickly on large graphs"
        ],
        "references": [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, greedy algorithms",
            "Garey and Johnson, Computers and Intractability, independent set"
        ],
        "workedExample": "On the triangle-plus-tail graph the scan takes A, blocking B and C, then takes D. The set {A,D} is independent and every other vertex touches it, so it is maximal, even though a single triangle vertex plus D would also be maximal."
    },
    id: "greedy-maximal-independent-set",
    name: "Maximal Independent Set (Greedy)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "walk the vertices in order with empty taken and blocked sets",
        "take v if no neighbor is taken, else skip it as covered",
        "repeat until every vertex is taken or skipped",
        "check that every outsider touches the set",
        "done: a maximal independent set such as {A,D}",
    ],
};

export default module;
