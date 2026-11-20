/**
 * weak-reference-gc.ts - Mark-Sweep Garbage Collection with Weak References
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This tracing collector starts from a set of roots and marks everything
 * reachable through strong references only. Weak references do not keep an
 * object alive: after marking, any weak edge whose target was not marked is
 * cleared before the garbage objects are swept. This is the mechanism behind
 * caches and observer lists that must not pin their entries in memory.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for the mark traversal plus O(E) weak-edge clearing
 *   Space: O(V) for the mark set and work stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each object is a node; strong and weak references are directed edges.
 *   - Reached nodes are highlighted as the mark traversal proceeds.
 *   - The final frame reports reclaimed objects and cleared weak references.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

interface HeapObject {
    id: number;
    strong: number[];
    weak: number[];
}

function buildEntities(objects: HeapObject[], marked: Set<number>, current: number): VisualEntity[] {
    return objects.map((obj) => ({
        id: `obj-${obj.id}`,
        type: "node" as const,
        label: String(obj.id),
        value: obj.id,
        state: (obj.id === current ? "active" : marked.has(obj.id) ? "visited" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { objectId: obj.id },
    }));
}

function buildEdges(objects: HeapObject[], cleared: Set<string>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const obj of objects) {
        for (const target of obj.strong) {
            edges.push({
                id: `strong-${obj.id}-${target}`,
                sourceId: `obj-${obj.id}`,
                targetId: `obj-${target}`,
                label: "strong",
                state: "path" as EntityState,
                directed: true,
            });
        }
        for (const target of obj.weak) {
            const clearedEdge = cleared.has(`${obj.id}-${target}`);
            edges.push({
                id: `weak-${obj.id}-${target}`,
                sourceId: `obj-${obj.id}`,
                targetId: `obj-${target}`,
                label: clearedEdge ? "weak-cleared" : "weak",
                state: (clearedEdge ? "error" : "idle") as EntityState,
                directed: true,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { objects?: HeapObject[]; roots?: number[] } | null) ?? {};
    const objects: HeapObject[] = Array.isArray(task.objects)
        ? task.objects
        : [
              { id: 0, strong: [1], weak: [3] },
              { id: 1, strong: [2], weak: [] },
              { id: 2, strong: [1], weak: [3] },
              { id: 3, strong: [], weak: [] },
              { id: 4, strong: [], weak: [] },
          ];
    const roots: number[] = Array.isArray(task.roots) ? task.roots : [0];
    const known = new Set(objects.map((obj) => obj.id));
    const byId = new Map<number, HeapObject>(objects.map((obj) => [obj.id, obj]));

    const marked = new Set<number>();
    const stack: number[] = roots.filter((id) => known.has(id));
    let step = 0;
    yield {
        stepNumber: step++,
        entities: buildEntities(objects, marked, -1),
        edges: buildEdges(objects, new Set()),
        description: `Starting mark-sweep over ${objects.length} objects from ${stack.length} root(s).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { roots, objectCount: objects.length, phase: "start" },
    };

    while (stack.length > 0) {
        const id = stack.pop() as number;
        if (marked.has(id)) continue;
        marked.add(id);
        const obj = byId.get(id) as HeapObject;
        for (const target of obj.strong) {
            if (known.has(target) && !marked.has(target)) stack.push(target);
        }
        yield {
            stepNumber: step++,
            entities: buildEntities(objects, marked, id),
            edges: buildEdges(objects, new Set()),
            description: `Marked object ${id}; followed ${obj.strong.length} strong edge(s), never weak edges.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { marked: [...marked], current: id, phase: "mark" },
        };
    }

    const cleared = new Set<string>();
    const clearedList: Array<{ from: number; to: number }> = [];
    for (const obj of objects) {
        for (const target of obj.weak) {
            if (!marked.has(target)) {
                cleared.add(`${obj.id}-${target}`);
                clearedList.push({ from: obj.id, to: target });
            }
        }
    }
    const garbage = objects.filter((obj) => !marked.has(obj.id)).map((obj) => obj.id);

    yield {
        stepNumber: step++,
        entities: buildEntities(objects, marked, -1),
        edges: buildEdges(objects, cleared),
        description: `Swept ${garbage.length} object(s) and cleared ${clearedList.length} weak reference(s).`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { roots, reachable: [...marked], garbage, clearedWeak: clearedList, phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A tracing collector decides what is live by walking references from the roots, but not every reference should count. A weak reference lets one object point at another without keeping it alive. After the mark phase, weak edges pointing at unmarked objects are cleared, so entries that nothing else owns can be reclaimed.",
        invariants: [
            "Only strong references are followed during marking.",
            "An object is garbage exactly when no root reaches it through strong edges.",
            "Weak edges are cleared only when their target is garbage.",
        ],
        correctness:
            "The worklist marks every object reachable from the roots by strong edges and nothing else, because each pushed target is known and a marked object is never processed twice. The set of unmarked objects is therefore precisely the unreachable garbage. A weak edge to an unmarked target cannot keep that target alive, so clearing it is safe, and a weak edge to a marked target is left intact because its target survives. This matches the defining semantics of weak references.",
        complexityRationale:
            "Marking visits each reachable object and each strong edge once, O(V + E), and the weak sweep scans every weak edge once. The mark set and stack use O(V) space.",
        uses: [
            "Ephemeron tables and weak caches in managed runtimes",
            "Observer and listener registries that must not leak objects",
            "Teaching reachability in tracing garbage collectors",
        ],
        references: [
            "Jones, Hosking and Moss, The Garbage Collection Handbook",
            "McCarthy, Recursive Functions of Symbolic Expressions, 1960 (original GC)",
        ],
        workedExample:
            "With root 0 pointing strongly to 1, and a weak edge from 0 to object 3 that no strong path reaches, marking visits 0 and 1 only. Object 3 is garbage, so the weak edge 0 to 3 is cleared before 3 is swept.",
    },
    id: "weak-reference-gc",
    name: "Mark-Sweep GC with Weak References",
    category: "production-systems",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        objects: [
            { id: 0, strong: [1], weak: [3] },
            { id: 1, strong: [2], weak: [] },
            { id: 2, strong: [1], weak: [3] },
            { id: 3, strong: [], weak: [] },
            { id: 4, strong: [], weak: [] },
        ],
        roots: [0],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize the mark set empty and push all roots on a worklist",
        "while the worklist is not empty pop an object",
        "if it is unmarked, mark it and push its strong targets",
        "never follow weak references while marking",
        "after marking, clear every weak edge whose target is unmarked",
        "sweep all objects that were never marked",
        "done: report reachable objects, garbage and cleared weak edges",
    ],
};

export default module;
