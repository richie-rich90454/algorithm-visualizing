/**
 * crdt-lww-set.ts - LWW-Element-Set CRDT (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A last-writer-wins element set is a conflict-free replicated data type. Each
 * element has an add entry and a remove entry, and every entry carries a
 * timestamp (plus a replica id to break ties). An element is in the set exactly
 * when its newest add entry is newer than its newest remove entry. Replicas
 * merge by taking, entry by entry, the record with the larger timestamp. The
 * merge is commutative, associative, and idempotent, so replicas that see the
 * same updates converge to the same set in any delivery order.
 *
 * This is a deterministic teaching simulation that uses integer logical
 * timestamps. It does not model physical clocks, causal stability, or garbage
 * collection of tombstones; only the merge lattice and the add-wins rule are
 * faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) to merge two sets with n and m distinct elements
 *   Space: O(n) for the add and remove tag maps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each element is a cell; its state shows membership on each replica.
 *   - An element is green when present, red when absent, gray when unseen.
 *   - meta carries both replicas' tags, the merged tags, and the final set.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Tag {
    timestamp: number;
    replica: number;
}

export interface LWWSet {
    adds: Record<string, Tag>;
    removes: Record<string, Tag>;
}

export interface Operation {
    replica: number;
    action: "add" | "remove";
    element: string;
    timestamp: number;
}

/** Compare two tags: larger timestamp wins, replica id breaks ties. */
export function tagCompare(a: Tag | undefined, b: Tag | undefined): number {
    if (!a && !b) {
        return 0;
    }
    if (!a) {
        return -1;
    }
    if (!b) {
        return 1;
    }
    if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
    }
    return a.replica - b.replica;
}

/** True when the element is present in the set. */
export function lookup(set: LWWSet, element: string, addWins = true): boolean {
    const add = set.adds[element];
    const remove = set.removes[element];
    if (!add) {
        return false;
    }
    if (!remove) {
        return true;
    }
    if (add.timestamp !== remove.timestamp) {
        return add.timestamp > remove.timestamp;
    }
    return addWins;
}

/** Merge two LWW-element sets by pointwise maximum on both tag maps. */
export function mergeLWW(a: LWWSet, b: LWWSet, addWins = true): LWWSet {
    const adds: Record<string, Tag> = {};
    const removes: Record<string, Tag> = {};
    const keys = new Set([...Object.keys(a.adds), ...Object.keys(b.adds), ...Object.keys(a.removes), ...Object.keys(b.removes)]);
    for (const key of keys) {
        const add = tagCompare(a.adds[key], b.adds[key]) >= 0 ? a.adds[key] : b.adds[key];
        const remove = tagCompare(a.removes[key], b.removes[key]) >= 0 ? a.removes[key] : b.removes[key];
        if (add) {
            adds[key] = { ...add };
        }
        if (remove) {
            removes[key] = { ...remove };
        }
    }
    return { adds, removes };
}

/** Apply one operation to a replica's set, keeping the winning tag. */
export function applyOperation(set: LWWSet, op: Operation): void {
    const target = op.action === "add" ? set.adds : set.removes;
    const tag: Tag = { timestamp: op.timestamp, replica: op.replica };
    if (tagCompare(tag, target[op.element]) > 0) {
        target[op.element] = tag;
    }
}

/** Build a set from a list of operations. */
export function fromOperations(ops: Operation[]): LWWSet {
    const set: LWWSet = { adds: {}, removes: {} };
    for (const op of ops) {
        applyOperation(set, op);
    }
    return set;
}

/** Build per-element cells for one frame. */
function makeCells(
    elements: string[],
    setA: LWWSet,
    setB: LWWSet,
    merged: LWWSet | null,
    addWins: boolean,
): VisualEntity[] {
    return elements.map((element, index) => {
        const seenA = Boolean(setA.adds[element] || setA.removes[element]);
        const seenB = Boolean(setB.adds[element] || setB.removes[element]);
        let state: EntityState = "unvisited";
        if (merged) {
            state = lookup(merged, element, addWins) ? "sorted" : "error";
        } else if (seenA && seenB && lookup(setA, element, addWins) === lookup(setB, element, addWins)) {
            state = "path";
        } else if (seenA || seenB) {
            state = "comparing";
        }
        return {
            id: `element-${element}`,
            type: "cell" as const,
            label: `${element}: A${seenA ? (lookup(setA, element, addWins) ? "+" : "-") : "?"} B${seenB ? (lookup(setB, element, addWins) ? "+" : "-") : "?"}${merged ? ` M${lookup(merged, element, addWins) ? "+" : "-"}` : ""}`,
            value: element,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                row: 0,
                col: index,
                element,
                inA: seenA ? lookup(setA, element, addWins) : false,
                inB: seenB ? lookup(setB, element, addWins) : false,
                inMerged: merged ? lookup(merged, element, addWins) : false,
            },
        };
    });
}

/** The LWW-element-set generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { operations?: Operation[]; addWins?: boolean } | null) ?? {};
    const operations: Operation[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations
        : [
            { replica: 0, action: "add", element: "a", timestamp: 1 },
            { replica: 0, action: "add", element: "b", timestamp: 2 },
            { replica: 1, action: "add", element: "c", timestamp: 1 },
            { replica: 0, action: "remove", element: "a", timestamp: 3 },
            { replica: 1, action: "add", element: "a", timestamp: 4 },
        ];
    const addWins = task.addWins !== false;
    const elements = [...new Set(operations.map((op) => op.element))];
    const setA: LWWSet = { adds: {}, removes: {} };
    const setB: LWWSet = { adds: {}, removes: {} };

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeCells(elements, setA, setB, null, addWins),
        edges: [],
        description: `Two replicas start empty; ${operations.length} add/remove operations will be applied locally with ${addWins ? "add-wins" : "remove-wins"} tie breaking.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { cols: elements.length, rows: 1, addWins, phase: "init", operations: operations.length, finalSet: [] },
    };

    for (const op of operations) {
        applyOperation(op.replica === 0 ? setA : setB, op);
        yield {
            stepNumber: step++,
            entities: makeCells(elements, setA, setB, null, addWins),
            edges: [],
            description: `Replica ${op.replica} applies ${op.action}(${op.element}) at timestamp ${op.timestamp}; entry is ${op.action === "add" ? "added" : "removed"}.`,
            codeLineNumber: op.action === "add" ? 2 : 3,
            layout: "grid",
            meta: { cols: elements.length, rows: 1, addWins, phase: "apply", operation: `${op.action} ${op.element} @${op.timestamp} replica ${op.replica}`, finalSet: [] },
        };
    }

    const merged = mergeLWW(setA, setB, addWins);
    yield {
        stepNumber: step++,
        entities: makeCells(elements, setA, setB, merged, addWins),
        edges: [],
        description: `Merge by pointwise maximum of tags: the replicas and the merge now agree on every element.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { cols: elements.length, rows: 1, addWins, phase: "merge", operations: operations.length, finalSet: elements.filter((element) => lookup(merged, element, addWins)) },
    };

    const reversed = mergeLWW(setB, setA, addWins);
    yield {
        stepNumber: step,
        entities: makeCells(elements, setA, setB, reversed, addWins),
        edges: [],
        description: `Merging in the opposite order gives the identical set: ${elements.filter((element) => lookup(reversed, element, addWins)).join(", ") || "empty"}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            cols: elements.length,
            rows: 1,
            addWins,
            phase: "done",
            finalSet: elements.filter((element) => lookup(reversed, element, addWins)),
            converged: elements.every((element) => lookup(merged, element, addWins) === lookup(reversed, element, addWins)),
            note: "teaching model: logical timestamps, no tombstone collection",
        },
    };
}

/** The LWW-element-set module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every add and every remove a timestamp, and let the newest operation for an element decide whether it is in the set. Each replica keeps the highest-tagged add and remove it has seen. To synchronize, a replica takes the larger tag for each entry from its peer. Because taking a maximum is order-independent, replicas always settle on the same answer.",
        invariants: [
            "For each element only the highest-tagged add and the highest-tagged remove are retained.",
            "An element is present when its winning add is newer than its winning remove (ties favor adds here).",
            "Merge is a pointwise maximum, so it never loses information about a winning tag.",
        ],
        correctness:
            "Merge is pointwise maximum under the total order on tags (timestamp, then replica id), which is commutative, associative, and idempotent. Therefore replicas that receive the same set of operations reach the same tagged state regardless of delivery order or duplicate messages. Lookup is a deterministic function of that state, so all replicas observe the same membership. Ties are broken by replica id, so two concurrent operations at the same timestamp still resolve identically everywhere.",
        complexityRationale:
            "Merge iterates over the union of element keys from both sets and compares two tags per key, costing O(n + m) time. Each replica stores at most one add tag and one remove tag per element, so space is O(n).",
        uses: [
            "Replicated sets in eventually consistent databases such as Redis and Riak",
            "Shared shopping carts and collaborative tags that must merge offline edits",
            "Teaching the merge lattice behind conflict-free replicated data types",
        ],
        references: [
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Preguica et al., A Comprehensive Study of Convergent and Commutative Replicated Data Types, 2009",
        ],
        workedExample:
            "Replica 0 adds a at time 1 and removes a at time 3. Replica 1, unaware of that remove, adds a at time 4. On merge the winning add for a has timestamp 4 and the winning remove has timestamp 3, so a is present on both replicas; an add at time 2 would lose to the remove and leave a absent.",
    },
    id: "crdt-lww-set",
    name: "LWW-Element-Set CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(n + m)", space: "O(n)" },
    defaultInput: {
        operations: [
            { replica: 0, action: "add", element: "a", timestamp: 1 },
            { replica: 0, action: "add", element: "b", timestamp: 2 },
            { replica: 1, action: "add", element: "c", timestamp: 1 },
            { replica: 0, action: "remove", element: "a", timestamp: 3 },
            { replica: 1, action: "add", element: "a", timestamp: 4 },
        ],
        addWins: true,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty add and remove tag maps on each replica",
        "on add, store the tag if it beats the current add tag",
        "on remove, store the tag if it beats the current remove tag",
        "an element is present when its add tag beats its remove tag",
        "to merge, take the larger tag for every entry from both replicas",
        "apply the pointwise maximum to add and remove maps",
        "lookup the merged set on every replica",
        "confirm both merge orders produce the same set",
        "done: report the converged membership",
    ],
};

export default module;
