/**
 * convolutional-code.ts - Rate 1/2 Convolutional Code with Viterbi Decoding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A rate 1/2, constraint-length-3 convolutional encoder turns each input bit
 * into two output bits using generator polynomials 111 and 101. Two zero tail
 * bits flush the shift register. The Viterbi decoder walks the four-state
 * trellis with Hamming branch metrics, keeps the best path into each state and
 * backtracks from the forced zero end state to recover the message.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * 4 * 2) for decoding, O(steps) for encoding
 *   Space: O(steps * 4) for the backtracking tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Four bars show the best cumulative path metric for each trellis state.
 *   - The bar with the smallest metric is highlighted at every step.
 *   - The final frame reports the recovered bit sequence.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INF = 1e9;

/** Convolve a bit stream with generators 111 and 101, then flush two zeros. */
function encodeBits(bits: number[]): number[] {
    let p1 = 0;
    let p2 = 0;
    const out: number[] = [];
    for (const b of [...bits, 0, 0]) {
        out.push(b ^ p1 ^ p2, b ^ p2);
        p2 = p1;
        p1 = b;
    }
    return out;
}

/** Trellis branch: outputs and next state for a given state and input bit. */
function branch(state: number, bit: number): { o1: number; o2: number; next: number } {
    const p1 = (state >> 1) & 1;
    const p2 = state & 1;
    return { o1: bit ^ p1 ^ p2, o2: bit ^ p2, next: (bit << 1) | p1 };
}

/** Four metric bars for the current trellis depths. */
function buildEntities(metrics: number[], best: number): VisualEntity[] {
    return metrics.map((metric, state) => ({
        id: `state-${state}`,
        type: "bar" as const,
        label: `${state}:${metric >= INF ? "x" : metric}`,
        value: metric >= INF ? 0 : 100 - metric,
        state: (state === best ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { state, metric: metric >= INF ? -1 : metric },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number[]; flips?: number[] } | null) ?? {};
    const bits: number[] = Array.isArray(task.bits)
        ? task.bits.map((b) => (b === 1 ? 1 : 0))
        : [1, 0, 1, 1, 0, 1];
    const flips: number[] = Array.isArray(task.flips) ? task.flips : [];
    const steps = bits.length + 2;
    const clean = encodeBits(bits);
    const received = [...clean];
    for (const index of flips) {
        if (index >= 0 && index < received.length) received[index] = 1 - (received[index] as number);
    }

    let metrics: number[] = [0, INF, INF, INF];
    const prevState: number[][] = [];
    const prevBit: number[][] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(metrics, 0),
        edges: [],
        description: `Encoding ${bits.length} bit(s) into ${clean.length} channel bits; start Viterbi over ${steps} trellis steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { bits, clean, received, flips: [...flips], phase: "start", metrics: [...metrics] },
    };

    for (let t = 0; t < steps; t += 1) {
        const r1 = received[2 * t] as number;
        const r2 = received[2 * t + 1] as number;
        const nextMetrics = [INF, INF, INF, INF];
        const fromState = [-1, -1, -1, -1];
        const fromBit = [-1, -1, -1, -1];
        for (let s = 0; s < 4; s += 1) {
            const metric = metrics[s] as number;
            if (metric >= INF) continue;
            for (const b of [0, 1]) {
                const { o1, o2, next } = branch(s, b);
                const cost = (o1 === r1 ? 0 : 1) + (o2 === r2 ? 0 : 1);
                const candidate = metric + cost;
                if (candidate < (nextMetrics[next] as number)) {
                    nextMetrics[next] = candidate;
                    fromState[next] = s;
                    fromBit[next] = b;
                }
            }
        }
        metrics = nextMetrics;
        prevState.push(fromState);
        prevBit.push(fromBit);
        let best = 0;
        for (let s = 1; s < 4; s += 1) {
            if ((metrics[s] as number) < (metrics[best] as number)) best = s;
        }
        yield {
            stepNumber: step++,
            entities: buildEntities(metrics, best),
            edges: [],
            description: `Trellis step ${t}: received ${r1}${r2}; best cumulative metric ${metrics[best]} in state ${best}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                bits,
                received,
                phase: "step",
                t,
                bestState: best,
                bestMetric: metrics[best],
                metrics: [...metrics],
            },
        };
    }

    let state = 0;
    const traced: number[] = [];
    for (let t = steps - 1; t >= 0; t -= 1) {
        const b = prevBit[t]?.[state] ?? 0;
        traced.push(b);
        state = prevState[t]?.[state] ?? 0;
    }
    traced.reverse();
    const decoded = traced.slice(0, bits.length);
    const errors = decoded.reduce((sum, b, i) => sum + (b === bits[i] ? 0 : 1), 0);

    yield {
        stepNumber: step++,
        entities: buildEntities(metrics, 0),
        edges: [],
        description: `Backtracked from state 0: decoded [${decoded.join("")}] with ${errors} bit error(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { bits, decoded, errors, finalMetrics: [...metrics], phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A convolutional encoder remembers the last two input bits, so each output pair depends on three bits and every message bit influences several channel symbols. The Viterbi decoder treats the trellis of encoder states as a graph, keeps the lowest-distance path reaching each state, and finally follows the cheapest path backward to the message.",
        invariants: [
            "Each trellis branch emits exactly two bits determined by the state and input bit.",
            "At every depth each state stores the minimum Hamming distance of any path ending there.",
            "The two tail bits force the encoder back to state zero, fixing the backtracking endpoint.",
        ],
        correctness:
            "The Viterbi recursion is a dynamic program over the trellis: the best path into a state at depth t must extend some best path into a predecessor state at depth t-1, so considering only one best path per state is sufficient. Backtracking from the forced zero end state therefore returns the codeword with minimum Hamming distance to the received sequence, which is the maximum-likelihood message on a binary symmetric channel.",
        complexityRationale:
            "Encoding emits two bits per input and touches four states per trellis step with two outgoing branches each, giving O(steps) time and O(steps * 4) space for the predecessor tables.",
        uses: [
            "Error correction in deep-space and satellite links",
            "Convolutional coding in GSM and early wireless standards",
            "Teaching maximum-likelihood sequence estimation on trellises",
        ],
        references: [
            "Viterbi, Error Bounds for Convolutional Codes, 1967",
            "Proakis, Digital Communications, chapter on convolutional codes",
        ],
        workedExample:
            "For a single input bit 1 from state 00, the 111 generator gives 1 xor 0 xor 0 = 1 and the 101 generator gives 1 xor 0 = 1, so the first output pair is 11 and the next state is 10.",
    },
    id: "convolutional-code",
    name: "Convolutional Code (Viterbi Decoding)",
    category: "cryptography-security",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: { bits: [1, 0, 1, 1, 0, 1], flips: [3] },
    visualType: "array",
    run,
    pseudocode: [
        "encode the message with generators 111 and 101 and flush two zeros",
        "start the trellis with distance zero in state zero and infinity elsewhere",
        "for each received pair and every reachable state",
        "try both input bits, add the Hamming branch cost, relax the next state",
        "after the final step choose the path that ends in state zero",
        "backtrack through the stored predecessors to the first step",
        "done: report the recovered message bits and error count",
    ],
};

export default module;
