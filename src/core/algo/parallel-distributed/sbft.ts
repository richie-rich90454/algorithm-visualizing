/**
 * sbft.ts - Scalable Byzantine Fault Tolerance (collector and threshold signatures)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SBFT scales practical Byzantine fault tolerance by separating ordering from
 * reply collection. With n = 3f+1 replicas, a primary orders a request and each
 * replica executes it and sends a signed share of the reply to a dedicated
 * collector. The collector needs only f+1 matching shares to forge a threshold
 * signature certificate, so the normal-case reply path costs a linear number
 * of messages instead of quadratic all-to-all traffic. If the fast path cannot
 * gather enough shares, a slower path with 2f+1 replicas completes the view.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages on the fast path, O(n^2) on the slow path
 *   Space: O(n) for the collected signature shares
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell is one replica sending a signed reply share.
 *   - Matching shares are green, conflicting ones are red, pending are yellow.
 *   - The meta reports the threshold, share count, and commit verdict.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SbfInput {
    replicas?: number;
    faulty?: number[];
    value?: number;
}

function makeCells(
    reports: number[],
    value: number,
    upto: number,
): VisualEntity[] {
    return reports.map((report, index) => ({
        id: `replica-${index}`,
        type: "cell" as const,
        label: index < upto ? (report === value ? "ok" : "bad") : "-",
        value: index < upto ? report : -1,
        state: (
            index >= upto
                ? "idle"
                : report === value
                  ? "sorted"
                  : "error"
        ) as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, report: index < upto ? report : -1 },
    }));
}

/** The SBFT collector generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SbfInput | null) ?? {};
    const replicas = typeof task.replicas === "number" && task.replicas >= 4 ? Math.floor(task.replicas) : 4;
    const value = typeof task.value === "number" ? task.value : 7;
    const faulty = Array.isArray(task.faulty)
        ? [...new Set(task.faulty.filter((n): n is number => typeof n === "number" && n >= 0 && n < replicas))]
        : [];
    const f = Math.floor((replicas - 1) / 3);
    const threshold = f + 1;
    const slowThreshold = 2 * f + 1;
    const reports = Array.from({ length: replicas }, (_, index) => (faulty.includes(index) ? value + 100 : value));
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeCells(reports, value, 0),
        edges: [],
        description: `Starting SBFT with ${replicas} replicas, f = ${f}, fast threshold ${threshold}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: replicas, f, threshold, slowThreshold, shares: 0, conflicting: 0, phase: "request", committed: false },
    };

    for (let index = 0; index < replicas; index += 1) {
        const shares = reports.slice(0, index + 1).filter((r) => r === value).length;
        const conflicting = index + 1 - shares;
        yield {
            stepNumber: step++,
            entities: makeCells(reports, value, index + 1),
            edges: [],
            description: `Replica ${index} sends a signed reply share; ${shares} matching share(s) collected.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: replicas, f, threshold, slowThreshold, shares, conflicting, phase: "collect", committed: false },
        };
    }

    const matching = reports.filter((r) => r === value).length;
    const conflicting = reports.length - matching;
    const fastPath = matching >= threshold;
    const slowPath = matching >= slowThreshold;
    const safetyViolation = conflicting >= threshold;
    const committed = matching >= threshold && !safetyViolation;
    const phase = fastPath ? "fast-certificate" : slowPath ? "slow-certificate" : "no-quorum";
    yield {
        stepNumber: step,
        entities: makeCells(reports, value, replicas),
        edges: [],
        description: committed
            ? `Collector formed a ${threshold}-share certificate on the ${fastPath ? "fast" : "slow"} path; value ${value} committed.`
            : conflicting >= threshold
              ? `Conflicting shares reached the threshold; safety violation detected, no commit.`
              : `Only ${matching} matching share(s); no quorum, no commit.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 1,
            cols: replicas,
            f,
            threshold,
            slowThreshold,
            shares: matching,
            conflicting,
            phase,
            committed,
            fastPath,
            safetyViolation,
        },
    };
}

/** The SBFT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "In classic Byzantine agreement every replica talks to every other replica, which is expensive. SBFT adds a collector: replicas send their signed replies to one place, and a small number of matching signatures is enough to prove the reply is correct. A threshold signature compresses those shares into one short certificate. If the fast path stalls because too many replicas misbehave, the protocol falls back to a larger quorum and a view change.",
        invariants: [
            "The system tolerates at most f = floor((n-1)/3) faulty replicas.",
            "A fast-path certificate needs f+1 matching signed shares.",
            "The slow path needs 2f+1 matching shares.",
            "Honest replicas all report the same executed value.",
        ],
        correctness:
            "With at most f faulty replicas, at least n-f = 2f+1 honest replicas report the same value, which exceeds the f+1 fast threshold and also meets the 2f+1 slow threshold, so a certificate always exists. A conflicting value can collect f+1 shares only if at least f+1 replicas are faulty, which is outside the model; the module flags that case as a safety violation rather than committing it. The threshold signature binds the certificate to the exact value, so a client can verify the reply without trusting the collector.",
        complexityRationale:
            "On the fast path each of the n replicas sends one share to the collector and the collector sends one certificate back, so O(n) messages suffice. The slow path adds all-to-all view-change traffic, O(n^2). Storing the collected shares uses O(n) space.",
        uses: [
            "Byzantine-tolerant state machine replication",
            "Permissioned ledgers and consortium blockchains",
            "Replicated services that must survive arbitrary node failures",
        ],
        references: [
            "Yin et al., Practical Byzantine Fault Tolerance and Proactive Recovery, 2002",
            "Gueta et al., SBFT: A Scalable and Decentralized Trust Infrastructure, 2019",
        ],
        workedExample:
            "With four replicas, f is one and the fast threshold is two. All three honest replicas report value 7 and the single faulty replica reports 107. The collector gathers three matching shares, forms a two-share certificate on the fast path, and commits 7. If two replicas were faulty, their two conflicting shares would reach the threshold, so the module flags a safety violation instead of committing.",
    },
    id: "sbft",
    name: "SBFT (Scalable Byzantine Fault Tolerance)",
    category: "parallel-distributed",
    complexity: { time: "O(n) fast, O(n^2) slow", space: "O(n)" },
    defaultInput: { replicas: 4, faulty: [3], value: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "set n equal to three f plus one replicas",
        "the primary orders the client request",
        "each replica executes it and signs a reply share",
        "the collector gathers matching shares",
        "on f+1 matches form a threshold certificate",
        "otherwise fall back to a 2f+1 slow path",
        "reject a conflicting value that reaches the threshold",
        "done: report commit or a safety violation",
    ],
};

export default module;
