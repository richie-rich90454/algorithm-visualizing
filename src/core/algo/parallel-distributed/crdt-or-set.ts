/**
 * crdt-or-set.ts - OR-Set (Observed-Remove Set) CRDT
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An OR-set is a conflict-free replicated set that supports add and remove
 * without coordination. Every add of an element gets a unique tag. A remove
 * only tombstones the tags that the removing replica can currently see. A
 * concurrent add produces a fresh tag that the remove could not have observed,
 * so the element survives. Replicas converge by merging: union the add tags and
 * union the tombstones, then an element is present if any of its add tags is
 * not tombstoned. Merge is commutative, associative, and idempotent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t) per operation and O(T) per merge for t/T tags
 *   Space: O(T) for the add and tombstone tags in each replica
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid rows are elements; columns are replica A, replica B, and merged.
 *   - A green cell means present, red means absent (tombstoned or never added).
 *   - The final frame reports the converged element set and merge statistics.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Op {
    replica?: number;
    op?: "add" | "remove";
    value?: string;
}

interface OrSetInput {
    replicas?: number;
    ops?: Op[];
}

interface ReplicaState {
    adds: Map<string, Set<string>>;
    tombs: Map<string, Set<string>>;
    counter: number;
}

/** Create an empty replica state. */
function emptyState(): ReplicaState {
    return { adds: new Map(), tombs: new Map(), counter: 0 };
}

/** Clone a replica state so frames never alias live state. */
function cloneState(s: ReplicaState): ReplicaState {
    const adds = new Map<string, Set<string>>();
    const tombs = new Map<string, Set<string>>();
    for (const [k, v] of s.adds) adds.set(k, new Set(v));
    for (const [k, v] of s.tombs) tombs.set(k, new Set(v));
    return { adds, tombs, counter: s.counter };
}

/** Merge states by unioning add tags and tombstone tags. */
function merge(a: ReplicaState, b: ReplicaState): ReplicaState {
    const result = emptyState();
    const values = new Set([...a.adds.keys(), ...b.adds.keys(), ...a.tombs.keys(), ...b.tombs.keys()]);
    for (const value of values) {
        result.adds.set(value, new Set([...(a.adds.get(value) ?? []), ...(b.adds.get(value) ?? [])]));
        result.tombs.set(value, new Set([...(a.tombs.get(value) ?? []), ...(b.tombs.get(value) ?? [])]));
    }
    result.counter = Math.max(a.counter, b.counter);
    return result;
}

/** True when an element is present: some add tag is not tombstoned. */
function visible(s: ReplicaState, value: string): boolean {
    const adds = s.adds.get(value) ?? new Set<string>();
    const tombs = s.tombs.get(value) ?? new Set<string>();
    for (const tag of adds) {
        if (!tombs.has(tag)) {
            return true;
        }
    }
    return false;
}

/** List all values that ever appeared, in operation order. */
function allValues(ops: Op[]): string[] {
    const values: string[] = [];
    for (const op of ops) {
        const value = op.value ?? "x";
        if (!values.includes(value)) {
            values.push(value);
        }
    }
    return values;
}

/** Build a present/absent grid for three views. */
function makeCells(values: string[], views: ReplicaState[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const names = ["replica A", "replica B", "merged"];
    for (let c = 0; c < views.length; c += 1) {
        for (let r = 0; r < values.length; r += 1) {
            const present = visible(views[c]!, values[r]!);
            entities.push({
                id: `cell-${c}-${r}`,
                type: "cell",
                label: `${values[r]}: ${present ? "present" : "absent"}`,
                value: present ? 1 : 0,
                state: present ? "sorted" : "error",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, view: names[c] ?? String(c), element: values[r]!, present },
            });
        }
    }
    return entities;
}

/** The OR-set generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OrSetInput | null) ?? {};
    const defaultOps: Op[] = [
        { replica: 0, op: "add", value: "a" },
        { replica: 0, op: "add", value: "b" },
        { replica: 1, op: "add", value: "b" },
        { replica: 0, op: "remove", value: "b" },
        { replica: 1, op: "add", value: "b" },
        { replica: 1, op: "remove", value: "a" },
    ];
    const ops: Op[] = Array.isArray(task.ops) && task.ops.length > 0 ? task.ops : defaultOps;
    const replicaCount = 2;
    const states: ReplicaState[] = Array.from({ length: replicaCount }, () => emptyState());
    const values = allValues(ops);
    let step = 0;

    const makeMeta = (converged: boolean, description: string) => {
        const merged = merge(states[0]!, states[1]!);
        return {
            ops: ops.length,
            cols: 3,
            rows: values.length,
            converged,
            elements: values.filter((v) => visible(merged, v)),
            addTags: states.reduce((s, st) => s + [...st.adds.values()].reduce((t, x) => t + x.size, 0), 0),
            tombstones: states.reduce((s, st) => s + [...st.tombs.values()].reduce((t, x) => t + x.size, 0), 0),
            last: description,
        };
    };

    yield {
        stepNumber: step++,
        entities: makeCells(values, [emptyState(), emptyState(), emptyState()]),
        edges: [],
        description: `OR-set with ${replicaCount} replicas tracking ${values.length} element(s) through add and remove operations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: makeMeta(false, "initialized"),
    };

    for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i]!;
        const r = Math.max(0, Math.min(replicaCount - 1, Math.floor(op.replica ?? 0)));
        const value = op.value ?? "x";
        const st = states[r]!;
        let description: string;
        if (op.op === "remove") {
            const observed = new Set([...(st.adds.get(value) ?? []).values()].filter((tag) => !(st.tombs.get(value) ?? new Set()).has(tag)));
            if (!st.tombs.has(value)) st.tombs.set(value, new Set());
            for (const tag of observed) st.tombs.get(value)!.add(tag);
            description = `Replica ${r} removes "${value}" by tombstoning the ${observed.size} tag(s) it can see.`;
        } else {
            st.counter += 1;
            const tag = `r${r}c${st.counter}`;
            if (!st.adds.has(value)) st.adds.set(value, new Set());
            st.adds.get(value)!.add(tag);
            description = `Replica ${r} adds "${value}" with fresh tag ${tag}.`;
        }
        const merged = merge(states[0]!, states[1]!);
        yield {
            stepNumber: step++,
            entities: makeCells(values, [states[0]!, states[1]!, merged]),
            edges: [],
            description,
            codeLineNumber: op.op === "remove" ? 3 : 2,
            layout: "grid",
            meta: makeMeta(false, description),
        };
    }

    const finalMerge = merge(states[0]!, states[1]!);
    states[0] = cloneState(finalMerge);
    states[1] = cloneState(finalMerge);
    const finalElements = values.filter((v) => visible(finalMerge, v));
    const doneDescription = `After merging both replicas, the converged set is {${finalElements.join(", ") || "empty"}}.`;
    yield {
        stepNumber: step,
        entities: makeCells(values, [states[0]!, states[1]!, finalMerge]),
        edges: [],
        description: doneDescription,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...makeMeta(true, doneDescription), elements: finalElements },
    };
}

/** The OR-set CRDT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An OR-set gives every add a unique receipt. Removing an element only voids the receipts you can actually see, so a friend who adds the same element at the same moment creates a new receipt your remove could not know about. That concurrent add survives. When replicas sync, they simply pool all receipts and all voids, and an element is present if it has at least one receipt that was not voided.",
        invariants: [
            "Each add tag is unique across all replicas and operations.",
            "A remove tombstones only tags that were visible at the removing replica.",
            "An element is present exactly when it has an untombstoned add tag.",
        ],
        correctness:
            "Merge unions the add-tag sets and tombstone sets, so it is commutative, associative, and idempotent; any two replicas that have seen the same operations converge to identical state. A remove cannot erase a concurrent add because that add's tag was created after the remove observed the element and therefore was never tombstoned. An element reappears only through a genuine new add, which is the observed-remove semantics. Hence the set reflects exactly the adds not destroyed by a causally later remove.",
        complexityRationale:
            "An add writes one tag in constant time; a remove scans the element's tags, O(t) for t tags on that element. Merging unions sets from both replicas, O(T) over all tags, and each replica stores one add and one tombstone set, O(T) space.",
        uses: [
            "Collaborative tags and shared shopping lists in local-first apps",
            "Replicated metadata in distributed databases and CRDT libraries",
            "Conflict-free sets in peer-to-peer and offline-first systems",
        ],
        references: [
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Preguica et al., A Comprehensive Study of Convergent and Commutative Replicated Data Types, 2011",
        ],
        workedExample:
            "Replica A adds b with tag r0c2. Replica B independently adds b with tag r1c1. A now removes b, tombstoning only r0c2. After merging, b still has the untombstoned tag r1c1, so b remains in the set. A later add of b on A would create yet another fresh tag.",
    },
    id: "crdt-or-set",
    name: "OR-Set (Observed-Remove Set CRDT)",
    category: "parallel-distributed",
    complexity: { time: "O(T)", space: "O(T)" },
    defaultInput: {
        replicas: 2,
        ops: [
            { replica: 0, op: "add", value: "a" },
            { replica: 0, op: "add", value: "b" },
            { replica: 1, op: "add", value: "b" },
            { replica: 0, op: "remove", value: "b" },
            { replica: 1, op: "add", value: "b" },
            { replica: 1, op: "remove", value: "a" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start each replica with empty add and tombstone sets",
        "on add create a fresh unique tag and record it",
        "on remove tombstone every visible tag of the element",
        "a concurrent add keeps its own unseen fresh tag",
        "to merge union all add tags and all tombstone tags",
        "an element is present if any tag is not tombstoned",
        "repeat merge until replicas hold identical state",
        "done: report the converged set of elements",
    ],
};

export default module;
