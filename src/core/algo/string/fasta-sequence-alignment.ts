/**
 * fasta-sequence-alignment.ts - FASTA Multiple Sequence Alignment
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FASTA is a heuristic for multiple sequence alignment. It first finds short
 * exact word (k-tuple) matches between each sequence and a reference, using
 * the best diagonal as an anchor, then aligns every sequence to that reference
 * and merges the results into a single multiple alignment. The center-star
 * merge shown here keeps the reference gapless while gaps accumulate in the
 * other rows.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s * (Lr * Ls + n^2)) for s sequences, reference length Lr
 *   Space: O(Lr * s) for the resulting alignment
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Word-match anchors are shown on a text row of the reference.
 *   - The progressive alignment is drawn as a grid of aligned characters.
 *   - The reference row is GREEN (sorted); newly added rows are YELLOW.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

type Task = { sequences?: string[]; k?: number };

function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

function makeGrid(rows: string[], newestRow: number, referenceRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r] ?? "";
        for (let c = 0; c < row.length; c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: row[c] ?? "",
                value: row[c] ?? "",
                state: (r === newestRow ? "comparing" : r === referenceRow ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return entities;
}

/** Align a sequence to a gapless reference, returning the sequence row padded with gaps. */
function alignToReference(reference: string, seq: string): string {
    const n = reference.length;
    const m = seq.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 0; i <= n; i += 1) {
        dp[i]![0] = -i;
    }
    for (let j = 0; j <= m; j += 1) {
        dp[0]![j] = -j;
    }
    for (let i = 1; i <= n; i += 1) {
        for (let j = 1; j <= m; j += 1) {
            const score = reference[i - 1] === seq[j - 1] ? 1 : -1;
            const diagonal = dp[i - 1]![j - 1]! + score;
            const gap = dp[i - 1]![j]! - 1;
            dp[i]![j] = Math.max(diagonal, gap);
        }
    }
    const reversed: string[] = [];
    let j = m;
    for (let i = n; i >= 1; i -= 1) {
        const score = reference[i - 1] === seq[j - 1] ? 1 : -1;
        if (j > 0 && dp[i]![j] === dp[i - 1]![j - 1]! + score) {
            reversed.push(seq[j - 1] as string);
            j -= 1;
        } else {
            reversed.push("-");
        }
    }
    return reversed.reverse().join("");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (taskInput: unknown): Task => (taskInput as Task | null) ?? {};
    const t = task(input);
    const sequences = (t.sequences ?? ["ACGTACGT", "AGTACCT", "ACGTTGT"]).filter(
        (s): s is string => typeof s === "string",
    );
    const k = typeof t.k === "number" ? Math.max(1, t.k) : 2;
    let step = 0;

    yield {
        stepNumber: step,
        entities: sequences.length > 0 ? makeText(sequences[0] as string) : [],
        edges: [],
        description: `Aligning ${sequences.length} sequence(s) with FASTA using word length ${k}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { sequenceCount: sequences.length, wordLength: k, sequences: [...sequences] },
    };
    step += 1;

    if (sequences.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No sequences were supplied, so there is nothing to align.",
            codeLineNumber: 8,
            layout: "grid",
            meta: { sequences: [], rows: 0, cols: 0 },
        };
        return;
    }

    let referenceIndex = 0;
    for (let i = 1; i < sequences.length; i += 1) {
        if ((sequences[i] as string).length > (sequences[referenceIndex] as string).length) {
            referenceIndex = i;
        }
    }
    const reference = sequences[referenceIndex] as string;

    // Phase 1: find the best k-tuple diagonal for every non-reference sequence.
    for (let i = 0; i < sequences.length; i += 1) {
        if (i === referenceIndex) {
            continue;
        }
        const seq = sequences[i] as string;
        const diagonals = new Map<number, number>();
        let bestDiagonal = 0;
        let bestCount = 0;
        for (let p = 0; p + k <= reference.length; p += 1) {
            for (let q = 0; q + k <= seq.length; q += 1) {
                if (reference.slice(p, p + k) === seq.slice(q, q + k)) {
                    const diagonal = q - p;
                    const count = (diagonals.get(diagonal) ?? 0) + 1;
                    diagonals.set(diagonal, count);
                    if (count > bestCount) {
                        bestCount = count;
                        bestDiagonal = diagonal;
                    }
                    const states = new Map<number, EntityState>();
                    for (let c = p; c < p + k; c += 1) {
                        states.set(c, "comparing");
                    }
                    yield {
                        stepNumber: step,
                        entities: makeText(reference, states),
                        edges: [],
                        description: `Sequence ${i}: word "${reference.slice(p, p + k)}" matches on diagonal ${diagonal}.`,
                        codeLineNumber: 2,
                        layout: "text",
                        meta: { sequenceIndex: i, refPosition: p, seqPosition: q, diagonal, wordCount: count },
                    };
                    step += 1;
                }
            }
        }
        yield {
            stepNumber: step,
            entities: makeText(reference),
            edges: [],
            description: `Sequence ${i}: best anchor is diagonal ${bestDiagonal} with ${bestCount} word match(es).`,
            codeLineNumber: 3,
            layout: "text",
            meta: { sequenceIndex: i, bestDiagonal, bestCount },
        };
        step += 1;
    }

    // Phase 2: progressive center-star alignment onto the gapless reference.
    const aligned: string[] = new Array<string>(sequences.length).fill("");
    aligned[referenceIndex] = reference;
    let processed = 1;
    yield {
        stepNumber: step,
        entities: makeGrid(aligned, -1, referenceIndex),
        edges: [],
        description: "Starting the progressive alignment with the longest sequence as reference.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: reference.length, alignedCount: 1, referenceIndex, sequences: [...aligned] },
    };
    step += 1;

    for (let i = 0; i < sequences.length; i += 1) {
        if (i === referenceIndex) {
            continue;
        }
        aligned[i] = alignToReference(reference, sequences[i] as string);
        processed += 1;
        yield {
            stepNumber: step,
            entities: makeGrid(aligned, i, referenceIndex),
            edges: [],
            description: `Aligned sequence ${i} to the reference; ${processed} of ${sequences.length} rows are placed.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: {
                rows: sequences.length,
                cols: reference.length,
                alignedCount: processed,
                latestRow: i,
                sequences: [...aligned],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeGrid(aligned, -1, referenceIndex),
        edges: [],
        description: `Done: ${sequences.length} sequences aligned into ${reference.length} columns.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows: sequences.length,
            cols: reference.length,
            alignedCount: sequences.length,
            alignment: [...aligned],
            sequences: [...aligned],
        },
    };
}

/** The FASTA Multiple Sequence Alignment module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Aligning every sequence against every other is expensive, so FASTA picks one reference and uses short exact word matches as anchors. It then aligns each remaining sequence to that reference column by column and stacks the results. All rows share the same columns, which makes the multiple alignment readable.",
        invariants: [
            "The reference row contains no gap characters.",
            "Every aligned row has exactly the same number of columns as the reference.",
            "Deleting gaps from an aligned row recovers the original input sequence.",
        ],
        correctness:
            "The dynamic program aligns each sequence to the gapless reference with the optimal score under the match, mismatch, and gap costs, so its traceback produces a gap-padded row whose ungapped letters equal that sequence. Stacking rows by reference column never inserts or deletes a reference character, so all rows stay aligned and removing gaps returns each input exactly.",
        complexityRationale:
            "Finding k-tuple matches compares all word pairs between each sequence and the reference, bounded by O(Lr * Ls). Each dynamic program is O(Lr * Ls), and there are s minus one of them, giving the stated total. The alignment stores s rows of length Lr.",
        uses: [
            "Multiple alignment of protein or DNA families",
            "Finding conserved motifs before building phylogenetic trees",
            "Quick progressive alignment as a seed for refinement methods",
        ],
        references: [
            "Lipman and Pearson, Rapid and Sensitive Protein Similarity Searches, 1985",
            "Durbin et al., Biological Sequence Analysis, Chapter 6",
        ],
        workedExample:
            'Aligning ACGT and AGT with word length 2 finds the shared "GT" word near the end. The reference stays ACGT and the second row becomes A-GT, so removing the gap gives back AGT.',
    },
    id: "fasta-sequence-alignment",
    name: "FASTA Multiple Sequence Alignment",
    category: "string",
    complexity: { time: "O(s * (Lr * Ls + n^2))", space: "O(Lr * s)" },
    defaultInput: { sequences: ["ACGTACGT", "AGTACCT", "ACGTTGT"], k: 2 },
    visualType: "text",
    run,
    pseudocode: [
        "choose the longest sequence as the reference",
        "for each other sequence find all shared k-tuple word matches",
        "record diagonal offsets and keep the best anchor",
        "initialize the multiple alignment with the reference row",
        "for each other sequence align it to the reference by dynamic programming",
        "insert its gap-padded row at the matching reference columns",
        "repeat until every sequence has a row",
        "count the final columns and confirm every row is complete",
        "done: report the full aligned matrix",
    ],
};

export default module;
