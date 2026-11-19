/**
 * serializable-snapshot-isolation.ts - Serializable Snapshot Isolation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Serializable snapshot isolation (SSI) strengthens snapshot isolation by
 * watching anti-dependency (read-write) edges between concurrent transactions.
 * Two consecutive anti-dependencies with concurrent end points form a dangerous
 * structure that can produce a write-skew anomaly even though every individual
 * write passed the first-committer-wins check. SSI detects cycles formed by
 * these anti-dependencies and aborts the youngest transaction in each cycle,
 * repeating until the remaining graph is acyclic and therefore serializable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T^3 * K) for T transactions with K read/write keys in the worst case
 *   Space: O(T^2 + T * K) for the conflict graph and transaction sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One node per transaction; directed edges are anti-dependencies.
 *   - An aborted transaction turns red and disappears from later graphs.
 *   - meta carries the edge list, aborted ids, and serializability verdict.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Transaction {
    id: string;
    start: number;
    commit: number;
    reads: string[];
    writes: string[];
}

interface Input {
    transactions?: Transaction[];
}

const DEFAULT_TXNS: Transaction[] = [
    { id: "T1", start: 1, commit: 4, reads: ["X"], writes: ["Y"] },
    { id: "T2", start: 2, commit: 5, reads: ["Y"], writes: ["X"] },
    { id: "T3", start: 6, commit: 7, reads: ["X"], writes: ["Z"] },
];

function concurrent(a: Transaction, b: Transaction): boolean {
    return a.start < b.commit && b.start < a.commit;
}

/** Anti-dependency: reader -> writer when the writer overwrites a key the reader used. */
function antiDependencies(txns: Transaction[]): Array<[string, string]> {
    const edges: Array<[string, string]> = [];
    for (const reader of txns) {
        for (const writer of txns) {
            if (reader.id === writer.id || !concurrent(reader, writer)) {
                continue;
            }
            if (reader.reads.some((key) => writer.writes.includes(key))) {
                edges.push([reader.id, writer.id]);
            }
        }
    }
    return edges;
}

/** Return the node ids of a directed cycle, or null when acyclic. */
function findCycle(edges: Array<[string, string]>, ids: string[]): string[] | null {
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
        adjacency.set(id, []);
    }
    for (const [from, to] of edges) {
        adjacency.get(from)?.push(to);
    }
    const color = new Map<string, number>();
    const stack: string[] = [];
    let found: string[] | null = null;
    const visit = (node: string): void => {
        if (found !== null) {
            return;
        }
        color.set(node, 1);
        stack.push(node);
        for (const next of adjacency.get(node) ?? []) {
            if (found !== null) {
                break;
            }
            if (color.get(next) === 1) {
                found = stack.slice(stack.indexOf(next));
                break;
            }
            if (color.get(next) === undefined) {
                visit(next);
            }
        }
        stack.pop();
        color.set(node, 2);
    };
    for (const id of ids) {
        if (color.get(id) === undefined) {
            visit(id);
        }
    }
    return found;
}

function frameFor(
    step: number,
    txns: Transaction[],
    edges: Array<[string, string]>,
    aborted: string[],
    description: string,
    line: number,
    lastVictim: string | null,
): VisualFrame {
    const entities: VisualEntity[] = txns.map((txn, index) => ({
        id: `tx-${txn.id}`,
        type: "node" as const,
        label: txn.id,
        value: txn.id,
        state: (txn.id === lastVictim ? "error" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, id: txn.id, reads: txn.reads.join(","), writes: txn.writes.join(",") },
    }));
    const visualEdges: VisualEdge[] = edges
        .filter(([from, to]) => txns.some((t) => t.id === from) && txns.some((t) => t.id === to))
        .map(([from, to]) => ({
            id: `rw-${from}-${to}`,
            sourceId: `tx-${from}`,
            targetId: `tx-${to}`,
            label: "rw",
            state: "comparing" as EntityState,
            directed: true,
        }));
    return {
        stepNumber: step,
        entities,
        edges: visualEdges,
        description,
        codeLineNumber: line,
        layout: "graph",
        meta: {
            nodes: txns.map((t) => t.id),
            edges: edges.map(([from, to]) => `${from}->${to}`),
            aborted: [...aborted],
            serializable: findCycle(edges, txns.map((t) => t.id)) === null,
            transactionCount: txns.length,
        },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    let active: Transaction[] = [...(task.transactions ?? DEFAULT_TXNS)];
    const aborted: string[] = [];
    let step = 0;

    let edges = antiDependencies(active);
    yield frameFor(
        step,
        active,
        edges,
        aborted,
        `Building anti-dependency graph for ${active.length} transaction(s); ${edges.length} edge(s).`,
        1,
        null,
    );
    step += 1;

    while (true) {
        edges = antiDependencies(active);
        const cycle = findCycle(
            edges,
            active.map((t) => t.id),
        );
        if (cycle === null) {
            break;
        }
        const victim = cycle
            .map((id) => active.find((t) => t.id === id)!)
            .reduce((youngest, txn) => (txn.commit > youngest.commit ? txn : youngest));
        aborted.push(victim.id);
        yield frameFor(
            step,
            active,
            edges,
            aborted,
            `Dangerous anti-dependency cycle ${cycle.join(" -> ")}; abort youngest transaction ${victim.id}.`,
            5,
            victim.id,
        );
        step += 1;
        active = active.filter((t) => t.id !== victim.id);
    }

    yield frameFor(
        step,
        active,
        edges,
        aborted,
        `SSI done: ${aborted.length} transaction(s) aborted; remaining graph is acyclic and serializable.`,
        7,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Snapshot isolation can still allow write skew, where two transactions each read data the other changes and both commit correctly on their own but together violate a constraint. SSI watches the read-write arrows between overlapping transactions. When those arrows form a loop, the committed result could not occur in any serial order, so the system aborts one member of the loop and retries.",
        invariants: [
            "An anti-dependency edge always points from a reader to a concurrent writer of a key it read.",
            "Aborting a transaction removes it and all of its edges from the graph.",
            "The loop stops only when the remaining anti-dependency graph is acyclic.",
            "Once aborted, a transaction is never reconsidered.",
        ],
        correctness:
            "Under snapshot isolation every serialization anomaly contains a cycle with two consecutive anti-dependency edges whose end points overlap in time. The algorithm detects such cycles directly in the anti-dependency graph. Removing a transaction from each cycle destroys that cycle, and because aborting a vertex cannot create a new directed cycle, iterating until no cycle remains yields an acyclic conflict view. An acyclic conflict graph is conflict-serializable, so the committed schedule is equivalent to some serial execution.",
        complexityRationale:
            "The graph has at most T(T-1) anti-dependency edges, each tested against up to K keys, so building it costs O(T^2 * K). Cycle detection is O(T^2) and may repeat up to T times, giving O(T^3 * K) worst-case time and O(T^2 + T * K) space.",
        uses: [
            "Serializable snapshot isolation in PostgreSQL's SSI implementation",
            "Serializability guarantees for write-skew-prone workloads in MVCC engines",
            "Distributed transaction managers that detect dangerous structures online",
        ],
        references: [
            "Cahill, Roehm, and Fekete, Serializable Isolation for Snapshot Databases, SIGMOD 2008",
            "Fekete et al., A Read-Only Transaction Anomaly Under Snapshot Isolation, SIGMOD 2004",
        ],
        workedExample:
            "T1 reads X and writes Y while concurrent T2 reads Y and writes X. The anti-dependencies T1 to T2 and T2 to T1 form a two-transaction cycle, so a write skew is possible. SSI aborts the transaction with the later commit timestamp, leaving T3, which merely reads X and writes Z, able to commit safely because its graph has no cycle.",
    },
    id: "serializable-snapshot-isolation",
    name: "Serializable Snapshot Isolation",
    category: "production-systems",
    complexity: { time: "O(T^3 * K)", space: "O(T^2 + T * K)" },
    defaultInput: { transactions: DEFAULT_TXNS },
    visualType: "graph",
    run,
    pseudocode: [
        "start with every active transaction as a vertex",
        "add a read-write edge from reader to concurrent writer",
        "search the anti-dependency graph for a directed cycle",
        "if the graph is acyclic then the schedule is serializable",
        "otherwise choose the youngest transaction in the cycle",
        "abort that transaction and remove all its edges",
        "repeat the cycle search on the reduced graph",
        "done: report aborted transactions and serializability",
    ],
};

export default module;
