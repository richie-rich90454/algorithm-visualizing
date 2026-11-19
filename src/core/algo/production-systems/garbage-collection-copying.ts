/**
 * garbage-collection-copying.ts - Cheney Semi-Space Copying Collector
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A copying collector divides memory into two semi-spaces. It copies every
 * object reachable from the roots into the other semi-space, following fields
 * breadth-first with a scan pointer, and updates each field to the new address.
 * A forwarding table makes sure an object is copied only once, even inside
 * cycles. Everything left behind in the old semi-space is garbage and the whole
 * region can be reclaimed at once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) - each live object and field is visited a constant number of times
 *   Space: O(V) for the forwarding table and the new semi-space
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are heap objects; edges are reference fields.
 *   - A copied (live) node is green; an uncopied node is idle.
 *   - An edge turns blue once both of its endpoints have been copied.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface HeapObject {
    id: number;
    fields: number[];
}

interface CopiedObject {
    origId: number;
    fieldOrig: number[];
    fieldCopy: number[];
}

function makeFrame(
    objects: HeapObject[],
    byId: Map<number, HeapObject>,
    forwarding: Map<number, number>,
    toObjects: CopiedObject[],
    newRoots: number[],
    step: number,
    phase: string,
    activeId: number,
): VisualFrame {
    const entities: VisualEntity[] = objects.map((obj) => {
        let state: EntityState = forwarding.has(obj.id) ? "sorted" : "idle";
        if (obj.id === activeId) state = "active";
        return {
            id: `obj-${obj.id}`,
            type: "node" as const,
            label: `o${obj.id}`,
            value: obj.id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { objectId: obj.id, copied: forwarding.has(obj.id) },
        };
    });

    const edges: VisualEdge[] = [];
    for (const obj of objects) {
        for (const field of byId.get(obj.id)?.fields ?? []) {
            if (!byId.has(field)) continue;
            const live = forwarding.has(obj.id) && forwarding.has(field);
            edges.push({
                id: `ref-${obj.id}-${field}`,
                sourceId: `obj-${obj.id}`,
                targetId: `obj-${field}`,
                label: "ref",
                state: live ? "path" : "idle",
                directed: true,
            });
        }
    }

    const copiedIds = [...forwarding.keys()].sort((a, b) => a - b);
    const forwardingFlat: number[] = [];
    for (const [key, value] of forwarding) {
        forwardingFlat.push(key, value);
    }

    return {
        stepNumber: step,
        entities,
        edges,
        description:
            phase === "init"
                ? `Starting copying collection with ${objects.length} object(s) and ${newRoots.length} root(s).`
                : phase === "root"
                  ? `Copied root object ${activeId} into the new semi-space at address ${forwarding.get(activeId)}.`
                  : phase === "copy"
                    ? `Followed a field to object ${activeId} and copied it to address ${forwarding.get(activeId)}.`
                    : `Collection complete: ${copiedIds.length} live object(s) copied; the rest are garbage.`,
        codeLineNumber:
            phase === "init" ? 0 : phase === "root" ? 1 : phase === "copy" ? 3 : 5,
        layout: "graph",
        meta: {
            objectCount: objects.length,
            rootCount: newRoots.length,
            copied: copiedIds,
            forwarding: forwardingFlat,
            toSpaceSize: toObjects.length,
            newRoots: [...newRoots],
            phase,
        },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { roots?: number[]; objects?: HeapObject[] } | null) ?? {};
    const objects: HeapObject[] = Array.isArray(task.objects) && task.objects.length > 0
        ? task.objects.map((obj) => ({ id: obj.id, fields: [...(obj.fields ?? [])] }))
        : [
              { id: 0, fields: [1, 2] },
              { id: 1, fields: [3] },
              { id: 2, fields: [] },
              { id: 3, fields: [1] },
              { id: 4, fields: [5] },
              { id: 5, fields: [] },
          ];
    const roots = Array.isArray(task.roots)
        ? task.roots.filter((id) => objects.some((obj) => obj.id === id))
        : [0];

    const byId = new Map(objects.map((obj) => [obj.id, obj]));
    const forwarding = new Map<number, number>();
    const toObjects: CopiedObject[] = [];
    const newRoots: number[] = [];

    const forward = (id: number): number => {
        const existing = forwarding.get(id);
        if (existing !== undefined) return existing;
        const address = toObjects.length;
        forwarding.set(id, address);
        const obj = byId.get(id);
        toObjects.push({
            origId: id,
            fieldOrig: (obj?.fields ?? []).filter((field) => byId.has(field)),
            fieldCopy: [],
        });
        return address;
    };

    let step = 0;
    yield makeFrame(objects, byId, forwarding, toObjects, newRoots, step, "init", -1);
    step += 1;

    for (const root of roots) {
        newRoots.push(forward(root));
        yield makeFrame(objects, byId, forwarding, toObjects, newRoots, step, "root", root);
        step += 1;
    }

    let scan = 0;
    while (scan < toObjects.length) {
        const current = toObjects[scan]!;
        for (const field of current.fieldOrig) {
            const wasCopied = forwarding.has(field);
            const address = forward(field);
            current.fieldCopy.push(address);
            if (!wasCopied) {
                yield makeFrame(objects, byId, forwarding, toObjects, newRoots, step, "copy", field);
                step += 1;
            }
        }
        scan += 1;
    }

    yield makeFrame(objects, byId, forwarding, toObjects, newRoots, step, "done", -1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split memory in two and only copy what is still alive. Start from the roots, copy each reached object to the new half, then scan the copied objects and copy anything they point to. Because a forwarding table records where each object went, cycles and repeated references reuse the same copy. When the scan finishes, the old half contains only garbage and can be discarded in one sweep.",
        invariants: [
            "An object is copied at most once; later references reuse its forwarding address.",
            "The scan pointer only advances over objects already placed in the new semi-space.",
            "After the scan, every field of a copied object points to a copied object.",
        ],
        correctness:
            "Forwarding is invoked exactly on the roots and on fields of copied objects, so by induction the set of copied objects is precisely the transitive closure of the roots, which is the live set. The forwarding table guarantees a single copy per object, so cycles terminate and shared references stay shared. Any object never reached is never copied and is therefore garbage, which the collector reclaims together with the whole old semi-space.",
        complexityRationale:
            "Each live object is copied once and each of its fields is examined once during the scan, so the work is proportional to the number of live vertices plus live edges. The forwarding table and new semi-space hold one entry per live object, giving linear space.",
        uses: [
            "Generational and semi-space garbage collectors in managed runtimes",
            "Compacting collectors that eliminate heap fragmentation",
            "Teaching reachability and forwarding pointers in runtime systems",
        ],
        references: [
            "Cheney, A Nonrecursive List Compacting Algorithm, 1970",
            "Jones, Hosking, and Moss, The Garbage Collection Handbook, 2012",
        ],
        workedExample:
            "With root object 0 pointing to 1 and 2, object 1 pointing to 3, and object 3 pointing back to 1, the collector copies 0, then 1, then 2, then 3. When 3's field refers to 1, the forwarding table already maps 1, so no second copy is made. Objects 4 and 5 are unreachable and are left behind as garbage.",
    },
    id: "garbage-collection-copying",
    name: "Semi-Space Copying Garbage Collection",
    category: "production-systems",
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
        roots: [0],
        objects: [
            { id: 0, fields: [1, 2] },
            { id: 1, fields: [3] },
            { id: 2, fields: [] },
            { id: 3, fields: [1] },
            { id: 4, fields: [5] },
            { id: 5, fields: [] },
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with an empty forwarding table and an empty new semi-space",
        "for each root, copy it into the new semi-space",
        "set the scan pointer to the start of the new semi-space",
        "while the scan pointer has not passed the last copied object",
        "for each field of the scanned object, copy its target if not yet copied",
        "rewrite the field to the target's forwarding address",
        "advance the scan pointer",
        "done: all copied objects are live, everything else is garbage",
    ],
};

export default module;
