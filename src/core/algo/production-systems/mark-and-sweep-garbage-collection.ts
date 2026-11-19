/**
 * mark-and-sweep-garbage-collection.ts - Mark and Sweep Garbage Collection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A tracing collector first marks every object reachable from the root set by
 * following references, then sweeps the heap and reclaims every object that was
 * never marked. Anything unreachable cannot be used again, so freeing it is
 * safe. The two phases are the classic mark-and-sweep algorithm.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for V objects and E references
 *   Space: O(V) for the mark set and traversal stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Objects are nodes; references are directed edges.
 *   - Marked nodes are blue, swept survivors green, reclaimed nodes red.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    objects?: string[];
    refs?: Record<string, string[]>;
    roots?: string[];
}

/** Build node entities reflecting the current mark and sweep state. */
function makeNodes(
    objects: string[],
    marked: Set<string>,
    swept: Map<string, boolean>,
    current: string | null,
): VisualEntity[] {
    return objects.map((id) => {
        let state: EntityState = "unvisited";
        if (swept.has(id)) state = swept.get(id) ? "sorted" : "error";
        else if (marked.has(id)) state = "visited";
        if (id === current) state = "comparing";
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { object: id, marked: marked.has(id) },
        };
    });
}

/** Build reference edges, highlighting those leaving the current node. */
function makeEdges(refs: Record<string, string[]>, current: string | null): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const [from, targets] of Object.entries(refs)) {
        for (const to of targets) {
            edges.push({
                id: `edge-${from}-${to}`,
                sourceId: `node-${from}`,
                targetId: `node-${to}`,
                label: "",
                state: from === current ? "active" : "idle",
                directed: true,
            });
        }
    }
    return edges;
}

/** The mark-and-sweep generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const objects = Array.isArray(task.objects) && task.objects.length > 0
        ? task.objects.slice()
        : ["A", "B", "C", "D", "E", "F", "G"];
    const refs: Record<string, string[]> = task.refs && typeof task.refs === "object"
        ? task.refs
        : { A: ["B", "C"], B: ["D"], C: ["E"], D: [], E: ["B"], F: ["G"], G: [] };
    const roots = Array.isArray(task.roots) ? task.roots.slice() : ["A"];
    const known = new Set(objects);
    const marked = new Set<string>();
    const swept = new Map<string, boolean>();

    const summary = () => ({
        objects: objects.length,
        markedCount: marked.size,
        collected: objects.filter((id) => swept.has(id) && !swept.get(id)),
        reachable: objects.filter((id) => marked.has(id)),
    });

    yield {
        stepNumber: 0,
        entities: makeNodes(objects, marked, swept, null),
        edges: makeEdges(refs, null),
        description: `Mark and sweep over ${objects.length} objects starting from roots ${roots.join(", ")}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: summary(),
    };
    let step = 1;

    // Mark phase: depth-first traversal from every root.
    const stack = roots.filter((id) => known.has(id));
    while (stack.length > 0) {
        const id = stack.pop();
        if (id === undefined || marked.has(id)) continue;
        marked.add(id);
        yield {
            stepNumber: step,
            entities: makeNodes(objects, marked, swept, id),
            edges: makeEdges(refs, id),
            description: `Marking object ${id}: it is reachable, so follow its references.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: summary(),
        };
        step += 1;
        for (const next of refs[id] ?? []) {
            if (known.has(next) && !marked.has(next)) stack.push(next);
        }
    }

    // Sweep phase: keep marked objects, reclaim the rest.
    for (const id of objects) {
        const keep = marked.has(id);
        swept.set(id, keep);
        yield {
            stepNumber: step,
            entities: makeNodes(objects, marked, swept, id),
            edges: makeEdges(refs, null),
            description: id && keep
                ? `Sweeping ${id}: marked, so keep it.`
                : `Sweeping ${id}: unmarked, so reclaim it as garbage.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: summary(),
        };
        step += 1;
    }

    const final = summary();
    yield {
        stepNumber: step,
        entities: makeNodes(objects, marked, swept, null),
        edges: makeEdges(refs, null),
        description: `Collection complete: kept ${objects.length - final.collected.length} object(s), reclaimed ${final.collected.length}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: final,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An object is garbage exactly when nothing can reach it by following references from the program's roots. So start at the roots and paint every reachable object. Once painting stops, walk the whole heap and throw away every unpainted object, because no future computation could ever ask for it.",
        invariants: [
            "An object enters the mark set at most once.",
            "Every marked object is reachable from some root by followed references.",
            "After sweeping, an object is kept if and only if it was marked.",
        ],
        correctness:
            "The depth-first traversal visits exactly the vertices reachable from the roots, because it follows every outgoing reference and skips nothing reachable. Any object not visited has no chain of references from a root, hence cannot be accessed again and may be reclaimed. The sweep retains precisely the marked set, so no live object is freed and no unreachable object survives.",
        complexityRationale:
            "Each object is marked once and each reference is examined once during traversal, and the sweep visits every object once, giving O(V+E) time. The mark set and traversal stack hold at most V objects, so space is O(V).",
        uses: [
            "Automatic memory management in Java and Go runtimes",
            "Reference counting fallback for cyclic data structures",
            "Detecting unreachable resources in garbage-collected heaps",
        ],
        references: [
            "McCarthy, Recursive Functions of Symbolic Expressions, 1960",
            "Jones, Hosking, and Moss, The Garbage Collection Handbook, Chapter 2",
        ],
        workedExample:
            "With objects A through G, edges A to B and C, B to D, C to E, E to B, and F to G, with root A, marking reaches A, B, C, D, E. Sweeping keeps those five and reclaims F and G because no root chain reaches them.",
    },
    id: "mark-and-sweep-garbage-collection",
    name: "Mark and Sweep Garbage Collection",
    category: "production-systems",
    complexity: { time: "O(V+E)", space: "O(V)" },
    defaultInput: {
        objects: ["A", "B", "C", "D", "E", "F", "G"],
        refs: { A: ["B", "C"], B: ["D"], C: ["E"], D: [], E: ["B"], F: ["G"], G: [] },
        roots: ["A"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with an empty mark set and stack of roots",
        "while the stack is not empty",
        "pop an object; skip it if already marked",
        "mark it and push each referenced object",
        "for every object in the heap",
        "keep it when marked, otherwise reclaim it",
        "done: report the reachable and reclaimed objects",
    ],
};

export default module;
