/**
 * lookahead-decoding.ts - Lookahead Decoding (Parallel Verification Core)
 *
 * TEACHING MODEL, NOT A PRODUCTION DECODER. Lookahead decoding runs a cheap
 * lookahead branch that guesses a window of future tokens while the target
 * model verifies the whole window in one pass. The verified prefix is accepted
 * and the first divergent token is corrected. A tiny deterministic affine
 * "model" stands in for the neural network so the verification logic is exact.
 *
 * Complexity:
 *   Time:  O(w) to verify a window of w guessed tokens
 *   Space: O(w) for the accepted prefix and output
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : String(value),
                value: value ?? -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** A deterministic stand-in for the target model's greedy next token. */
function nextToken(token: number, vocab: number, a: number, b: number): number {
    return ((token * a + b) % vocab + vocab) % vocab;
}

/** Verify the guessed window in one pass and return the accepted prefix. */
function verify(draft: number[], start: number, vocab: number, a: number, b: number) {
    const expected: number[] = [];
    const verdict: number[] = [];
    const accepted: number[] = [];
    let cursor = start;
    let diverged = false;
    for (const token of draft) {
        const want = nextToken(cursor, vocab, a, b);
        expected.push(want);
        if (!diverged && token === want) {
            verdict.push(1);
            accepted.push(token);
            cursor = token;
        } else {
            diverged = true;
            verdict.push(0);
        }
    }
    const correction = nextToken(cursor, vocab, a, b);
    return { expected, verdict, accepted, correction, output: [...accepted, correction] };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            start?: number;
            draft?: number[];
            vocab?: number;
            a?: number;
            b?: number;
        } | null
    ) ?? {};
    const vocab = Math.max(2, Math.floor(task.vocab ?? 10));
    const a = Math.floor(task.a ?? 3);
    const b = Math.floor(task.b ?? 1);
    const start = ((Math.floor(task.start ?? 2) % vocab) + vocab) % vocab;
    const draft = (task.draft?.length ? task.draft : [7, 2, 3, 8, 1]).map(
        (t) => ((Math.floor(t) % vocab) + vocab) % vocab,
    );
    const result = verify(draft, start, vocab, a, b);
    const width = draft.length;

    const matrix: Cell[][] = [
        draft.slice(0, width),
        result.expected.slice(0, width),
        result.verdict.slice(0, width),
        Array.from({ length: width }, (_, i) => result.output[i] ?? null),
    ];
    const base = {
        rows: 4,
        cols: width,
        vocab,
        start,
        window: width,
        a,
        b,
    };
    const captions = [
        "The lookahead branch guesses a window of future tokens.",
        "The target model produces the expected greedy token at each position.",
        "Verify each guess in parallel; accept the matching prefix and stop at the first mismatch.",
        `Accepted ${result.accepted.length} token(s) and appended correction ${result.correction}.`,
    ];
    const lines = [0, 1, 2, 3];
    for (let frame = 0; frame < captions.length; frame += 1) {
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, frame + 1, frame),
            edges: [],
            description: captions[frame] ?? "",
            codeLineNumber: lines[frame] ?? 0,
            layout: "grid",
            meta: {
                ...base,
                phase: frame === 0 ? "guess" : frame === 3 ? "commit" : "verify",
                accepted: result.accepted,
                correction: result.correction,
                output: result.output,
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Autoregressive decoding is slow because it produces one token at a time. Lookahead decoding guesses several future tokens at once and asks the target model to score the whole window in a single pass. The guessed tokens that agree with the model are kept, and the first token that disagrees is replaced by the model's choice.",
        invariants: [
            "The accepted tokens form a prefix: verification stops permanently at the first mismatch.",
            "The correction is the target model's greedy token at the divergence point.",
            "The committed output begins with the accepted prefix followed by exactly one correction token.",
        ],
        correctness:
            "At each window position verification compares the guessed token with the target model's greedy token conditioned on the already accepted prefix. By definition every accepted token equals what the model would have emitted, so committing them cannot differ from ordinary greedy decoding. The first position where they differ is replaced by the model's own token, so the committed sequence matches greedy decoding through that position and extends it by one token.",
        complexityRationale:
            "Each of the w guessed tokens needs one comparison and one deterministic model step, so verification is O(w) time and uses O(w) space for the accepted prefix; a real model pays for a single batched forward pass instead.",
        uses: [
            "Speculative decoding to speed up large language model inference",
            "Draft-and-verify pipelines with a cheap draft model",
            "A teaching model of parallel token verification",
        ],
        references: [
            "Fu et al., Lookahead Decoding: Breaking the Serialization Barrier, 2024",
            "Leviathan, Kalman, and Matias, Fast Inference via Speculative Decoding, 2023",
        ],
        workedExample:
            "Starting from token 2 with model next(t) = (3t + 1) mod 10, the greedy tokens are 7, 2, 7. Given the guess 7, 2, 3, 8, 1, the first two tokens match and are accepted; the third guess 3 differs from 7, so the correction 7 is appended and the committed output is 7, 2, 7.",
    },
    id: "lookahead-decoding",
    name: "Lookahead Decoding (Parallel Verification Core)",
    category: "ml-ai",
    complexity: { time: "O(w)", space: "O(w)" },
    defaultInput: { start: 2, draft: [7, 2, 3, 8, 1], vocab: 10, a: 3, b: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "the lookahead branch guesses a window of future tokens",
        "the target model gives the expected greedy token at each position",
        "verify guesses in order against the accepted prefix",
        "accept a guess while it equals the greedy token",
        "stop at the first mismatch and record the correction",
        "done: commit the accepted prefix plus one correction token",
    ],
};

export default module;
