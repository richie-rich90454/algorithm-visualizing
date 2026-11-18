/**
 * viterbi-decoding.ts - Viterbi Algorithm for Hidden Markov Models
 *
 * Finds the most likely sequence of hidden states for a short observation
 * sequence. A grid shows the best-path probability reaching each state at each
 * time step, and the final frame traces the winning path through backpointers.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Hmm {
    states: string[];
    observations: string[];
    start: number[];
    trans: number[][];
    emit: number[][];
}

function makeCells(
    cfg: Hmm,
    delta: number[][],
    filledCols: number,
    current: number,
    path: number[],
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let t = 0; t < cfg.observations.length; t += 1) {
        for (let s = 0; s < cfg.states.length; s += 1) {
            const revealed = done || t < filledCols;
            const onPath = done && path[t] === s;
            const state = onPath
                ? "path"
                : revealed
                  ? t === current && !done
                      ? "active"
                      : "sorted"
                  : "unvisited";
            const prob = revealed ? (delta[t]?.[s] ?? 0) : 0;
            entities.push({
                id: `cell-${s}-${t}`,
                type: "cell",
                label: revealed ? prob.toFixed(3) : ".",
                value: prob,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: s, col: t, state: cfg.states[s] ?? "" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<Hmm> | null) ?? {};
    const cfg: Hmm = {
        states: task.states ?? ["Rain", "Sun"],
        observations: task.observations ?? ["walk", "shop", "clean"],
        start: task.start ?? [0.6, 0.4],
        trans: task.trans ?? [
            [0.7, 0.3],
            [0.4, 0.6],
        ],
        emit: task.emit ?? [
            [0.1, 0.4, 0.5],
            [0.6, 0.3, 0.1],
        ],
    };
    const S = cfg.states.length;
    const T = cfg.observations.length;
    const delta: number[][] = Array.from({ length: T }, () => new Array<number>(S).fill(0));
    const psi: number[][] = Array.from({ length: T }, () => new Array<number>(S).fill(0));

    yield {
        stepNumber: 0,
        entities: makeCells(cfg, delta, 0, -1, [], false),
        edges: [],
        description: `Decoding ${T} observations over ${S} hidden states with the Viterbi algorithm.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: S, cols: T, filledCols: 0, bestProb: 0, bestPath: [] },
    };

    for (let t = 0; t < T; t += 1) {
        for (let s = 0; s < S; s += 1) {
            const emission = cfg.emit[s]?.[t] ?? 0;
            if (t === 0) {
                delta[t]![s] = (cfg.start[s] ?? 0) * emission;
            } else {
                let best = -1;
                let bestPrev = 0;
                for (let prev = 0; prev < S; prev += 1) {
                    const candidate = (delta[t - 1]?.[prev] ?? 0) * (cfg.trans[prev]?.[s] ?? 0);
                    if (candidate > best) {
                        best = candidate;
                        bestPrev = prev;
                    }
                }
                delta[t]![s] = best * emission;
                psi[t]![s] = bestPrev;
            }
        }
        yield {
            stepNumber: t + 1,
            entities: makeCells(cfg, delta, t + 1, t, [], false),
            edges: [],
            description: `Time ${t}, observation "${cfg.observations[t]}": computed the best probability for every state.`,
            codeLineNumber: t === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows: S, cols: T, filledCols: t + 1, bestProb: 0, bestPath: [] },
        };
    }

    let bestLast = 0;
    for (let s = 1; s < S; s += 1) {
        if ((delta[T - 1]?.[s] ?? 0) > (delta[T - 1]?.[bestLast] ?? 0)) {
            bestLast = s;
        }
    }
    const path = new Array<number>(T).fill(0);
    path[T - 1] = bestLast;
    for (let t = T - 1; t > 0; t -= 1) {
        path[t - 1] = psi[t]?.[path[t] ?? 0] ?? 0;
    }
    const bestProb = delta[T - 1]?.[bestLast] ?? 0;
    const names = path.map((s) => cfg.states[s] ?? "");

    yield {
        stepNumber: T + 1,
        entities: makeCells(cfg, delta, T, -1, path, true),
        edges: [],
        description: `Most likely path: ${names.join(" -> ")} with probability ${bestProb.toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: S,
            cols: T,
            filledCols: T,
            bestProb: Number(bestProb.toFixed(8)),
            bestPath: path,
            bestStates: names,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Many hidden states could explain the same observations. Rather than enumerate every path, keep for each state at each time only the most probable path ending there. That single best prefix is enough because the future depends only on the current state.",
        invariants: [
            "delta[t][s] stores the highest probability of any path ending in state s at time t.",
            "psi[t][s] records the previous state that achieved that best probability.",
            "Each step multiplies the best incoming probability by the transition and the emission probability.",
        ],
        correctness:
            "At time zero delta equals the initial probability times the first emission. For later times the optimal substructure property gives delta[t][s] = max_prev delta[t-1][prev] * trans[prev][s] * emit[s][obs_t], because the best path into s must extend the best path into some previous state. Following the backpointers from the best final state therefore reconstructs the globally most likely path, and enumerating all paths yields the same probability.",
        complexityRationale:
            "Each of the T columns scans S previous states for each of S states, costing O(T * S^2) time; the probability and backpointer tables use O(T * S) space.",
        uses: [
            "Part-of-speech tagging in natural language processing",
            "Decoding states in speech recognition systems",
            "Basecalling and sequence alignment in computational biology",
        ],
        references: [
            "Viterbi, Error Bounds for Convolutional Codes, 1967",
            "Rabiner, A Tutorial on Hidden Markov Models, 1989",
        ],
        workedExample:
            "With states Rain and Sun, start 0.6/0.4, and observations walk, shop, clean, the first column is Rain 0.06 and Sun 0.24. Each later column keeps the best incoming transition times the emission, and backtracking from the best final state recovers the most likely weather sequence.",
    },
    id: "viterbi-decoding",
    name: "Viterbi Decoding",
    category: "ml-ai",
    complexity: { time: "O(T * S^2)", space: "O(T * S)" },
    defaultInput: {
        states: ["Rain", "Sun"],
        observations: ["walk", "shop", "clean"],
        start: [0.6, 0.4],
        trans: [
            [0.7, 0.3],
            [0.4, 0.6],
        ],
        emit: [
            [0.1, 0.4, 0.5],
            [0.6, 0.3, 0.1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the first column with initial times emission probabilities",
        "for each later observation",
        "for each state compute the best previous state times transition",
        "multiply that best value by the current emission probability",
        "record the value and the chosen previous state",
        "pick the best final state and follow backpointers",
        "done: report the most likely state path",
    ],
};

export default module;
