/**
 * token-bucket-rate-limiter.ts - Token Bucket Rate Limiter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A token bucket limits the average rate of requests while still allowing a
 * short burst. Tokens accumulate at a fixed rate up to a maximum capacity.
 * Each arriving request consumes one token; when the bucket is empty the
 * request is rejected. A full bucket therefore permits a burst of up to
 * capacity requests before the long-term rate takes over.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n arrivals
 *   Space: O(n) for the decision log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per arrival shows its timestamp.
 *   - An allowed request is green; a rejected one is red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the arrival cells, coloring each decided request. */
function makeCells(
    arrivals: number[],
    decisions: boolean[],
    current: number,
): VisualEntity[] {
    return arrivals.map((time, index) => {
        let state: EntityState = "idle";
        if (index < decisions.length) {
            state = decisions[index] ? "sorted" : "error";
        }
        if (index === current) {
            state = "comparing";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `t=${time}`,
            value: time,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, arrival: time },
        };
    });
}

/** The token bucket generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { capacity?: number; refillRate?: number; arrivals?: number[] } | null
    ) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, task.capacity) : 2;
    const refillRate = typeof task.refillRate === "number" ? Math.max(0, task.refillRate) : 1;
    const arrivals = Array.isArray(task.arrivals)
        ? [...task.arrivals]
        : [0, 0.2, 0.5, 1, 1.1, 1.2, 2, 2.5];

    let tokens = capacity;
    let last = 0;
    const decisions: boolean[] = [];

    yield {
        stepNumber: 0,
        entities: makeCells(arrivals, decisions, -1),
        edges: [],
        description: `Token bucket starts full with ${capacity} token(s) and refills at ${refillRate} per second.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: arrivals.length, tokens, allowed: 0, denied: 0, decisions: [] as number[] },
    };
    let step = 1;

    for (let i = 0; i < arrivals.length; i += 1) {
        const time = arrivals[i] ?? 0;
        const elapsed = Math.max(0, time - last);
        tokens = Math.min(capacity, tokens + elapsed * refillRate);
        const allowed = tokens >= 1;
        if (allowed) {
            tokens -= 1;
        }
        last = time;
        decisions.push(allowed);
        yield {
            stepNumber: step,
            entities: makeCells(arrivals, decisions, i),
            edges: [],
            description: `Arrival ${i} at t=${time}: ${allowed ? "allowed" : "rejected"}, ${tokens.toFixed(2)} token(s) remain.`,
            codeLineNumber: allowed ? 5 : 6,
            layout: "grid",
            meta: {
                rows: 1,
                cols: arrivals.length,
                tokens,
                allowed: decisions.filter(Boolean).length,
                denied: decisions.filter((d) => !d).length,
                decisions: decisions.map((d) => (d ? 1 : 0)),
            },
        };
        step += 1;
    }
}

/** The token bucket module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a bucket that slowly fills with tokens up to a lid. Every request takes one token; if none are left it is turned away. The lid limits how big a burst can be, while the refill speed sets the steady long-term rate.",
        invariants: [
            "The token count never exceeds the capacity and never goes negative.",
            "Each arrival consumes exactly one token when one is available.",
            "Refill is proportional to elapsed time since the previous arrival.",
        ],
        correctness:
            "The simulation adds the elapsed time times the refill rate and caps the result at capacity, then consumes a token only when at least one exists. This is exactly the definition of a token bucket, so the accept or reject decision for every arrival matches the specified policy.",
        complexityRationale:
            "Each arrival needs a constant amount of arithmetic and one decision, so the time is O(n). Storing the decision log uses O(n) space.",
        uses: [
            "API request throttling",
            "Network traffic shaping with burst tolerance",
            "Protecting backend services from traffic spikes",
        ],
        references: [
            "ITU-T I.371, Traffic Control and Congestion Control, 1996",
            "Cloudflare, How Rate Limiting Works, engineering documentation",
        ],
        workedExample:
            "With capacity two and one token per second, arrivals at t=0, 0.2, and 0.5 are all allowed from the full bucket. The arrivals at t=1 and 1.1 are allowed after one token refills, while t=1.2 is rejected until more time passes.",
    },
    id: "token-bucket-rate-limiter",
    name: "Token Bucket Rate Limiter",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        capacity: 2,
        refillRate: 1,
        arrivals: [0, 0.2, 0.5, 1, 1.1, 1.2, 2, 2.5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "fill the bucket to its capacity",
        "for each request arrival in time order",
        "add elapsed time times the refill rate, capped at capacity",
        "if at least one token is present",
        "consume one token and allow the request",
        "otherwise reject the request",
        "done: report every allow and reject decision",
    ],
};

export default module;
