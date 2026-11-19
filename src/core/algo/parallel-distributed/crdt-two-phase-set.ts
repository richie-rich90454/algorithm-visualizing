/**
 * crdt-two-phase-set.ts - Two-Phase Set (2P-Set) CRDT
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A two-phase set is the simplest convergent replicated set. Each replica keeps
 * an add set and a remove set. An add only records an element that has never
 * been removed; a remove moves an element from the add set into the remove set.
 * Merge unions both sets and then drops from the add set anything that appears
 * in the remove set, so a removal always wins over a concurrent add. Because an
 * element can never be re-added after removal, the two phases are add-then-remove.
 * Merge is commutative, associative, and idempotent, so replicas converge.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per add or remove, O(E) per merge for E elements
 *   Space: O(E) for the two sets in each replica
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are elements; columns are replica A, replica B, and merged.
 *   - GREEN means present, RED means removed, gray means never added.
 *   - The final frame reports the converged set and merge statistics.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Op {
    replica?: number;
    op?: "add" | "remove";
    value?: string;
}

interface Input {
    replicas?: number;
    ops?: Op[];
}

interface State {
    adds: Set<string>;
    removes: Set<string>;
}

const emptyState = (): State => ({ adds: new Set(), removes: new Set() });
const cloneState = (s: State): State => ({ adds: new Set(s.adds), removes: new Set(s.removes) });

/** Merge by unioning both sets, then enforcing add/remove disjointness. */
function merge(a: State, b: State): State {
    const out = emptyState();
    for (const v of a.adds) out.adds.add(v);
    for (const v of b.adds) out.adds.add(v);
    for (const v of a.removes) out.removes.add(v);
    for (const v of b.removes) out.removes.add(v);
    for (const v of out.removes) out.adds.delete(v);
    return out;
}

/** Apply one operation to a replica (remove wins; no re-add after remove). */
function applyOp(st: State, op: Op): void {
    const value = op.value ?? "x";
    if (op.op === "remove") {
        st.removes.add(value);
        st.adds.delete(value);
    } else if (!st.removes.has(value)) {
        st.adds.add(value);
    }
}

const visible = (st: State, v: string): boolean => st.adds.has(v);

const defaultOps: Op[] = [
    { replica: 0, op: "add", value: "a" },
    { replica: 0, op: "add", value: "b" },
    { replica: 1, op: "add", value: "c" },
    { replica: 1, op: "remove", value: "a" },
    { replica: 0, op: "add", value: "a" },
    { replica: 0, op: "remove", value: "b" },
];

function allValues(ops: Op[]): string[] {
    const values: string[] = [];
    for (const op of ops) {
        const v = op.value ?? "x";
        if (!values.includes(v)) values.push(v);
    }
    return values;
}

function makeCells(values: string[], views: State[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const names = ["replica A", "replica B", "merged"];
    for (let c = 0; c < views.length; c += 1) {
        for (let r = 0; r < values.length; r += 1) {
            const st = views[c]!;
            const v = values[r]!;
            const present = visible(st, v);
            const removed = st.removes.has(v);
            const status = present ? "present" : removed ? "removed" : "never added";
            const state: EntityState = present ? "sorted" : removed ? "error" : "unvisited";
            entities.push({
                id: `cell-${c}-${r}`,
                type: "cell",
                label: `${v}: ${status}`,
                value: present ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, view: names[c] ?? String(c), element: v, present, removed },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const ops: Op[] = Array.isArray(task.ops) && task.ops.length > 0 ? task.ops : defaultOps;
    const states: State[] = [emptyState(), emptyState()];
    const values = allValues(ops);
    let step = 0;

    const makeMeta = (converged: boolean, last: string) => {
        const merged = merge(states[0]!, states[1]!);
        return {
            ops: ops.length,
            cols: 3,
            rows: values.length,
            converged,
            elements: values.filter((v) => visible(merged, v)),
            adds: merged.adds.size,
            removes: merged.removes.size,
            last,
        };
    };

    yield {
        stepNumber: step++,
        entities: makeCells(values, [emptyState(), emptyState(), emptyState()]),
        edges: [],
        description: `Two-phase set with two replicas tracking ${values.length} element(s) through add and remove operations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: makeMeta(false, "initialized"),
    };

    for (const op of ops) {
        const r = Math.max(0, Math.min(1, Math.floor(op.replica ?? 0)));
        applyOp(states[r]!, op);
        const value = op.value ?? "x";
        const description = op.op === "remove"
            ? `Replica ${r} removes "${value}" by moving it into the remove set.`
            : `Replica ${r} adds "${value}" (ignored if it was ever removed).`;
        yield {
            stepNumber: step++,
            entities: makeCells(values, [states[0]!, states[1]!, merge(states[0]!, states[1]!)]),
            edges: [],
            description,
            codeLineNumber: op.op === "remove" ? 2 : 1,
            layout: "grid",
            meta: makeMeta(false, description),
        };
    }

    const finalMerge = merge(states[0]!, states[1]!);
    states[0] = cloneState(finalMerge);
    states[1] = cloneState(finalMerge);
    const finalElements = values.filter((v) => visible(finalMerge, v));
    const done = `After merging, the converged set is {${finalElements.join(", ") || "empty"}}; removals win concurrency.`;
    yield {
        stepNumber: step,
        entities: makeCells(values, [states[0]!, states[1]!, finalMerge]),
        edges: [],
        description: done,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...makeMeta(true, done), elements: finalElements },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A two-phase set lets replicas add and remove without talking. It keeps two lists: things added and things removed. Once something lands in the removed list it can never come back, so a remove that happens at the same time as an add always wins. Syncing is just pooling the two lists, which makes every replica agree.",
        invariants: [
            "The add set and remove set are always disjoint.",
            "An element is present exactly when it belongs to the add set.",
            "An element removed once can never be added again at any replica.",
        ],
        correctness:
            "Merge unions the two add sets and the two remove sets, then subtracts removals from additions. Union and subtraction are commutative, associative, and idempotent, so any replicas that have seen the same operations reach identical state and the set converges. A remove moves an element into the remove set; even if another replica adds it concurrently, merge subtracts it because it appears in the union of remove sets. Since adds check the remove set, a removed element is never re-added locally, giving the two-phase guarantee.",
        complexityRationale:
            "An add or remove is a constant-time set insertion or deletion. A merge unions two sets of at most E elements and deletes the removed ones, costing O(E). Each replica stores two sets over E elements, so space is O(E).",
        uses: [
            "Immutable tag sets and denylists in replicated configuration stores",
            "Permission revocation lists in offline-first applications",
            "A teaching baseline for understanding CRDT convergence and remove-wins semantics",
        ],
        references: [
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
            "Preguica et al., A Comprehensive Study of Convergent and Commutative Replicated Data Types, 2011",
        ],
        workedExample:
            "Replica A adds a and b; replica B adds c then removes a. A concurrently tries to add a again but a is already in its remove set after merge, so the add is ignored. Merging yields adds {b, c} and removes {a}, so the converged set is {b, c}.",
    },
    id: "crdt-two-phase-set",
    name: "Two-Phase Set (2P-Set CRDT)",
    category: "parallel-distributed",
    complexity: { time: "O(E)", space: "O(E)" },
    defaultInput: { replicas: 2, ops: defaultOps },
    visualType: "grid",
    run,
    pseudocode: [
        "start each replica with empty add and remove sets",
        "on add, record the element only if it was never removed",
        "on remove, move the element from adds into removes",
        "an element is present exactly when it is in adds",
        "to merge, union the add sets and union the remove sets",
        "drop from adds any element present in removes",
        "repeat merge until all replicas agree",
        "done: report the converged set of elements",
    ],
};

export default module;
