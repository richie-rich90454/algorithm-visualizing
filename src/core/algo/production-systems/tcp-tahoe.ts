/**
 * tcp-tahoe.ts - TCP Tahoe Congestion Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TCP Tahoe is the original congestion-control algorithm. It doubles the
 * congestion window each round trip in slow start, then grows it linearly in
 * congestion avoidance. On any loss it halves the threshold, resets the window
 * to one segment and restarts slow start. Unlike Reno it has no fast recovery:
 * three duplicate acknowledgments are treated the same as a timeout.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) for the simulated round trips
 *   Space: O(rounds) for the recorded window series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per round; height is the congestion window in segments.
 *   - A loss round is red and the following round restarts at one.
 *   - meta carries windows, thresholds and phases for independent checking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build congestion-window bars. */
function makeBars(windows: number[], phases: string[], lossRounds: number[], current: number, done: boolean): VisualEntity[] {
    return windows.map((window, index) => {
        let state: EntityState = "idle";
        if (lossRounds.includes(index)) {
            state = "error";
        } else if (done && index === windows.length - 1) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `r${index}:cwnd=${window}`,
            value: window,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, round: index, cwnd: window, phase: phases[index] ?? "" },
        };
    });
}

/** Simulate TCP Tahoe over a fixed number of round trips. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ssthresh?: number; rounds?: number; lossRounds?: number[] } | null) ?? {};
    const initialThreshold = Math.max(1, Math.floor(Number(task.ssthresh ?? 8)) || 8);
    const rounds = Math.min(40, Math.max(2, Math.floor(Number(task.rounds ?? 12)) || 12));
    const lossRounds = Array.isArray(task.lossRounds)
        ? [...new Set(task.lossRounds.map((r) => Math.floor(Number(r))).filter((r) => Number.isFinite(r)))]
        : [6];

    let cwnd = 1;
    let threshold = initialThreshold;
    const windows: number[] = [];
    const thresholds: number[] = [];
    const phases: string[] = [];
    let losses = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `TCP Tahoe for ${rounds} round(s), initial threshold ${threshold}, loss round(s) ${lossRounds.join(",") || "none"}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rounds, windows: [], thresholds: [], phases: [], losses: 0 },
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        let phase: string;
        if (lossRounds.includes(round)) {
            threshold = Math.max(1, Math.floor(cwnd / 2));
            cwnd = 1;
            phase = "loss-restart";
            losses += 1;
        } else if (cwnd < threshold) {
            cwnd = Math.min(1024, cwnd * 2);
            phase = "slow-start";
        } else {
            cwnd = Math.min(1024, cwnd + 1);
            phase = "congestion-avoidance";
        }
        windows.push(cwnd);
        thresholds.push(threshold);
        phases.push(phase);

        yield {
            stepNumber: step,
            entities: makeBars(windows, phases, lossRounds, windows.length - 1, false),
            edges: [],
            description: `Round ${round}: ${phase}, cwnd ${cwnd}, ssthresh ${threshold}${lossRounds.includes(round) ? " (loss detected)" : ""}.`,
            codeLineNumber: lossRounds.includes(round) ? 3 : phase === "slow-start" ? 5 : 6,
            layout: "array",
            meta: {
                rounds,
                windows: [...windows],
                thresholds: [...thresholds],
                phases: [...phases],
                losses,
                ssthresh: threshold,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(windows, phases, lossRounds, -1, true),
        edges: [],
        description: `Tahoe finished after ${rounds} round(s) with ${losses} loss event(s) and final window ${windows[windows.length - 1] ?? 1}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            rounds,
            windows: [...windows],
            thresholds: [...thresholds],
            phases: [...phases],
            losses,
            ssthresh: threshold,
            finalWindow: windows[windows.length - 1] ?? 1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with a one-segment window and double it every round until you reach the threshold, then grow by one segment per round. If a packet is ever lost, assume the path is full: cut the threshold in half, drop back to one segment and start the doubling again. Tahoe never tries to salvage a partial window after loss.",
        invariants: [
            "The window never exceeds the configured cap of 1024 segments.",
            "After a loss round the window is exactly one and the threshold is half its pre-loss value.",
            "Before the threshold the window doubles; at or beyond it the window grows by one.",
        ],
        correctness:
            "Slow start probes capacity exponentially so the pipe fills within a logarithmic number of round trips, then congestion avoidance probes gently. Any loss is treated as definitive congestion, so resetting to one and halving the threshold guarantees a safe restart. Because there is no fast-recovery path, every loss follows the same provably conservative rule.",
        complexityRationale:
            "Each of the R simulated rounds performs constant work and emits one frame, so time is O(rounds). Four arrays hold one value per round, giving linear space.",
        uses: [
            "The historical baseline for TCP congestion-control study",
            "Teaching the difference between slow start and congestion avoidance",
            "A conservative fallback when fast recovery is unavailable",
        ],
        references: [
            "Jacobson, Congestion Avoidance and Control, 1988",
            "Stevens, TCP/IP Illustrated, Volume 1, Chapter 21",
        ],
        workedExample:
            "With threshold 8 and a loss at round 5, Tahoe produces windows 1, 2, 4, 8, 8 for a no-loss prefix; at round 5 it halves the threshold to 4 and resets the window to 1, then slow starts again. A Reno sender would instead enter fast recovery and keep a larger window.",
    },
    id: "tcp-tahoe",
    name: "TCP Tahoe",
    category: "production-systems",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { ssthresh: 8, rounds: 12, lossRounds: [6] },
    visualType: "array",
    run,
    pseudocode: [
        "set congestion window to one and threshold to ssthresh",
        "for each round trip from zero to rounds minus one",
        "if this round has a loss, halve the threshold and reset window to one",
        "otherwise if window is below threshold, double the window",
        "otherwise if window is at or above threshold, add one segment",
        "record the window, threshold and phase for this round",
        "after all rounds, report the window series and loss count",
        "publish the final window and threshold in the closing frame",
    ],
};

export default module;
