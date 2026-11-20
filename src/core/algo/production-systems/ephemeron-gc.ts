/**
 * ephemeron-gc.ts - Ephemeron Garbage Collection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An ephemeron is a weak-key association: its value is reachable only when
 * its key is reachable from somewhere outside the ephemeron itself. This
 * matters for memoization tables, where a cached value must not keep its own
 * key alive forever. The collector starts from the roots, follows ordinary
 * edges, and repeatedly activates ephemerons whose key has become reachable,
 * marking their values. It repeats to a fixed point, since activating one
 * ephemeron can make another ephemeron's key reachable. Anything still
 * unmarked at the fixed point is garbage.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + E + K) * iterations), at most V iterations in the worst case
 *   Space: O(V) for the mark set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are graph vertices; solid edges are strong links.
 *   - Ephemeron links are dashed edges from key to value.
 *   - Newly marked nodes are CYAN, live nodes GREEN, garbage RED at the end.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Ephemeron {
    key: string;
    value: string;
}

interface Edge {
    from: string;
    to: string;
}

/** Compute the least fixed point of reachable nodes. */
function collect(
    nodes: string[],
    roots: string[],
    ephemerons: Ephemeron[],
    edges: Edge[],
): { marked: string[]; iterations: number } {
    const marked = new Set(roots.filter((r) => nodes.includes(r)));
    let iterations = 0;
    for (;;) {
        iterations += 1;
        const before = marked.size;
        for (const edge of edges) {
            if (marked.has(edge.from) && nodes.includes(edge.to)) marked.add(edge.to);
        }
        for (const eph of ephemerons) {
            if (marked.has(eph.key) && nodes.includes(eph.value)) marked.add(eph.value);
        }
        if (marked.size === before) break;
    }
    return { marked: [...marked], iterations };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { roots?: string[]; ephemerons?: Ephemeron[]; edges?: Edge[] } | null) ?? {};
    const roots: string[] = Array.isArray(task.roots) ? [...task.roots] : ["A"];
    const ephemerons: Ephemeron[] = Array.isArray(task.ephemerons)
        ? task.ephemerons.map((e) => ({ key: String(e.key), value: String(e.value) }))
        : [
              { key: "A", value: "B" },
              { key: "C", value: "D" },
          ];
    const edges: Edge[] = Array.isArray(task.edges)
        ? task.edges.map((e) => ({ from: String(e.from), to: String(e.to) }))
        : [{ from: "B", to: "E" }];

    const nodes = [...new Set([
        ...roots,
        ...edges.flatMap((e) => [e.from, e.to]),
        ...ephemerons.flatMap((e) => [e.key, e.value]),
    ])];
    const final = collect(nodes, roots, ephemerons, edges);
    const finalMarked = new Set(final.marked);

    const visualEdges: VisualEdge[] = [
        ...edges.map((e, i) => ({
            id: `edge-strong-${i}`,
            sourceId: `node-${e.from}`,
            targetId: `node-${e.to}`,
            label: "strong",
            state: "path" as EntityState,
            directed: true,
        })),
        ...ephemerons.map((e, i) => ({
            id: `edge-eph-${i}`,
            sourceId: `node-${e.key}`,
            targetId: `node-${e.value}`,
            label: "weak",
            state: "comparing" as EntityState,
            directed: true,
        })),
    ];

    const entityList = (marked: Set<string>, fresh: Set<string>, phase: "init" | "mark" | "final"): VisualEntity[] =>
        nodes.map((name) => {
            let state: EntityState = "unvisited";
            if (marked.has(name)) state = phase === "final" ? "sorted" : "idle";
            if (fresh.has(name)) state = "active";
            if (phase === "final" && !marked.has(name)) state = "error";
            return {
                id: `node-${name}`,
                type: "node" as const,
                label: name,
                value: name,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { name, marked: marked.has(name), root: roots.includes(name) },
            };
        });

    const commonMeta = {
        nodeCount: nodes.length,
        ephemeronCount: ephemerons.length,
        edgeCount: edges.length,
        nodes,
    };

    yield {
        stepNumber: 0,
        entities: entityList(new Set(), new Set(roots), "init"),
        edges: visualEdges,
        description: `Starting from ${roots.length} root(s); ${nodes.length} node(s) and ${ephemerons.length} ephemeron(s) are present.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { ...commonMeta, phase: "init", marked: [] },
    };

    const marked = new Set(roots.filter((r) => nodes.includes(r)));
    let step = 1;
    for (;;) {
        const before = new Set(marked);
        for (const edge of edges) {
            if (marked.has(edge.from) && nodes.includes(edge.to)) marked.add(edge.to);
        }
        for (const eph of ephemerons) {
            if (marked.has(eph.key) && nodes.includes(eph.value)) marked.add(eph.value);
        }
        const fresh = new Set([...marked].filter((n) => !before.has(n)));
        const phase = fresh.size === 0 ? "final" : "mark";
        yield {
            stepNumber: step,
            entities: entityList(marked, fresh, phase),
            edges: visualEdges,
            description:
                phase === "final"
                    ? `Fixed point reached: ${marked.size} live node(s), ${nodes.length - marked.size} garbage.`
                    : `Marking ${[...fresh].join(",")} from strong edges and reachable ephemeron keys.`,
            codeLineNumber: phase === "final" ? 6 : 3,
            layout: "graph",
            meta: {
                ...commonMeta,
                phase,
                marked: [...marked],
                fresh: [...fresh],
                iterations: step,
            },
        };
        step += 1;
        if (phase === "final") break;
    }
    const garbage = nodes.filter((n) => !finalMarked.has(n));
    yield {
        stepNumber: step,
        entities: entityList(finalMarked, new Set(), "final"),
        edges: visualEdges,
        description: `Collection complete: ${garbage.length} garbage node(s) [${garbage.join(",")}] reclaimed.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { ...commonMeta, phase: "done", marked: [...finalMarked], garbage, iterations: final.iterations },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal strong reference keeps an object alive, but a weak-key table must not: a cache entry should disappear when nobody else needs its key. An ephemeron encodes this rule. Its value becomes live only once its key is live independently, and because that new value might itself be a key elsewhere, the collector repeats the scan until nothing new is discovered.",
        invariants: [
            "A node is marked only if it is a root or reachable from a marked node by a strong edge or a reachable ephemeron.",
            "The marked set grows monotonically and never shrinks.",
            "At the fixed point no strong edge or active ephemeron points from a marked node to an unmarked node.",
        ],
        correctness:
            "The loop is a standard least-fixed-point iteration over a monotone operator: it starts with the roots and only adds nodes, so it must terminate within the number of nodes. At termination no rule can add another node, so the marked set is closed under all reachability rules and is the smallest such set, which is exactly the live data. Every other node is unreachable and may be reclaimed safely.",
        complexityRationale:
            "Each iteration scans all strong edges and ephemerons once. At least one node is added on every nonterminal iteration, so there are at most V iterations, giving O((V + E + K) * V) worst-case time and O(V) space for the mark set.",
        uses: [
            "Weak-key memoization tables and caches",
            "Finalizer and weak-reference semantics in managed runtimes",
            "Symbol tables that must not retain unreachable keys",
        ],
        references: [
            "Doligez, Leroy and Conchon, A Safe Concurrent Garbage Collector, 1999",
            "Wikipedia, Ephemeron (weak key-value pair)",
        ],
        workedExample:
            "With root A, ephemerons A to B and C to D, and a strong edge B to E, the collector marks A, then activates A to B and follows B to E. The ephemeron C to D never activates because C is unreachable, so D is garbage while A, B and E survive.",
    },
    id: "ephemeron-gc",
    name: "Ephemeron Garbage Collection",
    category: "production-systems",
    complexity: { time: "O((V + E + K) * V)", space: "O(V)" },
    defaultInput: {
        roots: ["A"],
        ephemerons: [
            { key: "A", value: "B" },
            { key: "C", value: "D" },
        ],
        edges: [{ from: "B", to: "E" }],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "mark every root node",
        "repeat until no node is newly marked",
        "follow strong edges out of marked nodes",
        "for each ephemeron whose key is marked mark its value",
        "stop when a full pass adds nothing",
        "collect every node that remains unmarked",
        "done: report the live set and the reclaimed garbage",
    ],
};

export default module;
