/**
 * health-check-probe.ts - Liveness Probe State Machine
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A health probe flips a service between healthy and unhealthy only after a
 * run of consecutive results agrees. A single failure must not eject a healthy
 * instance, and a single success must not admit a failing one, so the probe
 * uses separate success and failure thresholds. This module replays a fixed
 * sequence of probe results and records the resulting state after each one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m probe results
 *   Space: O(m) for the state trace and bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per probe result shows the health state after that check.
 *   - A transition is highlighted when the state flips.
 *   - The final frame reports the ending state and each transition index.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProbeInput {
    results?: boolean[];
    successThreshold?: number;
    failureThreshold?: number;
    initialHealthy?: boolean;
}

/** Build one bar per probe result showing the post-check health state. */
function makeBars(states: number[], transitions: number[], current: number, done: boolean): VisualEntity[] {
    return states.map((healthy, index) => {
        let state: EntityState = healthy === 1 ? "sorted" : "error";
        if (!done && index > current) {
            state = "unvisited";
        } else if (!done && index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `probe ${index}: ${healthy === 1 ? "healthy" : "unhealthy"}${transitions.includes(index) ? " transition" : ""}`,
            value: healthy,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, healthy, transition: transitions.includes(index) },
        };
    });
}

/** Replay probe results through the consecutive-threshold state machine. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProbeInput | null) ?? {};
    const results: boolean[] = task.results ?? [true, true, false, true, false, false, true, true];
    const successThreshold = Math.max(1, Math.floor(task.successThreshold ?? 2));
    const failureThreshold = Math.max(1, Math.floor(task.failureThreshold ?? 2));
    let healthy = task.initialHealthy !== false;

    if (results.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No probe results were supplied; the state is unchanged.",
            codeLineNumber: 0,
            layout: "array",
            meta: { states: [], transitions: [], finalHealthy: healthy, count: 0 },
        };
        return;
    }

    const states: number[] = [];
    const transitions: number[] = [];
    let consecutiveSuccess = 0;
    let consecutiveFailure = 0;

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(results.length).fill(healthy ? 1 : 0), transitions, -1, false),
        edges: [],
        description: `Starting ${healthy ? "healthy" : "unhealthy"} with success threshold ${successThreshold} and failure threshold ${failureThreshold}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { states: [], transitions: [], finalHealthy: healthy, successThreshold, failureThreshold, count: results.length },
    };
    let step = 1;

    for (let i = 0; i < results.length; i += 1) {
        const previous = healthy;
        if (results[i]) {
            consecutiveSuccess += 1;
            consecutiveFailure = 0;
            if (consecutiveSuccess >= successThreshold) {
                healthy = true;
            }
        } else {
            consecutiveFailure += 1;
            consecutiveSuccess = 0;
            if (consecutiveFailure >= failureThreshold) {
                healthy = false;
            }
        }
        states.push(healthy ? 1 : 0);
        if (healthy !== previous) {
            transitions.push(i);
        }
        yield {
            stepNumber: step,
            entities: makeBars(states, transitions, i, false),
            edges: [],
            description: `Probe ${i}: ${results[i] ? "success" : "failure"}; running totals ${consecutiveSuccess} successes, ${consecutiveFailure} failures; state ${healthy ? "healthy" : "unhealthy"}.`,
            codeLineNumber: results[i] ? 3 : 5,
            layout: "array",
            meta: {
                states: [...states],
                transitions: [...transitions],
                finalHealthy: healthy,
                successThreshold,
                failureThreshold,
                count: results.length,
                revealed: i + 1,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(states, transitions, -1, true),
        edges: [],
        description: `Final state ${healthy ? "healthy" : "unhealthy"} after ${transitions.length} transition(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { states, transitions, finalHealthy: healthy, successThreshold, failureThreshold, count: results.length },
    };
}

/** The health-check probe module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Health checks decide whether an instance should receive traffic, but a single hiccup should not take a healthy server out of rotation. A probe therefore requires several consecutive failures before declaring an instance unhealthy, and several consecutive successes before bringing it back. The counters reset whenever the result changes, so alternating results never accumulate into a flip.",
        invariants: [
            "A success resets the failure streak and a failure resets the success streak.",
            "The state flips only when the relevant streak reaches its threshold.",
            "The recorded state after each probe matches the current health flag.",
        ],
        correctness:
            "Maintaining two counters, one for each streak, and resetting the opposite counter on every result means a counter equals the length of the current run of that result. The state changes to healthy exactly when the success run reaches its threshold and to unhealthy exactly when the failure run reaches its threshold. Because thresholds are at least one and the counters reset, alternating results cannot trigger a transition, which prevents flapping from isolated checks.",
        complexityRationale:
            "Each probe result is processed with constant work, so m results take O(m) time. The state trace, transitions, and bars grow linearly with m, giving O(m) space.",
        uses: [
            "Kubernetes liveness and readiness probe configuration",
            "Load balancer health checking and endpoint ejection",
            "Circuit-breaker health gating in service meshes",
        ],
        references: [
            "Kubernetes documentation, Configure Liveness, Readiness and Startup Probes",
            "Google SRE Book, Chapter 21 on handling overload",
        ],
        workedExample:
            "Starting healthy with both thresholds at two, results success, success, failure keep the instance healthy because the failure streak is only one. Two more failures bring the streak to two, flipping it to unhealthy. Two consecutive successes are then needed before it rejoins the pool.",
    },
    id: "health-check-probe",
    name: "Health Check Probe",
    category: "production-systems",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: {
        results: [true, true, false, true, false, false, true, true],
        successThreshold: 2,
        failureThreshold: 2,
        initialHealthy: true,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read probe results and both consecutive thresholds",
        "start from the initial health state with empty streaks",
        "for each result update the matching streak and reset the other",
        "if successes reach the threshold then mark healthy",
        "if failures reach the threshold then mark unhealthy",
        "record the state and note any transition",
        "done: report the final state and transitions",
    ],
};

export default module;
