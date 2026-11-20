/**
 * two-phase-locking.ts - Two-Phase Locking with Deadlock Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two-phase locking requires a transaction to acquire all shared and exclusive
 * locks in a growing phase and release them only in a shrinking phase, never
 * acquiring again afterward. Shared locks coexist, exclusive locks are solo.
 * A blocked request adds a wait-for edge; a cycle is a deadlock, resolved by
 * aborting the highest-numbered transaction in the cycle and releasing its
 * locks. The granted schedule is checked for conflict serializability.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(O * K) for lock checks plus O(K * E) for cycle detection
 *   Space: O(K * T + E) for the lock table and wait-for graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are keys and columns are transactions.
 *   - A cell shows S, X, W for waiting, or a dot for no lock.
 *   - Granted locks are green, waiting requests yellow, aborted rows red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "S" | "X" | "U";

interface LockOp {
    tx: number;
    key: string;
    mode: Mode;
}

interface TwoPLInput {
    operations?: LockOp[];
}

function makeCells(
    keys: string[],
    txs: number[],
    locks: Map<string, Map<number, Mode>>,
    pending: LockOp[],
    aborted: Set<number>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    keys.forEach((key, row) => {
        txs.forEach((tx, col) => {
            const held = locks.get(key)?.get(tx);
            const waiting = pending.some((op) => op.key === key && op.tx === tx);
            let label = ".";
            let state: EntityState = "idle";
            if (aborted.has(tx)) {
                label = "!";
                state = "error";
            } else if (held) {
                label = held;
                state = "sorted";
            } else if (waiting) {
                label = "W";
                state = "comparing";
            }
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label,
                value: label === "." ? 0 : 1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, key, tx, mode: label },
            });
        });
    });
    return entities;
}

/** Find a cycle in the wait-for graph, returning its nodes in order. */
function findCycle(edges: Map<number, Set<number>>, nodes: number[]): number[] | null {
    const color = new Map<number, number>();
    const stack: number[] = [];
    const visit = (node: number): number[] | null => {
        color.set(node, 1);
        stack.push(node);
        for (const next of edges.get(node) ?? []) {
            if (color.get(next) === 1) {
                const start = stack.indexOf(next);
                return stack.slice(start >= 0 ? start : 0);
            }
            if (!color.has(next)) {
                const found = visit(next);
                if (found) return found;
            }
        }
        stack.pop();
        color.set(node, 2);
        return null;
    };
    for (const node of nodes) {
        if (!color.has(node)) {
            const found = visit(node);
            if (found) return found;
        }
    }
    return null;
}

/** Kahn acyclicity test on a list of directed edges. */
function isAcyclic(nodes: number[], edges: Array<[number, number]>): boolean {
    const indegree = new Map<number, number>(nodes.map((node) => [node, 0]));
    const adjacency = new Map<number, number[]>(nodes.map((node) => [node, []]));
    for (const [from, to] of edges) {
        if (!indegree.has(to) || !adjacency.has(from)) continue;
        indegree.set(to, (indegree.get(to) ?? 0) + 1);
        (adjacency.get(from) ?? []).push(to);
    }
    const queue = nodes.filter((node) => (indegree.get(node) ?? 0) === 0);
    let removed = 0;
    while (queue.length > 0) {
        const node = queue.shift() as number;
        removed += 1;
        for (const next of adjacency.get(node) ?? []) {
            const degree = (indegree.get(next) ?? 0) - 1;
            indegree.set(next, degree);
            if (degree === 0) queue.push(next);
        }
    }
    return removed === nodes.length;
}

/** The two-phase locking generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TwoPLInput | null) ?? {};
    const operations: LockOp[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations
            .filter((op) => op && typeof op.key === "string" && typeof op.tx === "number")
            .map((op) => ({ tx: op.tx, key: op.key, mode: op.mode === "U" || op.mode === "X" ? op.mode : "S" }))
        : [
            { tx: 1, key: "A", mode: "X" },
            { tx: 2, key: "B", mode: "X" },
            { tx: 2, key: "A", mode: "X" },
            { tx: 1, key: "B", mode: "X" },
            { tx: 1, key: "A", mode: "U" },
            { tx: 2, key: "B", mode: "U" },
        ];

    const keys: string[] = [];
    const txs: number[] = [];
    for (const op of operations) {
        if (!keys.includes(op.key)) keys.push(op.key);
        if (!txs.includes(op.tx)) txs.push(op.tx);
    }
    txs.sort((a, b) => a - b);

    const locks = new Map<string, Map<number, Mode>>();
    const pending: LockOp[] = [];
    const aborted = new Set<number>();
    const released = new Set<number>();
    const granted: LockOp[] = [];
    const events: string[] = [];
    let violations = 0;

    const holders = (key: string): Array<[number, Mode]> => Array.from(locks.get(key)?.entries() ?? []);
    const compatible = (key: string, tx: number, mode: Mode): boolean => {
        const others = holders(key).filter(([holder]) => holder !== tx);
        if (mode === "S" || mode === "U") return others.every(([, held]) => held === "S");
        return others.length === 0;
    };
    const grant = (op: LockOp): void => {
        const table = locks.get(op.key) ?? new Map<number, Mode>();
        table.set(op.tx, op.mode === "X" ? "X" : "S");
        locks.set(op.key, table);
        granted.push(op);
        events.push(`grant:${op.tx}:${op.mode}:${op.key}`);
    };
    const waitEdges = (): Map<number, Set<number>> => {
        const graph = new Map<number, Set<number>>();
        for (const op of pending) {
            const targets = graph.get(op.tx) ?? new Set<number>();
            for (const [holder, held] of holders(op.key)) {
                if (holder === op.tx) continue;
                if (op.mode === "X" || held === "X") targets.add(holder);
            }
            if (targets.size > 0) graph.set(op.tx, targets);
        }
        return graph;
    };
    const tryPending = (): void => {
        let progress = true;
        while (progress) {
            progress = false;
            for (let i = 0; i < pending.length; i += 1) {
                const op = pending[i] as LockOp;
                if (aborted.has(op.tx) || released.has(op.tx) || !compatible(op.key, op.tx, op.mode)) continue;
                grant(op);
                pending.splice(i, 1);
                progress = true;
                break;
            }
        }
    };

    const snapshot = (): { waits: string[]; cells: string[] } => ({
        waits: pending.map((op) => `t${op.tx}:${op.mode}:${op.key}`),
        cells: keys.flatMap((key) => txs.map((tx) => {
            const held = locks.get(key)?.get(tx);
            if (aborted.has(tx)) return "!";
            if (held) return held;
            if (pending.some((op) => op.key === key && op.tx === tx)) return "W";
            return ".";
        })),
    });

    const start = snapshot();
    yield {
        stepNumber: 0,
        entities: makeCells(keys, txs, locks, pending, aborted),
        edges: [],
        description: `Two-phase locking over ${txs.length} transaction(s) and ${keys.length} key(s); all locks are free.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { keys, txs, cells: start.cells, waits: start.waits, aborts: 0, violations: 0, events: [...events], grantedOps: [], serializable: true, complete: false },
    };
    let step = 1;

    for (const op of operations) {
        if (aborted.has(op.tx)) {
            events.push(`skip:${op.tx}`);
        } else if (op.mode === "U") {
            const table = locks.get(op.key);
            table?.delete(op.tx);
            released.add(op.tx);
            events.push(`release:${op.tx}:${op.key}`);
            tryPending();
        } else if (released.has(op.tx)) {
            violations += 1;
            events.push(`violation:${op.tx}`);
        } else if (compatible(op.key, op.tx, op.mode)) {
            grant(op);
            tryPending();
        } else {
            pending.push(op);
            events.push(`wait:${op.tx}:${op.key}`);
            const cycle = findCycle(waitEdges(), txs);
            if (cycle && cycle.length > 0) {
                const victim = Math.max(...cycle);
                aborted.add(victim);
                for (const [key, table] of locks) table.delete(victim);
                for (let i = pending.length - 1; i >= 0; i -= 1) {
                    if ((pending[i] as LockOp).tx === victim) pending.splice(i, 1);
                }
                events.push(`abort:${victim}`);
                tryPending();
            }
        }
        const current = snapshot();
        yield {
            stepNumber: step,
            entities: makeCells(keys, txs, locks, pending, aborted),
            edges: [],
            description: `Operation t${op.tx} ${op.mode === "U" ? "unlocks" : `${op.mode}-locks`} ${op.key}; ${pending.length} waiting, ${aborted.size} aborted, ${violations} phase violation(s).`,
            codeLineNumber: op.mode === "U" ? 4 : 2,
            layout: "grid",
            meta: { keys, txs, cells: current.cells, waits: current.waits, aborts: aborted.size, violations, events: [...events], grantedOps: granted.map((g) => `${g.tx}:${g.mode}:${g.key}`), serializable: true, complete: false },
        };
        step += 1;
    }

    for (const [key, table] of locks) {
        for (const tx of Array.from(table.keys())) {
            table.delete(tx);
            events.push(`commit:${tx}:${key}`);
        }
    }

    const precedence: Array<[number, number]> = [];
    for (let i = 0; i < granted.length; i += 1) {
        for (let j = i + 1; j < granted.length; j += 1) {
            const left = granted[i] as LockOp;
            const right = granted[j] as LockOp;
            if (left.key !== right.key || left.tx === right.tx) continue;
            if (left.mode === "X" || right.mode === "X") precedence.push([left.tx, right.tx]);
        }
    }
    const serializable = isAcyclic(txs, precedence);
    const current = snapshot();
    yield {
        stepNumber: step,
        entities: makeCells(keys, txs, locks, pending, aborted),
        edges: [],
        description: `Two-phase locking finished: ${aborted.size} abort(s), ${violations} phase violation(s), schedule ${serializable ? "conflict serializable" : "not serializable"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { keys, txs, cells: current.cells, waits: current.waits, aborts: aborted.size, violations, events: [...events], grantedOps: granted.map((g) => `${g.tx}:${g.mode}:${g.key}`), precedenceEdges: precedence.map(([from, to]) => `${from}->${to}`), serializable, complete: true },
    };
}

/** The two-phase locking module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A transaction first collects every lock it needs and only then starts letting them go. While it grows it may acquire shared or exclusive locks, but after its first release it can never acquire another. If two transactions each hold a lock the other wants, a wait-for cycle appears and one must be aborted.",
        invariants: [
            "Shared locks on a key coexist, but an exclusive lock excludes every other holder.",
            "After a transaction releases any lock it acquires no new ones.",
            "Every wait-for edge points from a waiting transaction to a current holder.",
            "Aborting a transaction releases all of its locks and removes its pending requests.",
        ],
        correctness:
            "The growing and shrinking phases cannot interleave, so a committed transaction's locked accesses are atomic with respect to conflicting transactions. The wait-for graph captures exactly which holders block which waiters, and a directed cycle means none of those transactions can proceed, which is a deadlock. Aborting one member of the cycle releases its locks and breaks the cycle. Conflict serializability follows because two-phase locking forces a single lock point ordering, which the precedence graph test confirms.",
        complexityRationale:
            "Each operation checks all current holders of one key, O(K) work, and cycle detection scans the wait-for graph with O(K times E) edges in the worst case. The lock table holds at most one entry per key and transaction, O(K times T), plus the pending requests.",
        uses: [
            "Lock managers in traditional relational databases",
            "Serializable transaction scheduling in storage engines",
            "Teaching deadlock detection and conflict serializability",
        ],
        references: [
            "Eswaran, Gray, Lorie, and Traiger, The Notions of Consistency and Predicate Locks, 1976",
            "Bernstein, Hadzilacos, and Goodman, Concurrency Control and Recovery in Database Systems, Chapter 3",
        ],
        workedExample:
            "Transaction 1 locks A exclusively and transaction 2 locks B exclusively. Transaction 2 then waits for A and transaction 1 waits for B, forming a two-node cycle. Aborting transaction 2 releases B, which lets transaction 1 proceed; the remaining schedule has an acyclic precedence graph and is serializable.",
    },
    id: "two-phase-locking",
    name: "Two-Phase Locking",
    category: "production-systems",
    complexity: { time: "O(O * K + K * E)", space: "O(K * T + E)" },
    defaultInput: {
        operations: [
            { tx: 1, key: "A", mode: "X" },
            { tx: 2, key: "B", mode: "X" },
            { tx: 2, key: "A", mode: "X" },
            { tx: 1, key: "B", mode: "X" },
            { tx: 1, key: "A", mode: "U" },
            { tx: 2, key: "B", mode: "U" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with no locks and an empty wait-for graph",
        "for each operation of a transaction",
        "shared and exclusive requests are granted only when compatible",
        "an incompatible request waits and adds a wait-for edge",
        "a release moves the transaction into the shrinking phase",
        "on a cycle abort the highest-numbered member and release its locks",
        "after all operations build the precedence graph and test for cycles",
        "done: report aborts, violations, and serializability",
    ],
};

export default module;
