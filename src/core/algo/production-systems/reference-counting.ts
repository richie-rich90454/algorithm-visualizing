/**
 * reference-counting.ts - Reference Counting Memory Reclamation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Reference counting attaches a live count to every heap object. Creating an
 * object gives it one external root reference; assigning a field increments the
 * target and decrements the old value; dropping a root decrements its count.
 * When a count falls to zero the object is freed and its own outgoing references
 * are released, cascading through the graph. Cyclic garbage is the known
 * limitation of the technique.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(V + E) over reachable objects for each collection cascade
 *   Space: O(V + E) for the object graph and the creation log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the reference count of each object, plus a heap summary.
 *   - A modified object is highlighted; freed objects turn red.
 *   - meta carries counts, the root set, and the order of reclamations.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type RefOp =
    | { op: "new"; id: string }
    | { op: "set"; from: string; to: string }
    | { op: "drop"; id: string };

/** Count references to one object from roots and from other live objects. */
export function countReferences(objects: Map<string, string[]>, roots: Set<string>, id: string): number {
    let count = roots.has(id) ? 1 : 0;
    for (const refs of objects.values()) {
        for (const target of refs) {
            if (target === id) {
                count += 1;
            }
        }
    }
    return count;
}

/** Reclaim every object whose reference count reaches zero, cascading. */
export function collect(objects: Map<string, string[]>, roots: Set<string>): string[] {
    const freed: string[] = [];
    let changed = true;
    while (changed) {
        changed = false;
        for (const id of Array.from(objects.keys())) {
            if (!roots.has(id) && countReferences(objects, roots, id) === 0) {
                objects.delete(id);
                freed.push(id);
                changed = true;
            }
        }
    }
    return freed;
}

/** Build one bar for the heap summary and one per ever-created object. */
function makeEntities(
    created: string[],
    objects: Map<string, string[]>,
    roots: Set<string>,
    active: string,
): VisualEntity[] {
    const heap: VisualEntity = {
        id: "heap",
        type: "bar" as const,
        label: `heap: ${objects.size}`,
        value: objects.size,
        state: "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: -1, role: "heap" },
    };
    const bars = created.map((id, index) => {
        const live = objects.has(id);
        const count = live ? countReferences(objects, roots, id) : 0;
        let state: EntityState = "unvisited";
        if (live) {
            state = id === active ? "comparing" : roots.has(id) ? "active" : "idle";
        } else if (id === active) {
            state = "error";
        }
        return {
            id: `obj-${index}`,
            type: "bar" as const,
            label: `${id}: ${count}`,
            value: count,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: id, count, live },
        };
    });
    return [heap, ...bars];
}

/** The reference counting generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { operations?: RefOp[] } | null) ?? {};
    const operations: RefOp[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations
        : [
              { op: "new", id: "A" },
              { op: "new", id: "B" },
              { op: "set", from: "A", to: "B" },
              { op: "drop", id: "B" },
              { op: "drop", id: "A" },
          ];

    const objects = new Map<string, string[]>();
    const roots = new Set<string>();
    const created: string[] = [];
    const freed: string[] = [];

    yield {
        stepNumber: 0,
        entities: makeEntities(created, objects, roots, ""),
        edges: [],
        description: `Reference counting over ${operations.length} memory operation(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { counts: [] as number[], roots: [] as string[], freed: [] as string[], live: 0 },
    };

    let step = 1;
    for (const operation of operations) {
        let active = "";
        let message = "";
        if (operation.op === "new") {
            if (!objects.has(operation.id)) {
                objects.set(operation.id, []);
                created.push(operation.id);
            }
            roots.add(operation.id);
            active = operation.id;
            message = `Create ${operation.id}: it starts with one root reference.`;
        } else if (operation.op === "set") {
            const refs = objects.get(operation.from);
            const target = operation.to;
            if (refs && objects.has(target)) {
                if (refs.length === 0) {
                    refs.push(target);
                } else {
                    refs[0] = target;
                }
            }
            active = operation.from;
            message = `Set ${operation.from}'s field to ${target}: the target gains a reference.`;
        } else {
            roots.delete(operation.id);
            const reclaimed = collect(objects, roots);
            freed.push(...reclaimed);
            active = operation.id;
            message = reclaimed.length > 0
                ? `Drop ${operation.id}: reclaimed ${reclaimed.join(", ")} by cascading decrements.`
                : `Drop ${operation.id}: object remains alive through other references.`;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(created, objects, roots, active),
            edges: [],
            description: message,
            codeLineNumber: operation.op === "new" ? 1 : operation.op === "set" ? 3 : 5,
            layout: "array",
            meta: {
                counts: created.map((id) => (objects.has(id) ? countReferences(objects, roots, id) : 0)),
                roots: created.filter((id) => roots.has(id)),
                freed: freed.slice(),
                live: objects.size,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(created, objects, roots, ""),
        edges: [],
        description: `Done: ${objects.size} object(s) still live, ${freed.length} reclaimed.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            counts: created.map((id) => (objects.has(id) ? countReferences(objects, roots, id) : 0)),
            roots: created.filter((id) => roots.has(id)),
            freed,
            live: objects.size,
            done: true,
        },
    };
}

/** The reference counting module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Each object keeps a tally of how many pointers refer to it. Creating a pointer adds one, removing one subtracts one, and when the tally reaches zero nobody can reach the object, so it can be freed immediately. Freeing it releases its own pointers, which may push other tallies to zero in a cascade.",
        invariants: [
            "An object's count equals the number of root pointers plus pointers held by live objects.",
            "A live object always has a positive reference count.",
            "When an object is freed, every reference it held is released exactly once.",
        ],
        correctness:
            "Each operation updates the graph and every count is recomputed from the graph itself, so the tallies never drift from the actual references. A zero-count object has no incoming pointer from a root or a live object, hence it is unreachable and safe to free. Deleting it removes its outgoing pointers, which can only lower other counts, so repeated cascades terminate and reclaim exactly the unreachable acyclic objects. A cycle keeps nonzero counts even when unreachable, which is the well-known limitation of pure reference counting.",
        complexityRationale:
            "Recomputing a count scans the live objects and their fields. The reclamation loop repeats at most once per freed object, so a cascade visits each object and edge a bounded number of times, O(V + E) per collection. Storing the graph and creation log uses O(V + E) space.",
        uses: [
            "Automatic memory management in languages and runtimes such as shared pointers",
            "Lifetime management of COM and other reference-counted components",
            "Resource pools where an object must die as soon as its last owner releases it",
        ],
        references: [
            "Collins, A Simple System for On-the-Fly Garbage Collection, 1960",
            "The C++ Standard Library, std::shared_ptr reference counting semantics",
        ],
        workedExample:
            "Create A and B, each with one root reference. Set A's field to B, giving B two references. Drop the root of B, leaving one reference from A. Drop the root of A: A reaches zero and is freed, releasing its field to B, which then reaches zero and is freed too. Both objects are reclaimed by the cascade.",
    },
    id: "reference-counting",
    name: "Reference Counting",
    category: "production-systems",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        operations: [
            { op: "new", id: "A" },
            { op: "new", id: "B" },
            { op: "set", from: "A", to: "B" },
            { op: "drop", id: "B" },
            { op: "drop", id: "A" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with an empty heap and an empty root set",
        "for each memory operation in the trace",
        "on create add an object with a single root reference",
        "on assign increment the new target and release the old target",
        "on drop remove the root reference from the object",
        "while an object has zero references free it",
        "releasing each of its outgoing references in turn",
        "done: report live objects and reclamation order",
    ],
};

export default module;
