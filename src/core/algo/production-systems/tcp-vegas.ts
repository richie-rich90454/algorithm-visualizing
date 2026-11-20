/**
 * tcp-vegas.ts - TCP Vegas Delay-Based Congestion Control
 *
 * Vegas detects congestion from round-trip time instead of loss. It compares
 * the throughput the window should achieve at the base round-trip time with
 * the throughput actually observed. A small gap means there is spare capacity
 * and the window grows; a large gap means queues are building and the window
 * shrinks. A middle band holds the window steady.
 *
 * Time O(rounds) for the simulated round trips, space O(rounds) for the log.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface VegasInput {
    rtts?: number[];
    baseRtt?: number;
    cwnd?: number;
    alpha?: number;
    beta?: number;
    gamma?: number;
}

export interface VegasStep {
    round: number;
    rtt: number;
    expected: number;
    actual: number;
    diff: number;
    cwnd: number;
    phase: string;
}

/** Simulate TCP Vegas over observed round-trip times. */
export function vegasSteps(rtts: number[], baseRtt: number, cwnd0: number, alpha: number, beta: number, gamma: number): VegasStep[] {
    let cwnd = cwnd0;
    let slowStart = true;
    return rtts.map((rtt, round) => {
        const expected = cwnd / baseRtt;
        const actual = cwnd / rtt;
        const diff = (expected - actual) * baseRtt;
        let phase: string;
        if (slowStart && diff > gamma) {
            slowStart = false;
        }
        if (slowStart) {
            cwnd = cwnd * 2;
            phase = "slow-start";
        } else if (diff < alpha) {
            cwnd = cwnd + 1;
            phase = "increase";
        } else if (diff > beta) {
            cwnd = Math.max(1, cwnd - 1);
            phase = "decrease";
        } else {
            phase = "hold";
        }
        return { round, rtt, expected, actual, diff, cwnd, phase };
    });
}

function makeBars(steps: VegasStep[], current: number, done: boolean): VisualEntity[] {
    return steps.map((step, index) => {
        let state: EntityState = "idle";
        if (done && index === steps.length - 1) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        } else if (step.phase === "decrease") {
            state = "error";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `r${index}: cwnd ${step.cwnd.toFixed(1)} (${step.phase})`,
            value: step.cwnd,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, round: index, cwnd: step.cwnd, phase: step.phase, diff: step.diff },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as VegasInput | null) ?? {};
    const rtts: number[] = Array.isArray(task.rtts) && task.rtts.length > 0
        ? task.rtts
        : [10, 10, 11, 13, 16, 18, 20, 19, 16, 14, 12, 11, 10, 10];
    const baseRtt = Math.max(1e-6, Number(task.baseRtt ?? Math.min(...rtts)));
    const cwnd0 = Math.max(1, Math.floor(Number(task.cwnd ?? 2)) || 2);
    const alpha = Math.max(0, Number(task.alpha ?? 1));
    const beta = Math.max(alpha, Number(task.beta ?? 3));
    const gamma = Math.max(beta, Number(task.gamma ?? 4));
    const steps = vegasSteps(rtts, baseRtt, cwnd0, alpha, beta, gamma);
    const base = { rounds: steps.length, baseRtt, alpha, beta, gamma, cwnd0 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(steps, -1, false),
        edges: [],
        description: `TCP Vegas over ${steps.length} round(s) with base RTT ${baseRtt.toFixed(2)} and thresholds ${alpha}/${beta}/${gamma}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, windows: [], diffs: [], phases: [] },
    };
    step += 1;

    for (let i = 0; i < steps.length; i += 1) {
        const s = steps[i]!;
        yield {
            stepNumber: step,
            entities: makeBars(steps, i, false),
            edges: [],
            description: `Round ${i}: RTT ${s.rtt.toFixed(1)}, expected ${s.expected.toFixed(2)}, actual ${s.actual.toFixed(2)}, diff ${s.diff.toFixed(2)}; ${s.phase}, cwnd ${s.cwnd.toFixed(1)}.`,
            codeLineNumber: s.phase === "slow-start" ? 2 : s.phase === "increase" ? 4 : s.phase === "decrease" ? 5 : 6,
            layout: "array",
            meta: {
                ...base,
                windows: steps.slice(0, i + 1).map((x) => x.cwnd),
                diffs: steps.slice(0, i + 1).map((x) => x.diff),
                phases: steps.slice(0, i + 1).map((x) => x.phase),
                active: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(steps, -1, true),
        edges: [],
        description: `Done: final window ${steps[steps.length - 1]?.cwnd.toFixed(1) ?? cwnd0} after ${steps.length} round(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            ...base,
            windows: steps.map((x) => x.cwnd),
            diffs: steps.map((x) => x.diff),
            phases: steps.map((x) => x.phase),
            finalWindow: steps[steps.length - 1]?.cwnd ?? cwnd0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Loss is a late signal: by the time a packet drops, queues are already full. Vegas watches delay instead. It computes the rate the current window would achieve at the smallest observed round-trip time and compares it with the rate actually measured. If the gap is tiny, the path is empty and the window grows; if the gap is large, queues are filling and the window shrinks; in between it holds. It leaves slow start when the gap grows past a third threshold.",
        invariants: [
            "Expected throughput is the window divided by the base round-trip time.",
            "Actual throughput is the window divided by the current round-trip time.",
            "The difference, expressed in packets of extra data in the pipe, is base RTT times expected minus actual and grows as queues build.",
        ],
        correctness:
            "Because the base round-trip time is the minimum observed delay, expected throughput is the best the window could do with no queuing, so expected minus actual is exactly the throughput lost to queuing. A value below alpha means the loss is negligible and growth is safe; above beta means queues are growing and a linear decrease is warranted; gamma triggers departure from exponential slow start. The tests recompute every window and difference independently, verify that the window never falls below one, and check that a rising delay eventually forces a decrease.",
        complexityRationale:
            "Each round computes a few divisions and one branch, so the simulation is O(rounds); the bar and log arrays hold one value per round, giving O(rounds) space.",
        uses: [
            "Delay-based congestion control in TCP Vegas and its successors",
            "Low-latency transport that reacts before packet loss",
            "Teaching the difference between loss-based and delay-based control",
        ],
        references: [
            "Brakmo, O'Malley, and Peterson, TCP Vegas: New Techniques for Congestion Detection and Avoidance, SIGCOMM, 1994",
            "Stevens, TCP/IP Illustrated, Volume 1, Chapter 24",
        ],
        workedExample:
            "With base RTT 10 and a window of 4, expected throughput is 0.4. If the observed RTT rises to 50, actual throughput is 0.08 and the difference, in packets, is 10 times (0.4 minus 0.08), which is 3.2. With alpha 1, beta 3, and gamma 4 that exceeds beta, so the sender cuts the window to 3 to drain the queue.",
    },
    id: "tcp-vegas",
    name: "TCP Vegas",
    category: "production-systems",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { rtts: [10, 10, 11, 13, 16, 18, 20, 19, 16, 14, 12, 11, 10, 10], baseRtt: 10, cwnd: 2, alpha: 1, beta: 3, gamma: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "set the congestion window to its initial value and stay in slow start",
        "for each observed round-trip time",
        "compute expected throughput as window over base RTT",
        "compute actual throughput as window over current RTT",
        "multiply expected minus actual by the base RTT to get a packet difference",
        "leave slow start when the difference exceeds gamma",
        "in slow start double the window, otherwise add one when below alpha",
        "subtract one when the difference exceeds beta, else hold",
        "done: report the window and difference series",
    ],
};

export default module;
