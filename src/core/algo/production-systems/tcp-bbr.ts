/**
 * tcp-bbr.ts - TCP BBR Congestion Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BBR is a model-based congestion controller. Instead of treating loss as the
 * signal, it estimates the bottleneck bandwidth and the round-trip propagation
 * delay, then paces packets at the bandwidth estimate and caps the window at
 * the bandwidth-delay product. A gain cycle probes for more bandwidth while
 * periodically draining the queue to refresh the delay estimate. Its phases are
 * STARTUP, DRAIN, PROBE_BW, and PROBE_RTT.
 *
 * This is a deterministic teaching simulator over discrete rounds with a fixed
 * bottleneck capacity; the estimator and gain state machine are the real BBR
 * logic, while the network model is intentionally simple.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) for the simulated timeline
 *   Space: O(rounds) for the history arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per round shows the estimated bottleneck bandwidth.
 *   - The bar is colored by phase and the current round is highlighted.
 *   - The final frame reports the converged bandwidth and delay estimates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BbrInput {
    capacity?: number;
    baseRtt?: number;
    rounds?: number;
}

const PROBE_GAINS = [1.25, 0.75, 1, 1, 1, 1, 1, 1];
const STARTUP_GAIN = 2 / Math.LN2;
const DRAIN_GAIN = Math.LN2 / 2;

interface RoundRecord {
    mode: string;
    gain: number;
    pacingRate: number;
    cwnd: number;
    offered: number;
    delivered: number;
    btlBw: number;
    rtprop: number;
    observedRtt: number;
    queue: number;
}

/** Build bandwidth-estimate bars colored by phase. */
function makeBars(history: RoundRecord[], rounds: number, current: number): VisualEntity[] {
    return Array.from({ length: rounds }, (_, index) => {
        const record = history[index];
        let state: EntityState = "idle";
        if (record) {
            state = index === current ? "comparing" : "sorted";
            if (record.mode === "PROBE_RTT") state = "highlight";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: record ? `r${index} ${record.mode}: ${record.btlBw.toFixed(2)}` : `r${index}`,
            value: record?.btlBw ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, mode: record?.mode ?? "idle" },
        };
    });
}

/** The BBR generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BbrInput | null) ?? {};
    const capacity = typeof task.capacity === "number" && task.capacity > 0 ? task.capacity : 10;
    const baseRtt = typeof task.baseRtt === "number" && task.baseRtt > 0 ? task.baseRtt : 4;
    const rounds = typeof task.rounds === "number" ? Math.min(80, Math.max(1, Math.floor(task.rounds))) : 24;

    let btlBw = 2;
    let rtprop = Infinity;
    let queue = 0;
    let mode = "STARTUP";
    let startupPlateau = 0;
    let drainRounds = 0;
    let cycleIndex = 0;
    let probeRttRounds = 0;
    let previousBtlBw = btlBw;
    const bwWindow: number[] = [];
    const rttWindow: number[] = [];
    const history: RoundRecord[] = [];

    for (let round = 0; round < rounds; round += 1) {
        let gain: number;
        let cwndCap = Infinity;
        if (mode === "STARTUP") gain = STARTUP_GAIN;
        else if (mode === "DRAIN") gain = DRAIN_GAIN;
        else if (mode === "PROBE_RTT") {
            gain = 1;
            cwndCap = 4;
        } else {
            gain = PROBE_GAINS[cycleIndex % PROBE_GAINS.length] as number;
        }
        const pacingRate = gain * btlBw;
        const rtForCwnd = Number.isFinite(rtprop) ? rtprop : 1;
        const cwnd = Math.max(4, Math.min(cwndCap, gain * btlBw * rtForCwnd));
        const offered = Math.min(pacingRate, cwnd);
        const delivered = Math.min(offered, capacity);
        queue = Math.max(0, queue + offered - capacity);
        const observedRtt = baseRtt + queue / capacity;

        bwWindow.push(delivered);
        if (bwWindow.length > 10) bwWindow.shift();
        rttWindow.push(observedRtt);
        if (rttWindow.length > 10) rttWindow.shift();
        btlBw = Math.max(...bwWindow);
        rtprop = Math.min(...rttWindow);

        if (mode === "STARTUP") {
            startupPlateau = btlBw <= previousBtlBw * 1.01 ? startupPlateau + 1 : 0;
            if (startupPlateau >= 2) {
                mode = "DRAIN";
                drainRounds = 0;
            }
        } else if (mode === "DRAIN") {
            drainRounds += 1;
            if (drainRounds >= 2) {
                mode = "PROBE_BW";
                cycleIndex = 0;
            }
        } else if (mode === "PROBE_BW") {
            cycleIndex += 1;
            if (round > 0 && round % 10 === 0) {
                mode = "PROBE_RTT";
                probeRttRounds = 0;
            }
        } else {
            probeRttRounds += 1;
            if (probeRttRounds >= 2 && queue === 0) mode = "PROBE_BW";
        }
        previousBtlBw = btlBw;

        const record: RoundRecord = { mode, gain, pacingRate, cwnd, offered, delivered, btlBw, rtprop, observedRtt, queue };
        history.push(record);
        yield {
            stepNumber: round,
            entities: makeBars(history, rounds, round),
            edges: [],
            description: `Round ${round}: ${mode}, gain ${gain.toFixed(2)}, pacing ${pacingRate.toFixed(2)}, cwnd ${cwnd.toFixed(2)}, delivered ${delivered.toFixed(2)}, BtlBw ${btlBw.toFixed(2)}, RTprop ${rtprop.toFixed(2)}, queue ${queue.toFixed(2)}.`,
            codeLineNumber: mode === "STARTUP" ? 2 : mode === "DRAIN" ? 4 : mode === "PROBE_RTT" ? 6 : 5,
            layout: "array",
            meta: {
                capacity,
                baseRtt,
                rounds,
                modes: history.map((r) => r.mode),
                gains: history.map((r) => r.gain),
                pacingRates: history.map((r) => r.pacingRate),
                cwnds: history.map((r) => r.cwnd),
                delivered: history.map((r) => r.delivered),
                btlBws: history.map((r) => r.btlBw),
                rtprops: history.map((r) => r.rtprop),
                observedRtts: history.map((r) => r.observedRtt),
                queues: history.map((r) => r.queue),
                finalBtlBw: btlBw,
                finalRtprop: rtprop,
                mode,
            },
        };
    }
}

/** The TCP BBR module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Loss-based congestion control only discovers the bottleneck after filling a queue and overflowing it. BBR instead watches how fast acknowledgments return and how long the round trip takes. The highest recent delivery rate estimates the bottleneck bandwidth, the lowest recent round trip estimates the propagation delay, and their product tells BBR how much data can be in flight before a queue forms.",
        invariants: [
            "The bandwidth estimate is the maximum delivery rate in the recent window.",
            "The delay estimate is the minimum observed round-trip time in the recent window.",
            "Delivered traffic never exceeds the bottleneck capacity.",
        ],
        correctness:
            "When the sending rate is below capacity, the delivery rate equals the offered rate and grows during STARTUP's multiplicative gain; once it reaches capacity, delivered packets plateau at the bottleneck bandwidth and the max filter locks onto that value. Queueing delay raises the observed RTT above the propagation delay, so the min filter recovers the true base RTT whenever the queue drains, which PROBE_RTT forces by capping the window. Pacing at the bandwidth estimate with a bandwidth-delay-product window keeps the pipe full without sustained queue growth.",
        complexityRationale:
            "Each round performs a constant number of arithmetic operations and updates fixed-size windows of ten samples, so the simulation is O(rounds) time and O(rounds) space for the recorded history.",
        uses: [
            "Congestion control in modern TCP stacks and QUIC",
            "High-bandwidth, high-delay links where loss-based control underutilizes capacity",
            "Reducing bufferbloat by avoiding persistent queue growth",
        ],
        references: [
            "Cardwell et al., BBR: Congestion-Based Congestion Control, 2017",
            "Cardwell, Cheng, and Yeganeh, RFC 9002: QUIC Loss Detection and Congestion Control, 2021",
        ],
        workedExample:
            "With a bottleneck of 10 packets per round and a base RTT of four rounds, BBR starts its bandwidth estimate at 2 and applies a STARTUP gain near 2.89. Delivery climbs to 10, the plateau ends STARTUP, DRAIN empties the queue, and PROBE_BW then cycles gains around one while an occasional PROBE_RTT phase refreshes the delay estimate at four rounds.",
    },
    id: "tcp-bbr",
    name: "TCP BBR Congestion Control",
    category: "production-systems",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { capacity: 10, baseRtt: 4, rounds: 24 },
    visualType: "array",
    run,
    pseudocode: [
        "read the bottleneck capacity and base round-trip time",
        "initialize bandwidth and delay estimates",
        "choose a pacing gain from the current phase",
        "pace packets and deliver what the link can carry",
        "update bandwidth from the delivery-rate maximum",
        "update delay from the round-trip minimum",
        "advance the STARTUP, DRAIN, and probe phases",
        "done: report the estimates and phase history",
    ],
};

export default module;
