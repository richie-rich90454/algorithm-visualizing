/**
 * circuit-breaker.ts - Circuit Breaker State Machine Simulation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A circuit breaker protects a caller from repeatedly invoking a failing
 * service. While closed, calls pass through and consecutive failures are
 * counted; reaching a threshold trips the breaker to open. Open calls are
 * rejected immediately without touching the downstream service. After a reset
 * timeout the breaker admits a trial call in the half-open state, and enough
 * consecutive successes close it again while a single failure reopens it.
 * This module simulates that state machine over a call outcome sequence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n calls
 *   Space: O(n) for the per-call state log and display cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero shows each call outcome; row one shows the breaker state after
 *     processing that call.
 *   - Rejected calls are highlighted as errors; trial calls are active.
 *   - The final frame reports allowed, rejected, and trip counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type BreakerState = "closed" | "open" | "half-open";

export interface CircuitBreakerCall {
    state: BreakerState;
    allowed: boolean;
    outcome: "success" | "failure";
}

export interface CircuitBreakerResult {
    calls: CircuitBreakerCall[];
    finalState: BreakerState;
    allowed: number;
    rejected: number;
    trips: number;
}

/** Normalize a loose outcome value into success or failure. */
function normalize(value: unknown): "success" | "failure" {
    if (value === true || value === "S" || value === "success") {
        return "success";
    }
    return "failure";
}

/** Simulate the closed, open, and half-open state machine. */
export function simulateCircuitBreaker(
    outcomes: unknown[],
    failureThreshold: number,
    resetTimeout: number,
    successThreshold: number,
): CircuitBreakerResult {
    const threshold = Math.max(1, Math.floor(failureThreshold));
    const timeout = Math.max(1, Math.floor(resetTimeout));
    const successesNeeded = Math.max(1, Math.floor(successThreshold));
    const calls: CircuitBreakerCall[] = [];
    let state: BreakerState = "closed";
    let consecutiveFailures = 0;
    let consecutiveSuccesses = 0;
    let openAt = -1;
    let allowedCount = 0;
    let rejected = 0;
    let trips = 0;

    for (let i = 0; i < outcomes.length; i += 1) {
        const outcome = normalize(outcomes[i]);
        let permitted = true;
        if (state === "closed") {
            if (outcome === "success") {
                consecutiveFailures = 0;
            } else {
                consecutiveFailures += 1;
                if (consecutiveFailures >= threshold) {
                    state = "open";
                    openAt = i;
                    trips += 1;
                    consecutiveFailures = 0;
                }
            }
        } else if (state === "open") {
            if (i - openAt >= timeout) {
                state = "half-open";
                consecutiveSuccesses = 0;
                if (outcome === "success") {
                    consecutiveSuccesses += 1;
                    if (consecutiveSuccesses >= successesNeeded) {
                        state = "closed";
                        consecutiveSuccesses = 0;
                    }
                } else {
                    state = "open";
                    openAt = i;
                    trips += 1;
                }
            } else {
                permitted = false;
                rejected += 1;
            }
        } else {
            if (outcome === "success") {
                consecutiveSuccesses += 1;
                if (consecutiveSuccesses >= successesNeeded) {
                    state = "closed";
                    consecutiveSuccesses = 0;
                }
            } else {
                state = "open";
                openAt = i;
                trips += 1;
            }
        }
        if (permitted) {
            allowedCount += 1;
        }
        calls.push({ state, allowed: permitted, outcome });
    }

    return { calls, finalState: state, allowed: allowedCount, rejected, trips };
}

/** Outcome and state cells for every call. */
function makeCells(result: CircuitBreakerResult, active: number, phase: string): VisualEntity[] {
    const n = result.calls.length;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const call = result.calls[col];
            const shown = col <= active || phase === "done";
            let state: EntityState = "idle";
            if (shown) {
                if (row === 1 && call && !call.allowed) {
                    state = "error";
                } else if (col === active) {
                    state = "active";
                } else if (row === 1 && call?.state === "closed") {
                    state = "sorted";
                } else {
                    state = "visited";
                }
            }
            const value = row === 0 ? (call?.outcome ?? "success") : (call?.state ?? "closed");
            const label = row === 0
                ? call?.outcome === "failure" ? "F" : "S"
                : call?.state === "half-open" ? "HALF" : call?.state === "open" ? "OPEN" : "CLOSED";
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? label : "-",
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, role: row === 0 ? "outcome" : "state" },
            });
        }
    }
    return cells;
}

/** The circuit breaker generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            outcomes?: unknown[];
            failureThreshold?: number;
            resetTimeout?: number;
            successThreshold?: number;
        } | null) ?? {};
    const outcomes: unknown[] = Array.isArray(task.outcomes)
        ? task.outcomes
        : ["S", "S", "F", "F", "F", "F", "F", "S", "S", "S", "S", "F", "F", "F", "F", "F", "S", "S", "S"];
    const failureThreshold = Math.max(1, Math.floor(Number(task.failureThreshold ?? 3)) || 3);
    const resetTimeout = Math.max(1, Math.floor(Number(task.resetTimeout ?? 3)) || 3);
    const successThreshold = Math.max(1, Math.floor(Number(task.successThreshold ?? 2)) || 2);
    const result = simulateCircuitBreaker(outcomes, failureThreshold, resetTimeout, successThreshold);
    const n = outcomes.length;
    const base = {
        calls: n,
        failureThreshold,
        resetTimeout,
        successThreshold,
        finalState: result.finalState,
        allowed: 0,
        rejected: 0,
        trips: 0,
        states: [] as string[],
    };

    yield {
        stepNumber: 0,
        entities: makeCells(result, -1, "setup"),
        edges: [],
        description: `Simulating a circuit breaker with threshold ${failureThreshold}, timeout ${resetTimeout}, and ${successThreshold} success(es) to recover.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, rows: 2, cols: n },
    };

    let allowed = 0;
    let rejected = 0;
    let trips = 0;
    const states: string[] = [];
    for (let i = 0; i < n; i += 1) {
        const call = result.calls[i]!;
        if (call.allowed) {
            allowed += 1;
        } else {
            rejected += 1;
        }
        if (call.state === "open" && i > 0 && result.calls[i - 1]?.state !== "open") {
            trips += 1;
        }
        states.push(call.state);
        yield {
            stepNumber: 1 + i,
            entities: makeCells(result, i, "call"),
            edges: [],
            description: `Call ${i}: ${call.outcome}, state ${call.state}, request ${call.allowed ? "passed through" : "rejected without a downstream call"}.`,
            codeLineNumber: call.state === "closed" ? 1 : call.state === "open" ? 3 : 5,
            layout: "grid",
            meta: {
                ...base,
                rows: 2,
                cols: n,
                allowed,
                rejected,
                trips,
                states: [...states],
                currentState: call.state,
                callAllowed: call.allowed,
            },
        };
    }

    yield {
        stepNumber: 1 + n,
        entities: makeCells(result, -1, "done"),
        edges: [],
        description: `Breaker ended ${result.finalState}: ${result.allowed} call(s) allowed, ${result.rejected} rejected, ${result.trips} trip(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...base,
            rows: 2,
            cols: n,
            allowed: result.allowed,
            rejected: result.rejected,
            trips: result.trips,
            states: result.calls.map((call) => call.state),
            done: true,
        },
    };
}

/** The circuit breaker module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A circuit breaker is a safety switch for remote calls. Repeated failures open the circuit so callers fail fast instead of piling load onto a struggling service. After a cool-down, a single trial call checks whether the service recovered; several successes close the circuit again, while one failure opens it immediately.",
        invariants: [
            "No request reaches the downstream service while the breaker is open.",
            "Consecutive failures in the closed state reach the configured threshold before tripping.",
            "A half-open breaker needs the configured number of consecutive successes to close.",
        ],
        correctness:
            "The simulation is a direct transcription of the three-state machine. Closed calls always pass through and trip only after the threshold number of consecutive failures. Open calls are rejected until enough calls have elapsed; the first admitted call then enters half-open. A failure in half-open reopens with a fresh timestamp, and only consecutive successes close it, so the breaker can never close on an intermittent success. Induction over the call sequence shows each stored state is exactly the state a real breaker would hold after that call.",
        complexityRationale:
            "Every call performs a constant number of comparisons and counter updates, so the simulation takes O(n) time. Storing one outcome and state per call plus the display cells uses O(n) space.",
        uses: [
            "Protecting microservice calls from cascading failures",
            "Failing fast when a dependency is degraded",
            "Building resilient HTTP clients and service meshes",
        ],
        references: [
            "Nygard, Release It!: Design and Deploy Production-Ready Software, circuit breaker pattern",
            "Microsoft Azure Architecture Center, Circuit Breaker pattern",
        ],
        workedExample:
            "With threshold three, timeout three, and two successes to recover, two successes and three failures trip the breaker at call five. The next two calls are rejected, then the eighth call is a half-open trial that succeeds, and a second success closes the breaker. The final state is closed with no downstream calls made while open.",
    },
    id: "circuit-breaker",
    name: "Circuit Breaker",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        outcomes: ["S", "S", "F", "F", "F", "F", "F", "S", "S", "S", "S", "F", "F", "F", "F", "F", "S", "S", "S"],
        failureThreshold: 3,
        resetTimeout: 3,
        successThreshold: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start closed with zero consecutive failures",
        "on a closed success reset the failure count, on a closed failure increment it",
        "trip to open when consecutive failures reach the threshold",
        "reject open calls until the reset timeout has elapsed",
        "admit one trial call and enter the half-open state after the timeout",
        "close after the required consecutive successes, reopen on any failure",
        "done: report allowed, rejected, and trip counts",
    ],
};

export default module;
