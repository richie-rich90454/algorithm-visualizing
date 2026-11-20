/**
 * bart-model.ts - BART Text Infilling Pretraining
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BART is a denoising sequence-to-sequence transformer. In its text-infill-ing
 * pretraining objective, contiguous spans of input tokens are chosen with a
 * seeded rule and each span is replaced by a single mask token. The decoder
 * must rebuild the original token sequence. This module implements the exact
 * teachable core: seeded span selection, span collapsing into one mask, and
 * span reconstruction back to the untouched original.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n tokens
 *   Space: O(n) for the mask, spans, and corrupted sequence
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the token stream at each pretraining phase.
 *   - Mask tokens are highlighted; restored tokens are green in the last frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Sentinel id used for the single mask token that replaces a whole span. */
export const MASK_ID = -1;

interface BartInput {
    tokenIds?: number[];
    seed?: number;
    maskRatio?: number;
}

type Span = {
    start: number;
    length: number;
    tokens: number[];
};

/** Advance a linear congruential generator and return one uniform in [0,1). */
function nextUniform(state: number): number {
    return ((Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** Select contiguous spans with a seeded Bernoulli mask and collapse each to a mask token. */
export function bartCorrupt(tokenIds: number[], seed: number, maskRatio: number) {
    const n = tokenIds.length;
    const masked: boolean[] = [];
    let state = seed >>> 0;
    for (let i = 0; i < n; i += 1) {
        const u = nextUniform(state);
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        masked.push(u < maskRatio);
    }
    const spans: Span[] = [];
    let i = 0;
    while (i < n) {
        if (!masked[i]) {
            i += 1;
            continue;
        }
        let j = i;
        while (j < n && masked[j]) {
            j += 1;
        }
        spans.push({ start: i, length: j - i, tokens: tokenIds.slice(i, j) });
        i = j;
    }
    const corrupted: number[] = [];
    for (let k = 0; k < n; k += 1) {
        if (!masked[k]) {
            corrupted.push(tokenIds[k] ?? 0);
        } else if (k === 0 || !masked[k - 1]) {
            corrupted.push(MASK_ID);
        }
    }
    return { masked, spans, corrupted };
}

/** Replace each mask token with the original span tokens, in left-to-right order. */
export function bartReconstruct(corrupted: number[], spans: Span[]): number[] {
    const restored: number[] = [];
    let next = 0;
    for (const value of corrupted) {
        if (value === MASK_ID) {
            const tokens = spans[next]?.tokens ?? [];
            next += 1;
            for (const token of tokens) {
                restored.push(token);
            }
        } else {
            restored.push(value);
        }
    }
    return restored;
}

function bars(values: number[], mode: "idle" | "mask" | "restore" | "done"): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState =
            mode === "idle"
                ? "idle"
                : mode === "mask"
                  ? value === MASK_ID
                      ? "highlight"
                      : "sorted"
                  : mode === "restore"
                    ? "comparing"
                    : "sorted";
        return {
            id: `tok-${index}`,
            type: "bar" as const,
            label: value === MASK_ID ? "M" : String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, mask: value === MASK_ID },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BartInput | null) ?? {};
    const tokenIds: number[] = (task.tokenIds ?? [4, 7, 2, 9, 3, 6, 1, 5]).slice();
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 11;
    const ratio = typeof task.maskRatio === "number" ? task.maskRatio : 0.3;
    const { masked, spans, corrupted } = bartCorrupt(tokenIds, seed, ratio);
    const restored = bartReconstruct(corrupted, spans);
    const maskCount = spans.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(tokenIds, "idle"),
        edges: [],
        description: `Read the clean input of ${tokenIds.length} token(s) before corruption.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", seed, maskRatio: ratio, tokenIds, spans: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(
            tokenIds.map((value, index) => (masked[index] ? MASK_ID : value)),
            "mask",
        ),
        edges: [],
        description: `A seeded mask selected ${maskCount} contiguous span(s) for text infilling.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "select", seed, maskCount, mask: masked, spans },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(corrupted, "mask"),
        edges: [],
        description: `Collapse each selected span into a single mask token.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "corrupt", corrupted, spans, maskCount },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(restored, "restore"),
        edges: [],
        description: `The decoder fills each mask with its original span of tokens.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "decode", restored, spans },
    };
    step += 1;

    const exact = restored.length === tokenIds.length && restored.every((v, i) => v === tokenIds[i]);
    yield {
        stepNumber: step,
        entities: bars(restored, "done"),
        edges: [],
        description: exact
            ? `Done: the decoder rebuilt all ${tokenIds.length} original token(s) exactly.`
            : `Done: reconstruction length ${restored.length} differs from the original.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", exact, restored, tokenIds, maskCount },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BART learns by being given a damaged sentence and asked to write the original. Its main corruption, text infilling, deletes a few short contiguous spans and replaces each span with one mask. Because the model must guess how long every missing span was, it learns both grammar and content.",
        invariants: [
            "A span is a maximal run of consecutive masked input positions.",
            "Each span becomes exactly one mask token in the corrupted stream.",
            "Restoring the spans in left-to-right order rebuilds the original sequence.",
        ],
        correctness:
            "The seeded Bernoulli test marks a fixed set of positions, and scanning for maximal runs yields disjoint spans that cover every marked position exactly once. Emitting one mask at each run's first position and skipping its continuation produces the corrupted stream. Walking that stream and expanding every mask with the next span's saved tokens reverses the collapse precisely, so the restored sequence equals the input.",
        complexityRationale:
            "Masking, run detection, collapse, and reconstruction each visit the n tokens a constant number of times, giving O(n) time and O(n) space for the stored mask, spans, and sequences.",
        uses: [
            "Sequence-to-sequence pretraining for summarization and translation",
            "Denoising objectives that combine token masking with sentence reordering",
            "Teaching span-level reconstruction in language-model courses",
        ],
        references: [
            "Lewis et al., BART: Denoising Sequence-to-Sequence Pre-training, ACL 2020",
            "Devlin et al., BERT: Pre-training of Deep Bidirectional Transformers, NAACL 2019",
        ],
        workedExample:
            "For tokens 4,7,2,9,3,6,1,5 with a seed that masks positions 1,2 and 5, the spans are [7,2] at index 1 and [6] at index 5. The corrupted stream is 4,M,9,3,M,1,5. Expanding the first mask to 7,2 and the second to 6 returns the original eight tokens.",
    },
    id: "bart-model",
    name: "BART Text Infilling",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { tokenIds: [4, 7, 2, 9, 3, 6, 1, 5], seed: 11, maskRatio: 0.3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the token ids, a seed, and a mask ratio",
        "mark each position with a seeded Bernoulli draw",
        "group consecutive marked positions into spans",
        "replace each span by a single mask token",
        "expand each mask with its saved span tokens",
        "done: report the restored original sequence",
    ],
};

export default module;
