/**
 * tcp-congestion-control-reno.ts - TCP Reno Congestion Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TCP Reno grows its congestion window to probe available bandwidth and shrinks
 * it when loss signals congestion. In slow start the window doubles each round
 * until it reaches the slow-start threshold; then congestion avoidance adds one
 * segment per round. A timeout resets the window to one and halves the
 * threshold, while three duplicate acknowledgments trigger fast retransmit and
 * fast recovery, halving the threshold but keeping a larger window.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) for the simulated rounds
 *   Space: O(rounds) for the recorded window series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per round shows the congestion window in segments.
 *   - The round with the loss event is highlighted in the caption.
 *   - meta carries the window, threshold, and phase of every round.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build congestion-window bars. */
function makeBars(
    windows: number[],
    phases: string[],
    current: number,
    lossRound: number,
    done: boolean,
): VisualEntity[] {
    return windows.map((window, index) => {
        let state: EntityState = "idle";
        if (index === lossRound) {
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

/** The TCP Reno generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ssthresh?: number; rounds?: number; lossRound?: number; lossType?: string } | null) ?? {};
    const initialThreshold = Math.max(2, Math.floor(Number(task.ssthresh ?? 8)) || 8);
    const rounds = Math.min(30, Math.max(2, Math.floor(Number(task.rounds ?? 12)) || 12));
    const lossRound = Number.isFinite(Number(task.lossRound)) ? Math.floor(Number(task.lossRound)) : 6;
    const lossType = task.lossType === "triple-dup" ? "triple-dup" : "timeout";

    let cwnd = 1;
    let threshold = initialThreshold;
    let recoveryExit = -1;
    let phase = "slow-start";
    const windows: number[] = [];
    const thresholds: number[] = [];
    const phases: string[] = [];
    const events: string[] = [];

    const buildMeta = (phaseLabel: string) => ({
        phase: phaseLabel,
        ssthresh: initialThreshold,
        rounds,
        lossRound,
        lossType,
        cwndSeries: [...windows],
        thresholdSeries: [...thresholds],
        phaseSeries: [...phases],
        events: [...events],
        currentCwnd: cwnd,
        currentThreshold: threshold,
    });

    yield {
        stepNumber: 0,
        entities: makeBars([], [], -1, lossRound, false),
        edges: [],
        description: `TCP Reno with initial threshold ${initialThreshold}; ${rounds} round(s), ${lossType} loss at round ${lossRound}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: buildMeta("setup"),
    };

    let step = 1;
    for (let round = 0; round < rounds; round += 1) {
        if (round === recoveryExit) {
            cwnd = threshold;
            recoveryExit = -1;
            events.push(`round ${round}: exit fast recovery to cwnd ${cwnd}`);
        }
        windows.push(cwnd);
        thresholds.push(threshold);
        phases.push(phase);

        if (round === lossRound) {
            threshold = Math.max(2, Math.floor(cwnd / 2));
            if (lossType === "timeout") {
                cwnd = 1;
                phase = "slow-start";
                events.push(`round ${round}: timeout, threshold ${threshold}, cwnd reset to 1`);
            } else {
                cwnd = threshold + 3;
                phase = "fast-recovery";
                recoveryExit = round + 2;
                events.push(`round ${round}: triple duplicate ack, threshold ${threshold}, cwnd ${cwnd}`);
            }
        } else if (cwnd < threshold) {
            cwnd *= 2;
            phase = "slow-start";
        } else {
            cwnd += 1;
            phase = "congestion-avoidance";
        }

        yield {
            stepNumber: step,
            entities: makeBars(windows, phases, round, lossRound, false),
            edges: [],
            description: `Round ${round}: cwnd ${windows[round]}, threshold ${thresholds[round]}, phase ${phases[round]}${round === lossRound ? `, ${lossType} loss event` : ""}.`,
            codeLineNumber: round === lossRound ? 3 : 2,
            layout: "array",
            meta: buildMeta(phase),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(windows, phases, -1, lossRound, true),
        edges: [],
        description: `Reno simulated ${rounds} round(s); final window ${windows[windows.length - 1] ?? 0}, threshold ${threshold}. Loss handling: ${lossType}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: buildMeta("done"),
    };
}

/** The TCP Reno module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A sender probes how much the network can carry by growing a window of unacknowledged segments. It starts fast, doubling each round, then slows to a steady linear climb once it has an estimate of the capacity. When packets are lost it backs off sharply for a timeout or gently for three duplicate acknowledgments, then climbs again.",
        invariants: [
            "In slow start the congestion window doubles each round.",
            "In congestion avoidance the congestion window grows by one each round.",
            "A loss event halves the slow-start threshold.",
        ],
        correctness:
            "Reno's state machine is defined by exactly these transitions: while the window is below the threshold, each acknowledgment round doubles it; at or above the threshold it increases by one; a timeout sets the threshold to half the current window and the window to one; three duplicate acknowledgments set the threshold to half and enter fast recovery with window threshold plus three, leaving recovery at the threshold after the missing segment is acknowledged. The simulator applies those rules in round order, so its window series is the definition of Reno behavior for the given loss schedule.",
        complexityRationale:
            "Each round performs a constant number of arithmetic operations and records one sample, so r rounds take O(r) time and O(r) space for the displayed series.",
        uses: [
            "Modeling sender behavior in congestion studies",
            "Teaching the slow-start and congestion-avoidance phases",
            "Comparing loss responses across TCP variants",
        ],
        references: [
            "Jacobson, Congestion Avoidance and Control, 1988",
            "Stevens, TCP/IP Illustrated, Volume 1, Chapter 21",
        ],
        workedExample:
            "With threshold 8, the window follows 1, 2, 4, 8, 9, 10, 11. A timeout at round 6 halves the threshold to 5 and resets the window to 1, after which it climbs 1, 2, 4, 8, 9. With three duplicate acknowledgments instead, the window would drop to 8 and resume at 5 after fast recovery.",
    },
    id: "tcp-congestion-control-reno",
    name: "TCP Congestion Control (Reno)",
    category: "production-systems",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { ssthresh: 8, rounds: 12, lossRound: 6, lossType: "timeout" },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the congestion window to one and set the threshold",
        "for each transmission round",
        "if in slow start double the window, else add one",
        "on timeout halve the threshold and reset the window to one",
        "on three duplicate acks halve the threshold and enter fast recovery",
        "exit fast recovery at the new threshold",
        "done: report the congestion window over all rounds",
    ],
};

export default module;
