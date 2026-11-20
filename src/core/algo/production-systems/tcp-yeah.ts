/**
 * tcp-yeah.ts - TCP YeAH (Yet Another High-speed) Congestion Control
 *
 * A dual-mode congestion controller. When queuing delay is low it behaves like
 * standard Reno: steady linear growth and a halving on loss. When the queue is
 * persistently full it switches to a high-speed mode with faster growth and a
 * milder reduction, because on a high-bandwidth path a halving is needlessly
 * severe. Two distinct thresholds provide hysteresis so the mode does not
 * oscillate around a single boundary. This is a faithful teaching simulation
 * of the mode logic, not a full TCP stack.
 *
 * Complexity:
 *   Time:  O(events) for the supplied acknowledgment and loss sequence
 *   Space: O(events) for the recorded window trace
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Event = { type: "ack"; rtt: number } | { type: "loss" };
type Mode = "tcp" | "highspeed";

interface YeahState {
    cwnd: number;
    baseRtt: number;
    avgRtt: number;
    mode: Mode;
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
    const task = (input as {
        events?: Event[];
        initialCwnd?: number;
        lowThreshold?: number;
        highThreshold?: number;
        alphaHigh?: number;
        betaHigh?: number;
    } | null) ?? {};
    const events: Event[] = Array.isArray(task.events)
        ? task.events
        : [
            { type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 22 },
            { type: "ack", rtt: 35 }, { type: "ack", rtt: 45 }, { type: "loss" },
            { type: "ack", rtt: 50 }, { type: "ack", rtt: 25 }, { type: "ack", rtt: 21 },
          ];
    const initialCwnd = typeof task.initialCwnd === "number" ? task.initialCwnd : 1;
    const lowThreshold = typeof task.lowThreshold === "number" ? task.lowThreshold : 5;
    const highThreshold = typeof task.highThreshold === "number" ? task.highThreshold : 15;
    const alphaHigh = typeof task.alphaHigh === "number" ? task.alphaHigh : 10;
    const betaHigh = typeof task.betaHigh === "number" ? task.betaHigh : 0.1;
    const state: YeahState = { cwnd: initialCwnd, baseRtt: Number.POSITIVE_INFINITY, avgRtt: 0, mode: "tcp" };
    const windows: number[] = [state.cwnd];
    const base = { events: events.length, lowThreshold, highThreshold, alphaHigh, betaHigh };

    yield {
        stepNumber: 0,
        entities: makeBars(windows),
        edges: [],
        description: "YeAH starts in Reno mode and switches to high-speed mode when the queue builds.",
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: "init", cwnd: state.cwnd, mode: state.mode, queueDelay: null },
    };
    for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (!event) {
            continue;
        }
        if (event.type === "ack") {
            if (state.baseRtt === Number.POSITIVE_INFINITY) {
                state.baseRtt = event.rtt;
                state.avgRtt = event.rtt;
            } else {
                state.baseRtt = Math.min(state.baseRtt, event.rtt);
                state.avgRtt += (event.rtt - state.avgRtt) / 16;
            }
            const queueDelay = state.avgRtt - state.baseRtt;
            if (state.mode === "tcp" && queueDelay > highThreshold) {
                state.mode = "highspeed";
            } else if (state.mode === "highspeed" && queueDelay < lowThreshold) {
                state.mode = "tcp";
            }
            state.cwnd += (state.mode === "tcp" ? 1 : alphaHigh) / state.cwnd;
        } else {
            state.cwnd *= state.mode === "tcp" ? 0.5 : 1 - betaHigh;
        }
        state.cwnd = Math.max(0.1, state.cwnd);
        windows.push(state.cwnd);
        const queueDelay = state.avgRtt - state.baseRtt;
        yield {
            stepNumber: i + 1,
            entities: makeBars(windows),
            edges: [],
            description: `Event ${i} in ${state.mode} mode: queue delay ${queueDelay.toFixed(2)}, cwnd ${state.cwnd.toFixed(2)}.`,
            codeLineNumber: event.type === "ack" ? 4 : 6,
            layout: "array",
            meta: {
                ...base,
                phase: event.type,
                cwnd: Number(state.cwnd.toFixed(6)),
                mode: state.mode,
                baseRtt: Number.isFinite(state.baseRtt) ? Number(state.baseRtt.toFixed(6)) : null,
                avgRtt: Number(state.avgRtt.toFixed(6)),
                queueDelay: Number(queueDelay.toFixed(6)),
            },
        };
    }
    yield {
        stepNumber: events.length + 1,
        entities: makeBars(windows),
        edges: [],
        description: `Final window ${state.cwnd.toFixed(2)} in ${state.mode} mode after ${events.length} event(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { ...base, phase: "done", cwnd: Number(state.cwnd.toFixed(6)), mode: state.mode },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "On a fast network a 50 percent rate cut after one loss can waste a lot of capacity. YeAH watches the round-trip time to decide which world it is in. With little standing queue it acts like ordinary Reno. Once delay shows the bottleneck is full, it switches to a high-speed mode that grows faster and cuts only gently on loss. A pair of thresholds keeps it from flipping modes on every sample.",
        invariants: [
            "The base round-trip time is the minimum delay observed so far.",
            "The mode changes only when queuing delay crosses its hysteresis thresholds.",
            "A loss always reduces the congestion window, never increases it.",
        ],
        correctness:
            "The controller starts in Reno mode. On an acknowledgment it updates the smoothed delay and switches to high-speed mode only when the delay exceeds the high threshold, returning to Reno only when the delay falls below the low threshold; since the two thresholds differ, no single value can cause repeated flips. Growth and reduction then use the constants of the active mode. Replaying the events reproduces the same mode sequence and window trace.",
        complexityRationale:
            "Every event does a fixed number of comparisons and arithmetic operations, so k events cost O(k) time. The visualization keeps one bar and one metadata record per event, using O(k) space.",
        uses: [
            "High-bandwidth transport over deep-buffered links",
            "Teaching dual-mode and delay-aware congestion control",
            "A model for hysteresis in control algorithms",
        ],
        references: [
            "Bai, Xu, and Khan, A TCP-Friendly High Speed TCP Variant, 2006",
            "Stevens, TCP/IP Illustrated, Volume 1, Chapter 21",
        ],
        workedExample:
            "With a 20 ms baseline and a 15 ms high threshold, early acknowledgments around 21 ms leave YeAH in Reno mode and the window grows by one over itself. When the average climbs past 35 ms the delay crosses 15 ms, the mode becomes high-speed, and the next loss cuts the window by only ten percent instead of half.",
    },
    id: "tcp-yeah",
    name: "TCP YeAH",
    category: "production-systems",
    complexity: { time: "O(events)", space: "O(events)" },
    defaultInput: {
        events: [
            { type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 22 },
            { type: "ack", rtt: 35 }, { type: "ack", rtt: 45 }, { type: "loss" },
            { type: "ack", rtt: 50 }, { type: "ack", rtt: 25 }, { type: "ack", rtt: 21 },
        ],
        initialCwnd: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start in Reno mode with an unknown base delay",
        "on an acknowledgment update base and smoothed delay",
        "switch to high-speed mode above the upper threshold",
        "return to Reno mode below the lower threshold",
        "grow by one over the window in Reno mode",
        "grow by a larger alpha in high-speed mode",
        "halve on loss in Reno mode or apply the mild factor otherwise",
        "done: report the final window and mode",
    ],
};

export default module;
