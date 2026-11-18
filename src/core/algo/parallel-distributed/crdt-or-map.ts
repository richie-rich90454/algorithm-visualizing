/**
 * crdt-or-map.ts - OR-Map CRDT (Observed-Remove Map)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An OR-map is a conflict-free replicated map: each entry carries a unique
 * add tag and a remove set. Removing a key marks the tags observed at that
 * replica as removed. Merging two replicas unions the adds and the removes,
 * so a tag added concurrently with a remove survives. The visible value of a
 * key is the greatest surviving tag's value.
 *
 * This teaching model implements the exact observed-remove merge rules with
 * explicit tags. It does not compact tombstones or manage causal contexts,
 * so it illustrates the semantics rather than a production CRDT library.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(o + t) for o operations and t total tags
 *   Space: O(t) for the add tags and remove set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row of cells shows each key with its current visible value.
 *   - A key with a surviving value is green; an empty key is gray.
 *   - meta carries the merged add and remove sets per key.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Op {
    type: "add" | "remove";
    key: string;
    value?: string;
    tag?: string;
}

interface KeyState {
    adds: Map<string, string>;
    removes: Set<string>;
}

type Replica = Map<string, KeyState>;

/** An empty replica. */
function newReplica(): Replica {
    return new Map<string, KeyState>();
}

/** Get (or create) the state for a key in a replica. */
function keyState(replica: Replica, key: string): KeyState {
    let state = replica.get(key);
    if (!state) {
        state = { adds: new Map<string, string>(), removes: new Set<string>() };
        replica.set(key, state);
    }
    return state;
}

/** Apply one operation to a replica using the given default tag. */
function applyOp(replica: Replica, op: Op, defaultTag: string): void {
    const state = keyState(replica, op.key);
    if (op.type === "remove") {
        for (const tag of state.adds.keys()) {
            state.removes.add(tag);
        }
    } else {
        const tag = typeof op.tag === "string" ? op.tag : defaultTag;
        state.adds.set(tag, typeof op.value === "string" ? op.value : tag);
    }
}

/** Merge two replicas by unioning adds and removes per key. */
function merge(a: Replica, b: Replica): Replica {
    const result = newReplica();
    const keys = new Set<string>([...a.keys(), ...b.keys()]);
    for (const key of keys) {
        const state = keyState(result, key);
        const sources = [a.get(key), b.get(key)];
        for (const source of sources) {
            if (!source) {
                continue;
            }
            for (const [tag, value] of source.adds) {
                state.adds.set(tag, value);
            }
            for (const tag of source.removes) {
                state.removes.add(tag);
            }
        }
    }
    return result;
}

/** The visible value of a key is the greatest surviving tag's value. */
function visible(replica: Replica, key: string): string | null {
    const state = replica.get(key);
    if (!state) {
        return null;
    }
    let bestTag: string | null = null;
    let bestValue: string | null = null;
    for (const [tag, value] of state.adds) {
        if (state.removes.has(tag)) {
            continue;
        }
        if (bestTag === null || tag > bestTag) {
            bestTag = tag;
            bestValue = value;
        }
    }
    return bestValue;
}

/** Snapshot the visible values of every key. */
function snapshot(replica: Replica, keys: string[]): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const key of keys) {
        out[key] = visible(replica, key);
    }
    return out;
}

/** Build the key cells for a frame. */
function makeCells(keys: string[], snap: Record<string, string | null>): VisualEntity[] {
    return keys.map((key, index) => {
        const value = snap[key] ?? null;
        return {
            id: `key-${index}`,
            type: "cell" as const,
            label: value === null ? key : `${key}=${value}`,
            value: value ?? "",
            state: (value === null ? "unvisited" : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, key, visible: value ?? "" },
        };
    });
}

/** Stringify a snapshot into meta-friendly sorted pairs. */
function pairs(keys: string[], snap: Record<string, string | null>): string[] {
    return keys.map((key) => `${key}:${snap[key] ?? "-"}`);
}

/** The OR-map CRDT generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { opsA?: Op[]; opsB?: Op[]; keys?: string[] } | null
    ) ?? {};
    const opsA: Op[] = Array.isArray(task.opsA) ? task.opsA : [];
    const opsB: Op[] = Array.isArray(task.opsB) ? task.opsB : [];
    const keys: string[] = Array.isArray(task.keys) && task.keys.length > 0
        ? task.keys.map(String)
        : ["color", "size"];

    const a = newReplica();
    const b = newReplica();
    let step = 0;

    const emit = (snap: Record<string, string | null>, description: string, line: number) => {
        const result: VisualFrame = {
            stepNumber: step,
            entities: makeCells(keys, snap),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                rows: 1,
                cols: keys.length,
                visible: pairs(keys, snap),
                visibleJson: JSON.stringify(snap),
            },
        };
        step += 1;
        return result;
    };

    yield emit(snapshot(a, keys), "Two replicas start empty. Adds get unique tags and removes mark observed tags as deleted.", 0);

    for (let i = 0; i < opsA.length; i += 1) {
        const op = opsA[i];
        if (!op) {
            continue;
        }
        applyOp(a, op, `A${i}`);
        yield emit(snapshot(a, keys), `Replica A: ${op.type} on ${op.key} (tag A${i}). Replica B is unchanged.`, 2);
    }
    for (let i = 0; i < opsB.length; i += 1) {
        const op = opsB[i];
        if (!op) {
            continue;
        }
        applyOp(b, op, `B${i}`);
        yield emit(snapshot(b, keys), `Replica B: ${op.type} on ${op.key} (tag B${i}). Replica A is unchanged.`, 3);
    }

    const merged = merge(a, b);
    const snap = snapshot(merged, keys);
    yield emit(snap, "Merged replicas: adds and removes are unioned, so a concurrent add survives a remove (add wins).", 5);
    yield emit(snap, "Final view is the same on both replicas because the merge is commutative and idempotent.", 6);
}

/** The OR-map CRDT teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Each entry in an OR-map is stamped with a unique tag when added. A delete only marks the tags the deleting replica has seen. When replicas merge, they union adds and deletes, so an add made concurrently with a delete is not erased. This 'add wins' behavior is what makes the map converge without coordination.",
        invariants: [
            "Every add creates a unique tag that identifies one entry.",
            "A remove only marks tags already observed at the removing replica.",
            "Merge unions add tags and remove tags, so it is commutative, associative, and idempotent.",
        ],
        correctness:
            "Because every replica keeps the same set of tags and merge is set union, applying merges in any order and any number of times yields the identical state. A tag that is concurrently added at one replica and removed at another is in the add set but not the remove set, so it survives; this is the observed-remove add-wins rule. The visible value is a deterministic function of the surviving tags, so all replicas display the same value after merging.",
        complexityRationale:
            "Applying o operations touches one key's tag sets in O(1) each except a remove scanning the observed tags, and merging scans all t tags once, giving O(o + t) time. The add tags and remove set use O(t) space.",
        uses: [
            "A teaching model for observed-remove map CRDTs",
            "Explaining add-wins conflict resolution in collaborative editors",
            "Understanding convergence in eventually consistent key-value stores",
        ],
        references: [
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Preguica, Baquero, and Shapiro, A Comprehensive Study of Convergent and Commutative Replicated Data Types, 2010",
        ],
        workedExample:
            "Replica A adds color=red with tag A0. Replica B removes color before seeing A0, marking only its own tags. After merge, A0 is not in the remove set, so color remains red on both replicas: the concurrent add wins.",
    },
    id: "crdt-or-map",
    name: "OR-Map CRDT (Observed-Remove Map)",
    category: "parallel-distributed",
    complexity: { time: "O(o + t)", space: "O(t)" },
    defaultInput: {
        keys: ["color", "size"],
        opsA: [
            { type: "add", key: "color", value: "red", tag: "A0" },
            { type: "add", key: "size", value: "10", tag: "A1" },
        ],
        opsB: [
            { type: "remove", key: "color" },
            { type: "add", key: "size", value: "20", tag: "B1" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start two empty replicas of tag sets and remove sets",
        "on add create a unique tag and record its value",
        "on remove mark all observed tags of that key as removed",
        "merge by unioning add tags and remove tags per key",
        "discard tags that appear in the remove set",
        "choose the greatest surviving tag value as visible",
        "done: both replicas show the same converged values",
    ],
};

export default module;
