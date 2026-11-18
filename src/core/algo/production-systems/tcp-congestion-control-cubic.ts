/**
 * tcp-congestion-control-cubic.ts - TCP CUBIC Congestion Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CUBIC is the default TCP congestion control in modern Linux. After a loss it
 * cuts the congestion window, then grows it again along a cubic function of
 * elapsed time: slow at first, fast in the middle, and flattening near the
 * previous maximum. A linear TCP-friendly term keeps CUBIC fair with Reno.
 * The multiplicative decrease uses beta = 0.2, so the window drops to 0.8 of
 * its value at loss.
 *
 * This is a small deterministic teaching simulator over discrete rounds with
 * scripted loss events. The window formula is exact; real CUBIC also handles
 * RTT scaling, delayedACK epochs, and estimation of the TCP-friendly region.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds) for the simulated timeline
 *   Space: O(rounds) for the window history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per round shows the congestion window at that round.
 *   - A loss round is red, the current round is yellow, past rounds are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CubicInput {
    wMax?: number;
    beta?: number;
    C?: number;
    rounds?: number;
    losses?: number[];
}

function kPoint(wMax: number, beta: number, C: number): number {
    return Math.cbrt((wMax * beta) / C);
}

function cubicWindow(t: number, wMax: number, beta: number, C: number): number {
    const k = kPoint(wMax, beta, C);
    return C * (t - k) ** 3 + wMax;
}

function tcpFriendlyWindow(t: number, wMax: number, beta: number): number {
    return wMax * (1 - beta) + beta * t;
}

function makeBars(history: number[], rounds: number, current: number, losses: number[]): VisualEntity[] {
    return Array.from({ length: rounds }, (_, index) => {
        let state: EntityState = "idle";
        if (index < history.length) {
            state = losses.includes(index) ? "error" : index === current ? "comparing" : "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `r${index}: ${(history[index] ?? 0).toFixed(2)}`,
            value: history[index] ?? 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, k: index },
        };
    });
}

/** The CUBIC congestion window generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CubicInput | null) ?? {};
    const beta0 = typeof task.beta === "number" ? Math.min(0.5, Math.max(0.01, task.beta)) : 0.2;
    const C = typeof task.C === "number" && task.C > 0 ? task.C : 0.4;
    const rounds = typeof task.rounds === "number" ? Math.min(60, Math.max(1, Math.floor(task.rounds))) : 12;
    const losses = Array.isArray(task.losses) ? [...new Set(task.losses.map((l) => Math.abs(Math.floor(l))))] : [6];
    const decrease = 1 - beta0;

    let wMax = typeof task.wMax === "number" && task.wMax > 0 ? task.wMax : 10;
    let epochStart = 0;
    let cwnd = cubicWindow(0, wMax, beta0, C);
    const history: number[] = [];
    const wMaxHistory: number[] = [];

    for (let round = 0; round < rounds; round += 1) {
        if (round > 0) {
            const t = round - epochStart;
            cwnd = Math.max(cubicWindow(t, wMax, beta0, C), tcpFriendlyWindow(t, wMax, beta0), wMax * decrease);
        }
        const k = kPoint(wMax, beta0, C);
        const cubicNow = cubicWindow(round - epochStart, wMax, beta0, C);
        const tcpNow = tcpFriendlyWindow(round - epochStart, wMax, beta0);
        let lossNow = false;
        if (losses.includes(round)) {
            wMax = cwnd;
            cwnd = cwnd * decrease;
            epochStart = round;
            lossNow = true;
        }
        history.push(cwnd);
        wMaxHistory.push(wMax);
        yield {
            stepNumber: round,
            entities: makeBars(history, rounds, round, losses),
            edges: [],
            description: `Round ${round}: cwnd ${cwnd.toFixed(3)} (cubic ${cubicNow.toFixed(3)}, TCP-friendly ${tcpNow.toFixed(3)})${lossNow ? ", loss: window cut to 0.8 of its peak" : ""}.`,
            codeLineNumber: lossNow ? 4 : 2,
            layout: "array",
            meta: {
                rounds,
                beta: beta0,
                C,
                losses: [...losses].sort((a, b) => a - b),
                cwndHistory: [...history],
                wMaxHistory: [...wMaxHistory],
                k,
                cubicNow,
                tcpNow,
                lossNow,
                lastCwnd: cwnd,
                lastWMax: wMax,
            },
        };
    }
}

/** The TCP CUBIC module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "After a packet loss, CUBIC remembers the largest window it reached and resumes growth on a cubic curve. Growth is deliberately slow near the old ceiling, fastest in the middle, then gentle again as it approaches a new record. A straight TCP-friendly line acts as a floor so CUBIC does not starve ordinary Reno flows.",
        invariants: [
            "The multiplicative decrease sets the window to 0.8 of its pre-loss value.",
            "Between losses the window is the maximum of the cubic and TCP-friendly curves.",
            "The cubic curve passes through the post-loss window at time zero.",
        ],
        correctness:
            "With K defined as the cube root of Wmax times beta over C, the cubic term C(t-K)^3 vanishes at t = K, so the curve peaks at Wmax. At t = 0 it equals Wmax minus C times K cubed, which is Wmax times (1 - beta), exactly the post-loss window. Taking the maximum with the linear TCP-friendly term preserves the floor, so the modeled window matches the CUBIC definition at every round.",
        complexityRationale:
            "Each round evaluates a constant number of arithmetic expressions and appends to the history, so the simulation is O(rounds) time and O(rounds) space.",
        uses: [
            "The default congestion control in modern Linux TCP stacks",
            "High-bandwidth, high-delay networks where Reno recovers too slowly",
            "A teaching model for multiplicative decrease and cubic growth",
        ],
        references: [
            "Rhee, Xu, and Ha, CUBIC: A New TCP-Friendly High-Speed TCP Variant, 2008",
            "Peterson and Davie, Computer Networks, Chapter 5",
        ],
        workedExample:
            "Starting from a peak window of 10 with beta 0.2 and C 0.4, K is about 1.71 and the window after loss is 8. After roughly 1.7 rounds the cubic term reaches the old peak of 10, and by several rounds later the window has climbed well beyond it before the next loss cuts it again.",
    },
    id: "tcp-congestion-control-cubic",
    name: "TCP CUBIC Congestion Control",
    category: "production-systems",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { wMax: 10, beta: 0.2, C: 0.4, rounds: 12, losses: [6] },
    visualType: "array",
    run,
    pseudocode: [
        "read the peak window, beta, C, and loss rounds",
        "for each simulated round",
        "set time since the last loss and compute K",
        "compute the cubic window and the TCP-friendly line",
        "take the larger as the current window",
        "on a loss, save the peak and cut the window",
        "done: report the window history",
    ],
};

export default module;
