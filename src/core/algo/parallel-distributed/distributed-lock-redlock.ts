/**
 * distributed-lock-redlock.ts - The Redlock Majority Lock Rule
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Redlock acquires the same short-lived lock on several independent Redis
 * instances. The lock is considered held only when a majority of instances
 * granted it and the elapsed acquisition time, plus an allowance for clock
 * drift, is still shorter than the lease validity. This module computes that
 * majority and timing rule exactly; it is a rule demonstration, not a networked
 * lock service and not a guarantee of production-grade mutual exclusion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) attempts for n independent instances
 *   Space: O(n) for the per-instance grant flags
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per instance shows one for a grant and zero for a refusal.
 *   - The final bar shows the verdict: one for a valid lock, zero otherwise.
 *   - Quorum, elapsed time, drift allowance, and validity are in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the instance bars and the verdict bar. */
function makeBars(
    grants: boolean[],
    visible: number,
    verdict: number,
    verdictState: EntityState,
): VisualEntity[] {
    const entities: VisualEntity[] = grants.map((granted, index) => {
        let state: EntityState = "unvisited";
        if (index < visible) {
            state = granted ? "sorted" : "error";
        }
        return {
            id: `bar-master-${index}`,
            type: "bar" as const,
            label: index < visible ? (granted ? "granted" : "refused") : "pending",
            value: index < visible && granted ? 1 : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: "master" },
        };
    });
    entities.push({
        id: "bar-verdict",
        type: "bar" as const,
        label: verdictState === "sorted" ? "lock valid" : "lock invalid",
        value: verdict,
        state: verdictState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: grants.length, role: "verdict" },
    });
    return entities;
}

/** The Redlock rule generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { masters?: number; acquired?: boolean[]; elapsed?: number; validity?: number; drift?: number } | null
    ) ?? {};
    const n = typeof task.masters === "number" && task.masters >= 1 && task.masters <= 9
        ? Math.floor(task.masters)
        : 5;
    const grants = Array.isArray(task.acquired) && task.acquired.length === n
        ? [...task.acquired]
        : [true, true, true, false, false].slice(0, n).concat(new Array<boolean>(Math.max(0, n - 5)).fill(false));
    const elapsed = typeof task.elapsed === "number" ? task.elapsed : 120;
    const validity = typeof task.validity === "number" && task.validity > 0 ? task.validity : 1000;
    const drift = typeof task.drift === "number" && task.drift >= 0 ? task.drift : 50;
    const quorum = Math.floor(n / 2) + 1;
    const count = grants.filter(Boolean).length;
    const majority = count >= quorum;
    const timeOk = elapsed + drift < validity;
    const valid = majority && timeOk;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(grants, 0, 0, "unvisited"),
        edges: [],
        description: `Trying to acquire the lock on ${n} independent instances; a majority of ${quorum} is required.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, quorum, acquiredCount: 0, elapsed, validity, drift, majority: false, timeOk, valid: false },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(grants, i + 1, 0, "unvisited"),
            edges: [],
            description: `Instance ${i} ${grants[i] ? "granted" : "refused"} the lock; ${grants.slice(0, i + 1).filter(Boolean).length} grant(s) so far.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, quorum, acquiredCount: grants.slice(0, i + 1).filter(Boolean).length, elapsed, validity, drift, majority: false, timeOk, valid: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(grants, n, 0, majority ? "comparing" : "error"),
        edges: [],
        description: majority
            ? `${count} of ${n} instances granted the lock, meeting the quorum of ${quorum}.`
            : `Only ${count} of ${n} instances granted the lock, short of the quorum of ${quorum}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, quorum, acquiredCount: count, elapsed, validity, drift, majority, timeOk, valid: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(grants, n, valid ? 1 : 0, valid ? "sorted" : "error"),
        edges: [],
        description: timeOk
            ? `Elapsed ${elapsed} plus drift allowance ${drift} is below validity ${validity}; the lock is ${valid ? "valid" : "invalid"}.`
            : `Elapsed ${elapsed} plus drift allowance ${drift} reaches validity ${validity}; the lock expired and is invalid.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, quorum, acquiredCount: count, elapsed, validity, drift, majority, timeOk, valid },
    };
}

/** The Redlock module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A single lock server is a single point of failure, so ask several independent servers for the same short lease. Two clients cannot both hold a majority of the same instances at once, because any two majorities overlap. Time matters too: the lease must still be valid after all the requests and clock uncertainty are accounted for.",
        invariants: [
            "The quorum is the floor of n over two plus one, a strict majority.",
            "A grant is counted at most once per independent instance.",
            "The lock is valid only when the majority test and the time test both pass.",
        ],
        correctness:
            "Two disjoint sets of a strict majority cannot exist in the same n instances, so at most one client satisfies the quorum at a time. The elapsed time plus the maximum plausible clock drift must be less than the lease duration; otherwise another client could acquire an overlapping lease after the first believes it still holds the lock. The module evaluates both conditions exactly.",
        complexityRationale:
            "Each instance is attempted once, so the time is O(n) network round trips. The state kept is one Boolean per instance, O(n) space.",
        uses: [
            "Mutually exclusive access to a shared resource across services",
            "Leader-like coordination without a dedicated consensus service",
            "Teaching the role of quorums and clock drift in distributed systems",
        ],
        references: [
            "Redlock: Distributed Locks with Redis, redis.io documentation",
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
        ],
        workedExample:
            "With five instances and three grants, the quorum of three is met. If acquisition took 120 ms, drift allowance is 50 ms, and the lease is 1000 ms, then 170 is less than 1000 and the lock is valid. If only two instances granted it, the lock is invalid regardless of timing.",
    },
    id: "distributed-lock-redlock",
    name: "Redlock Distributed Lock (Rule Model)",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { masters: 5, acquired: [true, true, true, false, false], elapsed: 120, validity: 1000, drift: 50 },
    visualType: "array",
    run,
    pseudocode: [
        "choose n independent lock instances and compute the quorum",
        "record the start time of the acquisition",
        "try to acquire the lock on each instance in turn",
        "count how many instances granted the lock",
        "accept only if the count reaches the quorum",
        "add the clock drift allowance to the elapsed time",
        "accept only if that total is below the lease validity",
        "done: report whether the distributed lock is held",
    ],
};

export default module;
