/**
 * hamming-code.ts - Hamming(7,4) Single-Error-Correcting Code
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hamming(7,4) code appends three parity bits to four data bits so that
 * any single-bit corruption can be located and repaired. Parity bit 1 covers
 * positions 1, 3, 5, 7, parity bit 2 covers 2, 3, 6, 7, and parity bit 4
 * covers 4, 5, 6, 7, all with even parity. Recomputing the three checks after
 * transmission forms a syndrome whose binary value is the bad position.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per seven-bit codeword
 *   Space: O(1) for the codeword and syndrome
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Seven bars show the codeword positions 1 through 7.
 *   - Parity computation highlights the positions being checked.
 *   - The corrupted bit turns red and the corrected codeword turns green.
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualEntity, VisualFrame } from "@/types";

/** Even parity over the listed one-based positions of a codeword. */
function parityAt(bits: number[], positions: number[]): number {
    return positions.reduce((sum, position) => sum + (bits[position - 1] ?? 0), 0) % 2;
}

/** The Hamming(7,4) code module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bits?: number[]; errorBit?: number } | null) ?? {};
    const raw = Array.isArray(task.bits) ? task.bits.map((bit) => (Number(bit) ? 1 : 0)) : [1, 0, 1, 1];
    const data = [raw[0] ?? 0, raw[1] ?? 0, raw[2] ?? 0, raw[3] ?? 0];
    const errorBit = typeof task.errorBit === "number" ? Math.max(-1, Math.min(7, Math.floor(task.errorBit))) : 2;

    const codeword = [0, 0, data[0] as number, 0, data[1] as number, data[2] as number, data[3] as number];
    let emitStep = 0;
    const bars = (highlight: Set<number>, states: Map<number, EntityState>): VisualEntity[] =>
        codeword.map((bit, index) => ({
            id: `bit-${index + 1}`,
            type: "bar" as const,
            label: String(bit),
            value: bit,
            state: (states.get(index) ?? (highlight.has(index) ? "comparing" : "idle")) as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { position: index + 1, role: [1, 2, 4].includes(index + 1) ? "parity" : "data" },
        }));

    const emit = (
        description: string,
        codeLineNumber: number,
        highlight: Set<number>,
        states: Map<number, EntityState>,
        extra: Record<string, MetaValue> = {},
    ): VisualFrame => ({
        stepNumber: emitStep++,
        entities: bars(highlight, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { data: data.slice(), codeword: codeword.slice(), errorBit, ...extra },
    });

    yield emit(`Placed the four data bits at positions 3, 5, 6 and 7.`, 0, new Set([2, 4, 5, 6]), new Map());
    codeword[0] = parityAt(codeword, [1, 3, 5, 7]);
    yield emit(`Parity bit 1 covers positions 1, 3, 5, 7 and is ${codeword[0]}.`, 1, new Set([0, 2, 4, 6]), new Map());
    codeword[1] = parityAt(codeword, [2, 3, 6, 7]);
    yield emit(`Parity bit 2 covers positions 2, 3, 6, 7 and is ${codeword[1]}.`, 2, new Set([1, 2, 5, 6]), new Map());
    codeword[3] = parityAt(codeword, [4, 5, 6, 7]);
    yield emit(`Parity bit 4 covers positions 4, 5, 6, 7 and is ${codeword[3]}.`, 3, new Set([3, 4, 5, 6]), new Map());

    const transmitted = codeword.slice();
    if (errorBit >= 1 && errorBit <= 7) transmitted[errorBit - 1] = (transmitted[errorBit - 1] as number) ^ 1;
    for (let i = 0; i < 7; i += 1) codeword[i] = transmitted[i] as number;
    const corruptStates = new Map<number, EntityState>();
    if (errorBit >= 1 && errorBit <= 7) corruptStates.set(errorBit - 1, "error");
    yield emit(
        errorBit >= 1 && errorBit <= 7
            ? `Simulated a flipped bit at position ${errorBit}; the receiver sees ${codeword.join("")}.`
            : "No transmission error was introduced.",
        4,
        new Set(),
        corruptStates,
        { transmitted: transmitted.slice(), syndrome: -1 },
    );

    const syndrome =
        parityAt(codeword, [1, 3, 5, 7]) +
        2 * parityAt(codeword, [2, 3, 6, 7]) +
        4 * parityAt(codeword, [4, 5, 6, 7]);
    yield emit(
        `The three parity checks form syndrome ${syndrome}, which identifies position ${syndrome}.`,
        5,
        syndrome >= 1 && syndrome <= 7 ? new Set([syndrome - 1]) : new Set(),
        corruptStates,
        { transmitted: transmitted.slice(), syndrome },
    );

    if (syndrome >= 1 && syndrome <= 7) codeword[syndrome - 1] = (codeword[syndrome - 1] as number) ^ 1;
    const correctedStates = new Map<number, EntityState>();
    for (let i = 0; i < 7; i += 1) correctedStates.set(i, "sorted");
    const corrected = [codeword[2] as number, codeword[4] as number, codeword[5] as number, codeword[6] as number];
    yield emit(
        `After correction the codeword is ${codeword.join("")} and the four data bits are ${corrected.join("")}.`,
        7,
        new Set(),
        correctedStates,
        { transmitted: transmitted.slice(), syndrome, corrected, syndromeValid: data.every((bit, i) => bit === corrected[i]) },
    );
}

/** The Hamming(7,4) code module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Hamming codes add just enough parity bits that the pattern of failed parity checks names the corrupt position. With four data bits we need three parity bits, because three bits can distinguish seven error positions plus no error. Each parity bit watches a different subset of positions, so a flipped bit changes exactly the checks whose subsets contain it.",
        invariants: [
            "With no error every one of the three parity checks has even parity.",
            "The syndrome is the binary position of the corrupted bit, or zero for no error.",
            "Data bits occupy positions 3, 5, 6 and 7.",
        ],
        correctness:
            "Position k from 1 to 7 has a unique three-bit binary representation. Parity bit 1 is the first bit of that representation, parity bit 2 the second, and parity bit 4 the third, so a single flip at position k toggles exactly the parity checks whose representation bit is one. The syndrome therefore equals k in binary. Flipping that position restores every check, and because the minimum distance of the code is three, no single flip can turn one valid codeword into another.",
        complexityRationale:
            "Encoding sets three parity bits and decoding evaluates three parity expressions, each a constant-size XOR, so both are O(1) per codeword. The codeword and syndrome occupy constant space.",
        uses: [
            "Error correction in memory systems and ECC RAM",
            "Reliable transmission over noisy channels",
            "Teaching the idea of a syndrome before modern LDPC codes",
        ],
        references: [
            "Hamming, Error Detecting and Error Correcting Codes, 1950",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter on error-correcting codes",
        ],
        workedExample:
            "Data bits 1, 0, 1, 1 go into positions 3, 5, 6, 7. Even parity sets bit 1 to 0, bit 2 to 1, and bit 4 to 0, giving 0 1 1 0 0 1 1. If position 3 flips, the received word fails checks 1 and 2 but not 4, so the syndrome is 3 and flipping position 3 repairs the word.",
    },
    id: "hamming-code",
    name: "Hamming(7,4) Code",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { bits: [1, 0, 1, 1], errorBit: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "place four data bits in positions 3, 5, 6 and 7",
        "set parity bit 1 for even parity over positions 1, 3, 5, 7",
        "set parity bit 2 for even parity over positions 2, 3, 6, 7",
        "set parity bit 4 for even parity over positions 4, 5, 6, 7",
        "flip the indicated bit to simulate transmission noise",
        "recompute the three checks to form the syndrome",
        "if the syndrome is nonzero, flip that bit to correct it",
        "done: report the corrected four data bits",
    ],
};

export default module;
