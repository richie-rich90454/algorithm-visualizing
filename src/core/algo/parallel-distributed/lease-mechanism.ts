/**
 * lease-mechanism.ts - Lease-Based Locking (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A lease is a lock with a bounded lifetime. A holder acquires the resource at
 * time t with a duration d and owns it on the half-open interval [t, t + d).
 * Another contender may acquire only after that interval has passed, while the
 * current holder may renew to extend its expiry. Leases are the foundation of
 * distributed locks such as Chubby and etcd.
 *
 * This teaching model implements the exact acquisition rule on a single
 * logical clock. It does not model clock skew, network delay, or fencing
 * tokens, so it must not be used to reason about real distributed safety.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r) for r acquisition attempts
 *   Space: O(k) for k distinct contenders
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row of cells shows contenders; the current holder is green.
 *   - An expired holder is red; idle contenders are gray.
 *   - meta carries the clock, holder, expiry, and the accept decision.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Attempt {
    owner: string;
    time: number;
    duration: number;
}

/** Build the contender cells for a frame. */
function makeCells(
    contenders: string[],
    holder: string | null,
    holderValid: boolean,
    active: string | null,
): VisualEntity[] {
    return contenders.map((owner, index) => {
        let state: EntityState = "unvisited";
        if (owner === holder) {
            state = holderValid ? "sorted" : "error";
        }
        if (owner === active) {
            state = "active";
        }
        return {
            id: `owner-${index}`,
            type: "cell" as const,
            label: owner,
            value: owner,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, owner },
        };
    });
}

/** The lease acquisition generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { attempts?: Attempt[] } | null) ?? {};
    const attempts: Attempt[] = Array.isArray(task.attempts)
        ? task.attempts.map((a) => ({
              owner: String(a?.owner ?? "?"),
              time: Number(a?.time ?? 0),
              duration: Math.max(0, Number(a?.duration ?? 1)),
          }))
        : [
              { owner: "A", time: 0, duration: 5 },
              { owner: "B", time: 2, duration: 5 },
              { owner: "A", time: 6, duration: 5 },
          ];

    const contenders: string[] = [];
    for (const attempt of attempts) {
        if (!contenders.includes(attempt.owner)) {
            contenders.push(attempt.owner);
        }
    }
    if (contenders.length === 0) {
        contenders.push("A");
    }

    let holder: string | null = null;
    let expiry = Number.NEGATIVE_INFINITY;
    let clock = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(contenders, null, false, null),
        edges: [],
        description: `Lease model with ${contenders.length} contender(s) and ${attempts.length} acquisition attempt(s); no lease is held yet.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: contenders.length, clock: 0, holder: "", expiry: 0, accepted: false, note: "teaching model, not clock-drift safe" },
    };
    step += 1;

    for (const attempt of attempts) {
        clock = Math.max(clock, attempt.time);
        const expired = clock >= expiry;
        const accepted = holder === null || expired || attempt.owner === holder;
        if (accepted) {
            holder = attempt.owner;
            expiry = attempt.time + attempt.duration;
        }
        const holderValid = holder !== null && clock < expiry;
        yield {
            stepNumber: step,
            entities: makeCells(contenders, holder, holderValid, accepted ? attempt.owner : null),
            edges: [],
            description: `Time ${clock}: ${attempt.owner} requests a lease for ${attempt.duration} unit(s); ${accepted ? "granted" : "denied because an unexpired lease is held by " + holder}. Holder is ${holder ?? "none"}.`,
            codeLineNumber: accepted ? 3 : 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: contenders.length,
                clock,
                holder: holder ?? "",
                expiry: Number.isFinite(expiry) ? expiry : 0,
                accepted,
                owner: attempt.owner,
                duration: attempt.duration,
            },
        };
        step += 1;
    }

    const holderValid = holder !== null && clock < expiry;
    yield {
        stepNumber: step,
        entities: makeCells(contenders, holder, holderValid, null),
        edges: [],
        description: `Final lease: ${holderValid ? holder + " holds until " + expiry : "no valid holder"}. At most one contender ever holds an unexpired lease.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: contenders.length,
            clock,
            holder: holderValid ? (holder ?? "") : "",
            expiry: Number.isFinite(expiry) ? expiry : 0,
            holderValid,
            accepted: false,
            note: "teaching model, not clock-drift safe",
        },
    };
}

/** The lease-based locking teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A lease turns a lock into a timed promise: the holder gets the resource for a fixed window, after which the lock frees itself automatically. If a holder crashes, other contenders wait only until the expiry instead of blocking forever. The holder can renew before expiry to keep ownership.",
        invariants: [
            "A lease is valid on the half-open interval from its grant time to its expiry.",
            "At most one contender holds an unexpired lease at any clock value.",
            "A new owner is granted only when the previous lease has expired.",
        ],
        correctness:
            "The grant rule accepts a request exactly when there is no holder, the current lease has expired at the request time, or the requester is already the holder. Because a successful grant replaces the holder atomically and every later request before expiry fails, no two distinct owners can hold an unexpired lease simultaneously. Renewal keeps the same owner, so exclusivity is preserved.",
        complexityRationale:
            "Each of the r attempts performs a constant-time comparison against the current holder and expiry, so the time is O(r). The contender list holds k names, giving O(k) space.",
        uses: [
            "A teaching model for distributed lock services such as Chubby and etcd",
            "Explaining self-expiring locks and leader leases",
            "Understanding why fencing tokens are needed with real clocks",
        ],
        references: [
            "Burrows, Chubby: The Chubby Lock Service for Loosely-Coupled Distributed Systems, 2006",
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
        ],
        workedExample:
            "A acquires at time 0 for 5 units, so it holds until time 5. B asks at time 2 and is denied. A renews at time 6, which is past expiry, so the grant succeeds and A holds until time 11. With a single logical clock, only A ever holds a valid lease.",
    },
    id: "lease-mechanism",
    name: "Lease Mechanism (Teaching Model)",
    category: "parallel-distributed",
    complexity: { time: "O(r)", space: "O(k)" },
    defaultInput: {
        attempts: [
            { owner: "A", time: 0, duration: 5 },
            { owner: "B", time: 2, duration: 5 },
            { owner: "A", time: 6, duration: 5 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with no holder and an expiry of minus infinity",
        "for each acquisition attempt at its request time",
        "if a different holder has an unexpired lease then deny",
        "otherwise grant the lease to the requester",
        "set the expiry to the request time plus the duration",
        "renewal by the current holder replaces the expiry",
        "done: report the final valid holder or none",
    ],
};

export default module;
