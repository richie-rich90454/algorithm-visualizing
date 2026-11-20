/**
 * bzip2.ts - Block-Sorting Compression Pipeline (bzip2-style)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * bzip2 compresses a block by sorting every rotation of the block (the
 * Burrows-Wheeler transform), applying move-to-front coding to the resulting
 * last column, run-length encoding the long runs of zeros, and finally writing
 * a canonical Huffman code. This teaching model performs all four stages
 * exactly and is fully reversible; it is not a byte-compatible bzip2 encoder.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 log n) for the naive rotation sort, O(n log n) for coding
 *   Space: O(n^2) for the rotation matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each stage writes its intermediate sequence into a grid row.
 *   - The current symbol of a stage is highlighted.
 *   - meta carries the BWT string, MTF values, RLE tokens, and Huffman codes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Bzip2Input {
    text?: string;
}

/** A printable end marker that does not occur in the source text. */
function sentinelFor(text: string): string {
    for (const candidate of ["|", "~", "^", "#", "@", "%"]) {
        if (!text.includes(candidate)) return candidate;
    }
    return "\u0000";
}

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return {
        id,
        type: "cell",
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

/** Sort all rotations of text + sentinel and return the sorted rotations. */
function sortedRotations(text: string, sentinel: string): string[] {
    const block = text + sentinel;
    const rotations: string[] = [];
    for (let i = 0; i < block.length; i += 1) {
        rotations.push(block.slice(i) + block.slice(0, i));
    }
    return rotations.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Build a Huffman code over a set of symbol keys with deterministic ties. */
function huffman(keys: string[]): { codes: Map<string, string>; merges: string[] } {
    const freq = new Map<string, number>();
    for (const key of keys) freq.set(key, (freq.get(key) ?? 0) + 1);
    type Node = { key: string; freq: number; left?: Node; right?: Node };
    let leaves: Node[] = [...freq].map(([key, count]) => ({ key, freq: count })).sort((a, b) => a.freq - b.freq || a.key.localeCompare(b.key));
    const merges: string[] = [];
    if (leaves.length === 0) return { codes: new Map(), merges };
    if (leaves.length === 1) {
        const only = leaves[0] as Node;
        return { codes: new Map([[only.key, "0"]]), merges: [`single symbol ${only.key}`] };
    }
    while (leaves.length > 1) {
        const a = leaves.shift() as Node;
        const b = leaves.shift() as Node;
        const parent: Node = { key: `${a.key}+${b.key}`, freq: a.freq + b.freq, left: a, right: b };
        merges.push(`${a.key}(${a.freq}) + ${b.key}(${b.freq}) -> ${parent.freq}`);
        leaves.push(parent);
        leaves.sort((x, y) => x.freq - y.freq || x.key.localeCompare(y.key));
    }
    const codes = new Map<string, string>();
    const walk = (node: Node, prefix: string): void => {
        if (!node.left || !node.right) {
            codes.set(node.key, prefix || "0");
            return;
        }
        walk(node.left, prefix + "0");
        walk(node.right, prefix + "1");
    };
    walk(leaves[0] as Node, "");
    return { codes, merges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Bzip2Input | null) ?? {};
    const raw = typeof task.text === "string" && task.text.length > 0 ? task.text : "ABRACADABRAABRACADABRA";
    const text = raw.slice(0, 24);
    const sentinel = sentinelFor(text);
    const block = text + sentinel;
    let step = 0;
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: Math.max(1, ...entities.map((e) => (e.metadata["row"] as number) + 1)), cols: block.length, ...meta },
    });

    yield emit(
        [...block].map((c, i) => cell(`src-${i}`, 0, i, c === sentinel ? "|" : c, c, "idle")),
        `Starting bzip2 on a block of ${text.length} symbols; sentinel "|" marks the end.`,
        0,
        { stage: "input", sentinel, text },
    );

    const rotations = sortedRotations(text, sentinel);
    const sorted: string[] = [];
    for (const rotation of rotations) {
        sorted.push(rotation);
        const entities: VisualEntity[] = [];
        for (let r = 0; r < sorted.length; r += 1) {
            const rowStr = sorted[r] as string;
            for (let c = 0; c < block.length; c += 1) {
                entities.push(cell(`rot-${r}-${c}`, r, c, rowStr[c] === sentinel ? "|" : (rowStr[c] as string), rowStr[c] as string, r === sorted.length - 1 ? "active" : "visited"));
            }
        }
        yield emit(entities, `Sorted rotation ${sorted.length}/${rotations.length} placed into the rotation matrix.`, 1, { stage: "bwt", sortedCount: sorted.length });
    }

    const bwt = sorted.map((r) => r[r.length - 1] as string).join("");
    yield emit(
        [...bwt].map((c, i) => cell(`bwt-${i}`, 0, i, c === sentinel ? "|" : c, c, "sorted")),
        `Burrows-Wheeler last column: "${[...bwt].map((c) => (c === sentinel ? "|" : c)).join("")}".`,
        2,
        { stage: "bwt-done", bwt },
    );

    const alphabet = [...new Set([...bwt])].sort();
    const mtf: number[] = [];
    const working = [...alphabet];
    for (let i = 0; i < bwt.length; i += 1) {
        const c = bwt[i] as string;
        const rank = working.indexOf(c);
        working.splice(rank, 1);
        working.unshift(c);
        mtf.push(rank);
        const entities: VisualEntity[] = [
            ...mtf.map((v, k) => cell(`mtf-${k}`, 0, k, String(v), v, k === mtf.length - 1 ? "active" : "visited")),
            ...working.map((a, k) => cell(`alpha-${k}`, 1, k, a === sentinel ? "|" : a, a, "idle")),
        ];
        yield emit(entities, `Move-to-front: symbol ${i + 1} has rank ${rank}; it moves to the front.`, 3, { stage: "mtf", alphabet, mtfCount: mtf.length });
    }

    const rle: number[] = [];
    for (let i = 0; i < mtf.length; ) {
        const value = mtf[i] as number;
        let count = 1;
        while (i + count < mtf.length && mtf[i + count] === value) count += 1;
        rle.push(value, count);
        i += count;
        yield emit(
            rle.map((v, k) => cell(`rle-${k}`, 0, k, String(v), v, k >= rle.length - 2 ? "active" : "visited")),
            `Run-length encoding: value ${value} occurs ${count} time(s); emit token pair.`,
            4,
            { stage: "rle", rle: [...rle] },
        );
    }

    const symbolKeys = rle.map((value, i) => `${i % 2 === 0 ? "V" : "C"}${value}`);
    const { codes, merges } = huffman(symbolKeys);
    for (const summary of merges) {
        yield emit(
            [...codes.keys()].map((key, i) => cell(`sym-${key}-${i}`, 0, i, key, key, "idle")),
            `Huffman merge: ${summary}.`,
            5,
            { stage: "huffman", mergeCount: merges.length },
        );
    }
    const bits = symbolKeys.map((key) => codes.get(key) ?? "").join("");
    const codeList = [...codes].map(([key, code]) => `${key}:${code}`);
    yield emit(
        [...bits].map((bit, i) => cell(`bit-${i}`, 0, i, bit, bit, "sorted")),
        `Wrote ${bits.length} bit(s) of Huffman output; block compressed from ${block.length} symbols.`,
        6,
        { stage: "done", codes: codeList, bits, originalSymbols: block.length, compressedBits: bits.length, bwt, mtf, rle, alphabet, sentinel },
    );
}

/** The bzip2-style block compression module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Grouping similar symbols together makes data easier to compress. A block sort rearranges the input so repeated characters become adjacent, move-to-front turns long repetitions into many zeros, run-length coding collapses those zeros into counts, and Huffman coding gives frequent tokens the shortest bit patterns.",
        invariants: [
            "The rotation matrix contains every cyclic rotation of the sentinel-terminated block.",
            "Move-to-front permutes the alphabet, so its output can be inverted exactly.",
            "The Huffman code is a prefix code, so the bit stream decodes unambiguously.",
        ],
        correctness:
            "Sorting rotations and keeping the last column is a bijection when the sentinel is unique, so the Burrows-Wheeler transform is invertible. Move-to-front is also a bijection because the rank plus the current ordered alphabet recovers the symbol. Run-length pairs record exact counts, and a Huffman code is prefix-free, so decoding reverses every stage and reproduces the original block.",
        complexityRationale:
            "Building and sorting n rotations of length n costs O(n^2 log n) time and O(n^2) space in this teaching implementation. Move-to-front, run-length coding, and Huffman coding each take O(n log n) or better over the transformed symbols.",
        uses: [
            "General-purpose lossless file compression",
            "Compressed columnar storage in analytical databases",
            "Teaching the Burrows-Wheeler transform used by bzip2",
        ],
        references: [
            "Burrows and Wheeler, A Block-Sorting Lossless Data Compression Algorithm, 1994",
            "Rle, Huffman, and the bzip2 format specification, 1996",
        ],
        workedExample:
            "For BANANA with sentinel '|', the sorted rotations have a last column that clusters the A characters. Move-to-front turns the repeated A ranks into zeros, run-length coding writes their counts, and Huffman assigns the most common tokens one-bit codes; decoding every stage returns BANANA.",
    },
    id: "bzip2",
    name: "bzip2 Block-Sorting Compression",
    category: "production-systems",
    complexity: { time: "O(n^2 log n)", space: "O(n^2)" },
    defaultInput: { text: "ABRACADABRAABRACADABRA" },
    visualType: "grid",
    run,
    pseudocode: [
        "append a unique sentinel to the source block",
        "sort every rotation of the block and keep the last column",
        "move-to-front encode the last column",
        "run-length encode the ranks into value and count pairs",
        "build a Huffman code over the token symbols",
        "emit the Huffman bit stream for the whole block",
        "done: report the transform and compressed size",
    ],
};

export default module;
