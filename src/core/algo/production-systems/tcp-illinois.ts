/**
 * tcp-illinois.ts - TCP Illinois Congestion Control
 *
 * A delay-based congestion controller that changes how aggressively it grows
 * and shrinks the congestion window according to queuing delay. It tracks a
 * baseline round-trip time and a smoothed average; the gap between them
 * estimates standing queue delay. When the queue is shallow it uses a large
 * additive increase and a gentle multiplicative decrease. As the queue grows,
 * the increase shrinks and the decrease becomes stronger. This is a faithful
 * teaching simulation of the rate adaptation, not a full TCP implementation.
 *
 * Complexity:
 *   Time:  O(events) for the supplied acknowledgment and loss sequence
 *   Space: O(events) for the recorded window trace
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Event = { type: "ack"; rtt: number } | { type: "loss" };

interface IllinoisState {
    cwnd: number;
    minRtt: number;
    avgRtt: number;
    alpha: number;
    beta: number;
}

function clamp(value: number, low: number, high: number): number {
    return Math.max(low, Math.min(high, value));
}

function updateRates(state: IllinoisState, alphaMax: number, alphaMin: number, betaMin: number, betaMax: number): void {
    const queuingDelay = state.avgRtt - state.minRtt;
    const threshold = state.minRtt / 4;
    if (queuingDelay < threshold) {
        state.alpha = alphaMax;
        state.beta = betaMin;
        return;
    }
    const denominator = Math.max(queuingDelay, 1e-9);
    state.alpha = clamp((alphaMin * state.minRtt) / denominator, alphaMin, alphaMax);
    const fraction = (queuingDelay - threshold) / denominator;
    state.beta = clamp(betaMin + (betaMax - betaMin) * fraction, betaMin, betaMax);
}

function makeBars(windows: number[]): VisualEntity[] {
    return windows.map((window, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: window.toFixed(1),
        value: Number(window.toFixed(6)),
        state: "sorted" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { events?: Event[]; initialCwnd?: number; alphaMax?: number; alphaMin?: number; betaMin?: number; betaMax?: number } | null) ?? {};
    const events: Event[] = Array.isArray(task.events)
        ? task.events
        : [
            { type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 23 },
            { type: "ack", rtt: 28 }, { type: "ack", rtt: 35 }, { type: "loss" },
            { type: "ack", rtt: 30 }, { type: "ack", rtt: 24 }, { type: "ack", rtt: 21 },
          ];
    const alphaMax = typeof task.alphaMax === "number" ? task.alphaMax : 10;
    const alphaMin = typeof task.alphaMin === "number" ? task.alphaMin : 0.1;
    const betaMin = typeof task.betaMin === "number" ? task.betaMin : 0.125;
    const betaMax = typeof task.betaMax === "number" ? task.betaMax : 0.5;
    const initialCwnd = typeof task.initialCwnd === "number" ? task.initialCwnd : 1;
    const state: IllinoisState = {
        cwnd: initialCwnd,
        minRtt: Number.POSITIVE_INFINITY,
        avgRtt: 0,
        alpha: alphaMax,
        beta: betaMin,
    };
    const windows: number[] = [state.cwnd];
    const base = { events: events.length, alphaMax, alphaMin, betaMin, betaMax };

    yield {
        stepNumber: 0,
        entities: makeBars(windows),
        edges: [],
        description: "Illinois tracks baseline and average RTT to set additive and multiplicative rates.",
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: "init", cwnd: state.cwnd, alpha: state.alpha, beta: state.beta, minRtt: null },
    };
    for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (!event) {
            continue;
        }
        if (event.type === "ack") {
            if (state.minRtt === Number.POSITIVE_INFINITY) {
                state.minRtt = event.rtt;
                state.avgRtt = event.rtt;
            } else {
                state.minRtt = Math.min(state.minRtt, event.rtt);
                state.avgRtt += (event.rtt - state.avgRtt) / 16;
            }
            updateRates(state, alphaMax, alphaMin, betaMin, betaMax);
            state.cwnd += state.alpha / state.cwnd;
        } else {
            updateRates(state, alphaMax, alphaMin, betaMin, betaMax);
            state.cwnd *= 1 - state.beta;
        }
        state.cwnd = Math.max(0.1, state.cwnd);
        windows.push(state.cwnd);
        const queuingDelay = state.avgRtt - state.minRtt;
        yield {
            stepNumber: i + 1,
            entities: makeBars(windows),
            edges: [],
            description: event.type === "ack"
                ? `ACK ${i}: queue delay ${queuingDelay.toFixed(2)}, alpha ${state.alpha.toFixed(2)}, cwnd ${state.cwnd.toFixed(2)}.`
                : `Loss ${i}: beta ${state.beta.toFixed(2)}, window cut to ${state.cwnd.toFixed(2)}.`,
            codeLineNumber: event.type === "ack" ? 4 : 6,
            layout: "array",
            meta: {
                ...base,
                phase: event.type,
                cwnd: Number(state.cwnd.toFixed(6)),
                alpha: Number(state.alpha.toFixed(6)),
                beta: Number(state.beta.toFixed(6)),
                minRtt: Number.isFinite(state.minRtt) ? Number(state.minRtt.toFixed(6)) : null,
                avgRtt: Number(state.avgRtt.toFixed(6)),
                queuingDelay: Number(queuingDelay.toFixed(6)),
            },
        };
    }
    yield {
        stepNumber: events.length + 1,
        entities: makeBars(windows),
        edges: [],
        description: `Final congestion window ${state.cwnd.toFixed(2)} after ${events.length} event(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { ...base, phase: "done", cwnd: Number(state.cwnd.toFixed(6)), alpha: Number(state.alpha.toFixed(6)), beta: Number(state.beta.toFixed(6)) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Packet loss is not the only sign of congestion; a growing queue shows up as a growing round-trip time. Illinois measures that queue delay and tunes two knobs. With a shallow queue it grows the window quickly and cuts it only slightly on loss. As the queue builds, growth slows and the cut gets deeper, which keeps the link full without filling the buffers.",
        invariants: [
            "The baseline round-trip time is the minimum RTT observed so far.",
            "The smoothed RTT is updated by an exponential moving average on each acknowledgment.",
            "A larger measured queue delay never produces a larger additive increase.",
        ],
        correctness:
            "When the estimated queue delay is below a quarter of the baseline, the controller selects the maximum increase and minimum decrease by the first branch of the rule. Otherwise the increase is inversely proportional to the delay and the decrease grows linearly from its minimum toward its maximum, both clamped to their allowed ranges. Replaying the same event sequence applies the same arithmetic every time, so the recorded window trace matches an independent implementation of these formulas.",
        complexityRationale:
            "Each acknowledgment or loss performs a constant number of arithmetic operations, so a trace of k events takes O(k) time. Recording one bar and one metadata snapshot per event uses O(k) space in the visualization.",
        uses: [
            "Congestion control in high-bandwidth, high-delay networks",
            "Teaching delay-based versus loss-based congestion signaling",
            "A model for bufferbloat-aware transport design",
        ],
        references: [
            "Liu, Bassiouni, and Ghosal, TCP Illinois: A Congestion Control Algorithm for High Speed Networks, 2006",
            "Stevens, TCP/IP Illustrated, Volume 1, Chapter 21",
        ],
        workedExample:
            "Starting with a window of one and a 20 ms baseline RTT, early acknowledgments see almost no queue, so alpha is 10 and the window grows quickly. When the average RTT rises to 35 ms, queuing delay exceeds the threshold, alpha falls and beta rises. The following loss therefore halves the window much more sharply than a shallow-queue loss would.",
    },
    id: "tcp-illinois",
    name: "TCP Illinois",
    category: "production-systems",
    complexity: { time: "O(events)", space: "O(events)" },
    defaultInput: {
        events: [
            { type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 23 },
            { type: "ack", rtt: 28 }, { type: "ack", rtt: 35 }, { type: "loss" },
            { type: "ack", rtt: 30 }, { type: "ack", rtt: 24 }, { type: "ack", rtt: 21 },
        ],
        initialCwnd: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the window and mark baseline RTT unknown",
        "on an acknowledgment update baseline and smoothed RTT",
        "compute queuing delay as smoothed minus baseline RTT",
        "if delay is small use maximum increase and minimum decrease",
        "otherwise scale increase inversely with delay and raise decrease",
        "on an acknowledgment add alpha divided by the window",
        "on a loss multiply the window by one minus beta",
        "done: report the final congestion window",
    ],
};

export default module;
