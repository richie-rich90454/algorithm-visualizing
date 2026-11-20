/**
 * ctc-loss.ts - Connectionist Temporal Classification Forward Probability
 *
 * CTC sums the probability of every alignment of a label sequence onto a
 * longer input sequence. Blanks and repeated labels are handled by an extended
 * label string, and a log-space dynamic program accumulates the total mass.
 *
 * Time:  O(T * L) where T is the input length and L the label count
 * Space: O(L) for a single row of the DP table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CtcInput {
    labels: number[];
    T: number;
    logProbs: number[][];
}

const NEG_INF = -1e9;
const BLANK = -1;

/** Numerically stable log(add(exp(a), exp(b))). */
function logAddExp(a: number, b: number): number {
    if (a <= NEG_INF) {
        return b;
    }
    if (b <= NEG_INF) {
        return a;
    }
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return hi + Math.log1p(Math.exp(lo - hi));
}

/** Build blank-interleaved label string: [blank, l0, blank, l1, ..., blank]. */
function extended(labels: number[]): number[] {
    const ext: number[] = [BLANK];
    for (const label of labels) {
        ext.push(label, BLANK);
    }
    return ext;
}

function column(symbol: number, labelCount: number): number {
    return symbol === BLANK ? 0 : (symbol < labelCount ? symbol + 1 : 0);
}

function makeCells(ext: number[], alpha: number[], t: number): VisualEntity[] {
    return ext.map((symbol, s) => {
        const value = alpha[s] ?? NEG_INF;
        const state: EntityState = value <= NEG_INF ? "idle" : (s === ext.length - 1 ? "sorted" : "comparing");
        return {
            id: `cell-${s}`,
            type: "cell" as const,
            label: `${symbol === BLANK ? "blank" : `label ${symbol}`}: ${value <= NEG_INF ? "-inf" : value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: s, t },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<CtcInput> | null) ?? {};
    const labels: number[] = Array.isArray(task.labels) && task.labels.length > 0 ? task.labels : [0, 1];
    const ext = extended(labels);
    const S = ext.length;
    const logProbs: number[][] = Array.isArray(task.logProbs) && task.logProbs.length > 0
        ? task.logProbs
        : [
            [-2.3026, -0.3567, -1.6094],
            [-0.6931, -1.6094, -1.2040],
            [-1.6094, -1.2040, -0.6931],
            [-0.5108, -2.3026, -1.2040],
        ];
    const T = logProbs.length;

    let alpha = Array(S).fill(NEG_INF) as number[];
    alpha[0] = logProbs[0]?.[0] ?? 0;
    if (S > 1) {
        alpha[1] = logProbs[0]?.[column(ext[1]!, labels.length)] ?? 0;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(ext, alpha, 0),
        edges: [],
        description: `CTC forward pass over ${T} input steps for ${labels.length} label(s) with ${S} extended states.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { T, S, rows: 1, cols: S, t: 0, alpha },
    };
    step += 1;

    for (let t = 1; t < T; t += 1) {
        const next = Array(S).fill(NEG_INF) as number[];
        for (let s = 0; s < S; s += 1) {
            let best = alpha[s]!;
            if (s > 0) {
                best = logAddExp(best, alpha[s - 1]!);
            }
            if (s > 1 && ext[s] !== BLANK && ext[s] !== ext[s - 2]) {
                best = logAddExp(best, alpha[s - 2]!);
            }
            const emission = logProbs[t]?.[column(ext[s]!, labels.length)] ?? 0;
            next[s] = best + emission;
        }
        alpha = next;
        yield {
            stepNumber: step,
            entities: makeCells(ext, alpha, t),
            edges: [],
            description: `Time ${t}: extend each CTC state by staying, advancing one step, or jumping a repeated-label gap.`,
            codeLineNumber: t === T - 1 ? 4 : 3,
            layout: "grid",
            meta: { T, S, rows: 1, cols: S, t, alpha },
        };
        step += 1;
    }

    const logProbability = logAddExp(alpha[S - 1]!, alpha[S - 2]!);
    yield {
        stepNumber: step,
        entities: makeCells(ext, alpha, T - 1),
        edges: [],
        description: `Done: total log probability of the label sequence is ${logProbability.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { T, S, rows: 1, cols: S, t: T - 1, alpha, logProbability },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A speech or handwriting model emits one prediction per time step, but the transcript is shorter. CTC aligns the transcript to the input by allowing blank predictions and repeated labels. It adds up the probabilities of all alignments that collapse to the target, which turns an unsegmented sequence into a trainable likelihood.",
        invariants: [
            "The extended label string alternates blank and label symbols, starting and ending with blank.",
            "A jump of two states is allowed only when the destination is a label different from the one two steps back.",
            "Each DP cell stores the log probability of all partial alignments ending at that state after the current time step.",
        ],
        correctness:
            "The recurrence enumerates exactly the legal predecessors of each extended state: stay, advance by one, or skip a blank between two different labels. Induction on the time index shows the cell value equals the summed log probability of all partial paths ending there, because every valid extension is considered once and disjoint path sets are combined with log-sum-exp. Summing the two accepting states at the final time therefore gives the total probability of every alignment that collapses to the label string, which the brute-force enumeration in the test reproduces.",
        complexityRationale:
            "There are T time steps and 2L+1 extended states, and each state examines at most three predecessors, so the forward pass is O(T * L). Rolling from one time row to the next stores only a single state vector, giving O(L) space.",
        uses: [
            "End-to-end speech recognition without forced alignment",
            "Handwriting and gesture recognition from unsegmented signals",
            "Sequence losses in connectionist temporal classification training",
        ],
        references: [
            "Graves et al., Connectionist Temporal Classification: Labelling Unsegmented Sequence Data, ICML, 2006",
            "Graves, Supervised Sequence Labelling with Recurrent Neural Networks, Springer, 2012",
        ],
        workedExample:
            "For labels [0, 1] the extended states are blank, label 0, blank, label 1, blank. At time zero only the first blank and the first label can be occupied. At each later time a path may stay, move one state forward, or jump over the blank between label 0 and label 1, and the emission probability of the chosen symbol is multiplied in. The sum of the two accepting states after the last time step is the CTC likelihood.",
    },
    id: "ctc-loss",
    name: "CTC Loss (Forward Probability)",
    category: "ml-ai",
    complexity: { time: "O(T * L)", space: "O(L)" },
    defaultInput: {
        labels: [0, 1],
        T: 4,
        logProbs: [
            [-2.3026, -0.3567, -1.6094],
            [-0.6931, -1.6094, -1.2040],
            [-1.6094, -1.2040, -0.6931],
            [-0.5108, -2.3026, -1.2040],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build the extended label string with a blank before and after every label",
        "initialize the first DP row at the initial blank and the first label",
        "for each later input step visit every extended state",
        "sum the previous state, the state before it, and a two-step skip when labels differ",
        "multiply the sum by the emission probability of this state's symbol",
        "after the last step combine the final label and trailing blank states",
        "done: report the total log probability of the label sequence",
    ],
};

export default module;
