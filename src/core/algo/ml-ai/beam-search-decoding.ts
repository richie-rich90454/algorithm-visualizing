/**
 * beam-search-decoding.ts - Beam Search Decoding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Beam search keeps the B most promising partial sequences at every step. Each
 * partial sequence is extended by every vocabulary token, the new candidates
 * are ranked by total log probability, and only the top B survive. Greedy
 * decoding is the special case B equals one. Because all survivors at a step
 * have the same length, their scores are comparable.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the exact beam-search core on a small bigram score table. It does
 * not run a neural network, sample from a model, or apply length penalties and
 * stopping tokens, which are common production refinements.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * B * V log(B * V)) for L steps, beam width B, vocabulary V
 *   Space: O(B * L) for the stored partial sequences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The beam is drawn as B rows with a sequence cell and a score cell.
 *   - The best row is green; the other survivors are blue.
 *   - Empty rows appear when fewer than B candidates exist.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BeamInput {
    vocab?: string[];
    logProbs?: number[][];
    length?: number;
    width?: number;
}

interface Candidate {
    tokens: number[];
    score: number;
}

/** Rank by descending score, then by ascending token index sequence. */
function rank(a: Candidate, b: Candidate): number {
    if (b.score !== a.score) {
        return b.score - a.score;
    }
    const len = Math.min(a.tokens.length, b.tokens.length);
    for (let i = 0; i < len; i += 1) {
        if ((a.tokens[i] ?? 0) !== (b.tokens[i] ?? 0)) {
            return (a.tokens[i] ?? 0) - (b.tokens[i] ?? 0);
        }
    }
    return a.tokens.length - b.tokens.length;
}

function makeCells(beam: Candidate[], vocab: string[], width: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < width; row += 1) {
        const candidate = beam[row];
        const sequence = candidate
            ? candidate.tokens.map((t) => vocab[t] ?? "?").join(" ")
            : "";
        const score = candidate ? candidate.score.toFixed(3) : "";
        const state: EntityState = candidate ? (row === 0 ? "sorted" : "comparing") : "idle";
        entities.push({
            id: `cell-${row}-0`,
            type: "cell",
            label: sequence || "-",
            value: sequence,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 0 },
        });
        entities.push({
            id: `cell-${row}-1`,
            type: "cell",
            label: score || "-",
            value: candidate ? candidate.score : -1,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 1 },
        });
    }
    return entities;
}

/** The beam-search decoding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BeamInput | null) ?? {};
    const vocab = Array.isArray(task.vocab) && task.vocab.length > 0
        ? task.vocab.map(String)
        : ["a", "b", "c"];
    const logProbs = Array.isArray(task.logProbs)
        ? task.logProbs.map((row) => [...row])
        : [
              [-0.1, -1.2, -2.0],
              [-0.7, -0.2, -1.5],
              [-0.3, -0.9, -0.4],
              [-1.0, -0.1, -1.8],
          ];
    const length = Math.max(1, Math.min(8, typeof task.length === "number" ? Math.trunc(task.length) : 3));
    const width = Math.max(1, Math.min(12, typeof task.width === "number" ? Math.trunc(task.width) : 2));
    const V = vocab.length;

    let beam: Candidate[] = [{ tokens: [], score: 0 }];
    let step = 0;
    const frameMeta = (beamState: Candidate[]): Record<string, number | string | boolean | number[] | string[]> => ({
        rows: width,
        cols: 2,
        width,
        length,
        vocabSize: V,
        beamSeqs: beamState.map((c) => c.tokens.map((t) => vocab[t] ?? "?").join(" ")),
        beamScores: beamState.map((c) => c.score),
        bestSeq: beamState[0] ? beamState[0].tokens.map((t) => vocab[t] ?? "?").join(" ") : "",
        bestScore: beamState[0]?.score ?? 0,
    });

    yield {
        stepNumber: step,
        entities: makeCells(beam, vocab, width),
        edges: [],
        description: `Beam width ${width}, vocabulary ${V}, decoding ${length} token(s) by total log probability.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...frameMeta(beam), step: 0 },
    };
    step += 1;

    for (let t = 0; t < length; t += 1) {
        const expanded: Candidate[] = [];
        for (const candidate of beam) {
            const last = candidate.tokens[candidate.tokens.length - 1];
            const row = last === undefined ? (logProbs[0] ?? []) : (logProbs[last + 1] ?? []);
            for (let token = 0; token < V; token += 1) {
                expanded.push({
                    tokens: [...candidate.tokens, token],
                    score: candidate.score + (row[token] ?? 0),
                });
            }
        }
        expanded.sort(rank);
        beam = expanded.slice(0, width);
        yield {
            stepNumber: step,
            entities: makeCells(beam, vocab, width),
            edges: [],
            description: `Step ${t + 1}: kept ${beam.length} of ${expanded.length} candidates; best is "${frameMeta(beam)["bestSeq"]}" with score ${(beam[0]?.score ?? 0).toFixed(3)}.`,
            codeLineNumber: t === length - 1 ? 5 : 3,
            layout: "grid",
            meta: { ...frameMeta(beam), step: t + 1, expanded: expanded.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(beam, vocab, width),
        edges: [],
        description: `Done: best sequence "${frameMeta(beam)["bestSeq"]}" with total log probability ${(beam[0]?.score ?? 0).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...frameMeta(beam), step: length + 1, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep a shortlist of the most likely partial sentences. At each step, extend every shortlist entry with every possible next token, add the token's log probability, and throw away all but the best B scores. A wider beam explores more alternatives but costs more work; a beam of one is plain greedy decoding.",
        invariants: [
            "Every candidate in the beam has the same length at a given step.",
            "Scores are summed log probabilities, so higher is better.",
            "The best entry is the one with the highest score, ties broken by token order.",
        ],
        correctness:
            "Scores add because the log probability of a sequence is the sum of its token log probabilities. All candidates at step t have length t, so comparing their cumulative scores is valid. Beam pruning keeps the B highest prefixes; since any extension only adds a token score, the globally highest-scoring sequences of length L must descend from prefixes that survived at every earlier step.",
        complexityRationale:
            "Each of L steps expands B candidates by V tokens and sorts at most B times V entries, costing O(L * B * V log(B * V)). The beam stores B sequences of length at most L, which is O(B * L) space.",
        uses: [
            "Sequence generation in machine translation and language models",
            "Speech recognition transcript ranking",
            "Any decoding problem with an additive token score",
        ],
        references: [
            "Graves, Sequence Transduction with Recurrent Neural Networks, 2012",
            "Sutskever, Vinyals, and Le, Sequence to Sequence Learning with Neural Networks, 2014",
        ],
        workedExample:
            "With vocabulary a, b, c, a start distribution favoring a, and width two, the first step keeps a and b. If continuing a with b scores highest overall, the beam ends with the sequence a b as its best entry and reports the summed log probability.",
    },
    id: "beam-search-decoding",
    name: "Beam Search Decoding",
    category: "ml-ai",
    complexity: { time: "O(L * B * V log(B * V))", space: "O(B * L)" },
    defaultInput: {
        vocab: ["a", "b", "c"],
        logProbs: [
            [-0.1, -1.2, -2.0],
            [-0.7, -0.2, -1.5],
            [-0.3, -0.9, -0.4],
            [-1.0, -0.1, -1.8],
        ],
        length: 3,
        width: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start the beam with the empty sequence of score zero",
        "for each of the L decoding steps",
        "extend every beam entry with every vocabulary token",
        "add the token log probability to the cumulative score",
        "sort candidates by score and keep the best B",
        "record the surviving beam for this step",
        "done: report the highest scoring sequence and its score",
    ],
};

export default module;
