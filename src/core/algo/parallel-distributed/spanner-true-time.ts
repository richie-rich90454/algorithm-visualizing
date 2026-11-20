/**
 * spanner-true-time.ts - Spanner TrueTime and Commit Wait
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Google Spanner exposes clock uncertainty explicitly: TT.now() returns an
 * interval [earliest, latest] rather than one instant. A read-write
 * transaction picks its commit timestamp from the latest end of the interval
 * and then waits until TT.after(timestamp) is certainly true before it
 * becomes visible. That wait bridges the uncertainty window, so a transaction
 * that becomes visible before another starts always receives a smaller
 * timestamp, which is Spanner's external consistency guarantee.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per transaction, plus one wait of about 2*epsilon real time
 *   Space: O(t) for t transaction records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are transactions; columns are start, commit, timestamp, and
 *     visibility time, all in milliseconds of simulated real time.
 *   - The transaction currently waiting is YELLOW, completed ones are GREEN.
 *   - meta exposes timestamps, visibility times, and the consistency verdict.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";

interface TxSpec {
    start?: number;
    duration?: number;
    skew?: number;
}

interface Tx {
    start: number;
    commit: number;
    skew: number;
    stamp: number;
    visible: number;
}

const defaultSpecs: TxSpec[] = [
    { start: 0, duration: 3, skew: 1 },
    { start: 4, duration: 2, skew: -1 },
    { start: 7, duration: 3, skew: 0.5 },
];

const COLUMNS = ["start", "commit", "timestamp", "visible"];

function makeCells(txs: Tx[], active: number): VisualFrame["entities"] {
    return txs.flatMap((tx, i) =>
        COLUMNS.map((name, c) => {
            const value = [tx.start, tx.commit, tx.stamp, tx.visible][c] ?? 0;
            return {
                id: `cell-${i}-${c}`,
                type: "cell" as const,
                label: `${name}: ${Math.round(value * 100) / 100}`,
                value,
                state: (i === active ? "comparing" : "sorted") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: c, field: name },
            };
        }),
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { epsilon?: number; transactions?: TxSpec[] } | null) ?? {};
    const eps = Math.max(0.5, Math.min(20, Number(task.epsilon) || 2));
    const specs = Array.isArray(task.transactions) && task.transactions.length > 0 ? task.transactions : defaultSpecs;
    const txs: Tx[] = specs.map((spec) => {
        const start = Math.max(0, Number(spec.start) || 0);
        const commit = start + Math.max(0, Number(spec.duration) || 0);
        const skew = Math.max(-eps, Math.min(eps, Number(spec.skew) || 0));
        const stamp = commit + skew + eps;
        const visible = commit + 2 * eps;
        return { start, commit, skew, stamp, visible };
    });

    let step = 0;
    const frame = (description: string, codeLineNumber: number, active: number, checks = 0, violations = 0): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(txs, active),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            epsilon: eps,
            rows: txs.length,
            cols: COLUMNS.length,
            active,
            checks,
            violations,
            stamps: txs.map((tx) => Math.round(tx.stamp * 100) / 100),
            visible: txs.map((tx) => Math.round(tx.visible * 100) / 100),
            consistent: violations === 0,
        },
    });

    yield frame(
        `TrueTime with uncertainty +/-${eps} ms tracks ${txs.length} transaction(s); TT.now() returns an interval.`,
        0,
        -1,
    );

    for (let i = 0; i < txs.length; i += 1) {
        const tx = txs[i]!;
        yield frame(
            `Transaction ${i} starts at real time ${tx.start}; its local clock reads ${Math.round((tx.start + tx.skew) * 100) / 100} ms.`,
            1,
            i,
        );
        yield frame(
            `Transaction ${i} commits at ${tx.commit} and takes timestamp ${Math.round(tx.stamp * 100) / 100} from TT.now().latest().`,
            3,
            i,
        );
        yield frame(
            `Transaction ${i} waits until TT.after(${Math.round(tx.stamp * 100) / 100}) holds; it becomes visible at real time ${Math.round(tx.visible * 100) / 100}.`,
            4,
            i,
        );
    }

    let checks = 0;
    let violations = 0;
    for (let i = 0; i < txs.length; i += 1) {
        for (let j = 0; j < txs.length; j += 1) {
            if (txs[i]!.visible < txs[j]!.start) {
                checks += 1;
                if (txs[i]!.stamp >= txs[j]!.stamp) {
                    violations += 1;
                }
            }
        }
    }
    yield frame(
        `Checked ${checks} ordered transaction pair(s); ${violations} violation(s). Commit wait preserves external consistency.`,
        6,
        -1,
        checks,
        violations,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A distributed clock is never perfectly synchronized, so TrueTime returns a range instead of a point. A transaction takes the newest end of that range as its timestamp and then waits out the whole uncertainty window before anyone can see it. If a second transaction starts only after that wait, its own timestamp must be later, so observers see transactions in the same order in which they completed.",
        invariants: [
            "The true time always lies inside the TT.now() interval [local-epsilon, local+epsilon].",
            "A commit timestamp equals the latest end of the interval at commit time.",
            "A transaction is visible only after TT.after(timestamp) is true.",
        ],
        correctness:
            "If transaction a becomes visible before transaction b starts, then commit_a + 2*epsilon is less than start_b. The stamp of a is at most commit_a + 2*epsilon because its skew is bounded by epsilon, while the stamp of b is at least start_b because b's skew is at least -epsilon and its duration is nonnegative. Hence stamp_a is strictly less than stamp_b, which is external consistency: timestamps respect the real-time order of nonoverlapping transactions.",
        complexityRationale:
            "Computing a timestamp and its visibility time is constant work, so the simulation is O(t) for t transactions. The verification loop compares every ordered pair, O(t^2) time and O(1) extra space beyond the transaction records.",
        uses: [
            "Globally consistent distributed databases such as Google Spanner",
            "Externally consistent read-write transactions across data centers",
            "Teaching the difference between physical clocks, logical clocks, and uncertainty intervals",
        ],
        references: [
            "Corbett et al., Spanner: Google's Globally-Distributed Database, 2012",
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
        ],
        workedExample:
            "With epsilon of 2 ms, a transaction committing at real time 3 with a local skew of +1 receives stamp 6 and becomes visible at 7. A transaction starting at 8 commits at 10 with skew -1 and receives stamp 11. Since 7 is before 8, the first stamp 6 must be smaller than 11, and it is.",
    },
    id: "spanner-true-time",
    name: "Spanner TrueTime and Commit Wait",
    category: "parallel-distributed",
    complexity: { time: "O(1) per transaction; O(t^2) verification", space: "O(t)" },
    defaultInput: { epsilon: 2, transactions: defaultSpecs },
    visualType: "grid",
    run,
    pseudocode: [
        "let epsilon bound the clock uncertainty at every replica",
        "when transaction T starts, record its real start time",
        "at commit time c, set stamp to TT.now().latest()",
        "wait until TT.after(stamp), then make T visible",
        "visibility occurs at c plus two times epsilon",
        "for every pair where T1 is visible before T2 starts",
        "assert stamp of T1 is less than stamp of T2",
        "done: report the number of pairs verified and violations",
    ],
};

export default module;
