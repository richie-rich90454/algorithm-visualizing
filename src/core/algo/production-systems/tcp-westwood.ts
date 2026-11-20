/**
 * tcp-westwood.ts - TCP Westwood Congestion Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TCP Westwood improves Reno by measuring the rate at which acknowledgments
 * return. That rate estimates the available bandwidth. On three duplicate
 * acknowledgments it sets the slow-start threshold and the congestion window
 * to the estimated bandwidth-delay product instead of blindly halving the
 * window. On a timeout it still restarts from one segment but keeps the
 * bandwidth-derived threshold, which recovers much faster on lossy wireless
 * links where losses are not caused by congestion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(rounds)
 *   Space: O(rounds) for the recorded series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per round encodes the congestion window.
 *   - A duplicate-acknowledgment loss is amber, a timeout loss is red.
 *   - meta carries the bandwidth estimate, threshold, and phase per round.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export type LossType = "none" | "dupack" | "timeout";

export interface WestwoodStep {
    round: number;
    cwnd: number;
    ssthresh: number;
    bandwidth: number;
    rttMin: number;
    loss: LossType;
    phase: "slow-start" | "congestion-avoidance" | "fast-recovery" | "restart";
}

/** Compute the bandwidth-delay threshold used after a loss. */
export function westwoodThreshold(bandwidth: number, rttMin: number): number {
    return Math.max(2, Math.floor(bandwidth * rttMin));
}

/** Advance one TCP Westwood round from the given sender state. */
export function westwoodStep(
    round: number,
    acked: number,
    rtt: number,
    loss: LossType,
    state: { cwnd: number; ssthresh: number; bandwidth: number; rttMin: number },
): { next: { cwnd: number; ssthresh: number; bandwidth: number; rttMin: number }; step: WestwoodStep } {
    const rttMin = Math.min(state.rttMin, rtt);
    const bandwidth = state.bandwidth === 0 ? acked / rtt : 0.7 * state.bandwidth + 0.3 * (acked / rtt);
    let cwnd = state.cwnd;
    let ssthresh = state.ssthresh;
    let phase: WestwoodStep["phase"];
    if (loss === "dupack") {
        ssthresh = westwoodThreshold(bandwidth, rttMin);
        cwnd = ssthresh;
        phase = "fast-recovery";
    } else if (loss === "timeout") {
        ssthresh = westwoodThreshold(bandwidth, rttMin);
        cwnd = 1;
        phase = "restart";
    } else if (cwnd < ssthresh) {
        cwnd = Math.min(1024, cwnd * 2);
        phase = "slow-start";
    } else {
        cwnd = Math.min(1024, cwnd + 1);
        phase = "congestion-avoidance";
    }
    const next = { cwnd, ssthresh, bandwidth, rttMin };
    return { next, step: { round, cwnd, ssthresh, bandwidth, rttMin, loss, phase } };
}

function makeBars(steps: WestwoodStep[], active: number): VisualEntity[] {
    return steps.map((step, index) => {
        let state: EntityState = "idle";
        if (step.loss === "timeout") state = "error";
        else if (step.loss === "dupack") state = "pivot";
        else if (index === active) state = "comparing";
        else if (index === steps.length - 1) state = "sorted";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `r${step.round}:cwnd=${step.cwnd}`,
            value: step.cwnd,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, round: step.round, cwnd: step.cwnd, ssthresh: step.ssthresh, phase: step.phase },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        rounds?: number;
        initialSsthresh?: number;
        acked?: number[];
        rtts?: number[];
        losses?: LossType[];
    } | null) ?? {};
    const rounds = Math.min(40, Math.max(2, Math.floor(Number(task.rounds ?? 12)) || 12));
    const acked = Array.isArray(task.acked) && task.acked.length > 0
        ? task.acked.map((v) => Math.max(1, Number(v) || 1))
        : Array.from({ length: rounds }, (_, i) => 4 + (i % 4) * 2);
    const rtts = Array.isArray(task.rtts) && task.rtts.length > 0
        ? task.rtts.map((v) => Math.max(0.1, Number(v) || 1))
        : Array.from({ length: rounds }, (_, i) => 10 + (i % 3));
    const losses: LossType[] = Array.isArray(task.losses)
        ? task.losses.map((v) => (v === "dupack" || v === "timeout" ? v : "none"))
        : Array.from({ length: rounds }, (_, i) => (i === 6 ? "dupack" : i === 10 ? "timeout" : "none"));

    let state = {
        cwnd: 1,
        ssthresh: Math.max(2, Math.floor(Number(task.initialSsthresh ?? 8)) || 8),
        bandwidth: 0,
        rttMin: Number.POSITIVE_INFINITY,
    };
    const steps: WestwoodStep[] = [];
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: [],
        edges: [],
        description: `TCP Westwood over ${rounds} round(s) with initial threshold ${state.ssthresh}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rounds, windows: [], thresholds: [], bandwidths: [], phases: [], losses: [] },
    };
    stepNumber += 1;

    for (let round = 0; round < rounds; round += 1) {
        const result = westwoodStep(round, acked[round] ?? 4, rtts[round] ?? 10, losses[round] ?? "none", state);
        state = result.next;
        steps.push(result.step);
        yield {
            stepNumber: stepNumber,
            entities: makeBars(steps, steps.length - 1),
            edges: [],
            description: `Round ${round}: ${result.step.phase}, cwnd ${state.cwnd}, bandwidth estimate ${state.bandwidth.toFixed(2)}${result.step.loss === "none" ? "" : ` (${result.step.loss} loss)`}.`,
            codeLineNumber: result.step.loss === "dupack" ? 3 : result.step.loss === "timeout" ? 4 : result.step.phase === "slow-start" ? 5 : 6,
            layout: "array",
            meta: {
                rounds,
                windows: steps.map((s) => s.cwnd),
                thresholds: steps.map((s) => s.ssthresh),
                bandwidths: steps.map((s) => s.bandwidth),
                phases: steps.map((s) => s.phase),
                losses: steps.map((s) => s.loss),
                finalWindow: state.cwnd,
            },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber: stepNumber,
        entities: makeBars(steps, -1),
        edges: [],
        description: `Westwood finished after ${rounds} round(s) with final window ${state.cwnd} and threshold ${state.ssthresh}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            rounds,
            windows: steps.map((s) => s.cwnd),
            thresholds: steps.map((s) => s.ssthresh),
            bandwidths: steps.map((s) => s.bandwidth),
            phases: steps.map((s) => s.phase),
            losses: steps.map((s) => s.loss),
            finalWindow: state.cwnd,
            finalThreshold: state.ssthresh,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A lost packet on a wireless link is often corruption, not congestion, so halving the window wastes capacity. Westwood listens to the returning acknowledgments to estimate how much bandwidth the path actually offers. When loss is reported it resets the window to that measured bandwidth-delay product, which keeps the pipe full while still backing off compared with the pre-loss rate.",
        invariants: [
            "The bandwidth estimate is an exponential moving average of acknowledged segments per unit time.",
            "After either loss type the slow-start threshold equals the bandwidth-delay product, with a floor of two.",
            "A duplicate-acknowledgment loss resumes at the threshold, while a timeout restarts at one segment.",
        ],
        correctness:
            "The acknowledgment clock measures the actual delivery rate, so the bandwidth-delay product is the number of segments needed to keep the path busy. Setting the post-loss window to that value restarts at the largest provably safe rate rather than an arbitrary fraction. Because the estimate is smoothed, transient acknowledgment bursts cannot inflate it enough to overwhelm the network.",
        complexityRationale:
            "Every round updates a constant number of sender variables and emits one frame, so time is O(rounds). Recording the window, threshold, bandwidth, and phase arrays uses linear space.",
        uses: [
            "Congestion control on lossy wireless and satellite links",
            "Fast recovery after sporadic non-congestion losses",
            "Teaching bandwidth-delay product estimation",
        ],
        references: [
            "Casetti and Gerla, TCP Westwood: Bandwidth Estimation for Enhanced Transport, 2001",
            "Stevens, TCP Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery, RFC 2001",
        ],
        workedExample:
            "If acknowledgments report 12 segments over a 10-millisecond round trip, the bandwidth estimate is 1.2 segments per millisecond. With a minimum round trip of 10, the post-loss threshold is 12. Three duplicate acknowledgments set the window to 12, whereas a timeout resets it to 1 but keeps the threshold at 12.",
    },
    id: "tcp-westwood",
    name: "TCP Westwood",
    category: "production-systems",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { rounds: 12, initialSsthresh: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "set window to one and threshold to the initial value",
        "for each round trip measure acknowledged segments and round trip time",
        "update the bandwidth estimate as a smoothed acknowledgment rate",
        "on three duplicate acknowledgments set window and threshold to the bandwidth delay product",
        "on a timeout set window to one and threshold to the bandwidth delay product",
        "otherwise double the window below the threshold",
        "at or above the threshold grow the window by one segment",
        "record the window, threshold, bandwidth and phase for this round",
        "done: report the final window and threshold",
    ],
};

export default module;
