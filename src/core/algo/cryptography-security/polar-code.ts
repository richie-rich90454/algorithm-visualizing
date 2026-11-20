/**
 * polar-code.ts - Polar Code (Toy Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small teaching model of an Arikan polar code with block length 8.
 * A message is placed on the reliable synthetic positions and the remaining
 * positions are frozen to zero. The codeword is x = u times G, where G is the
 * third Kronecker power of [[1,0],[1,1]], computed modulo 2. Decoding is an
 * exhaustive maximum-likelihood search over the eight possible information
 * words: pick the one whose codeword is closest to the received bits.
 *
 * NOTE: this is a faithful miniature (N = 8, k = 3, noiseless channel in the
 * default demo), not a full 5G-grade polar codec with list decoding.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^k * N log N) for the search and the polar transforms
 *   Space: O(N log N) for the matrices and the displayed bits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0 holds the input bits u; frozen bits are idle, information bits active.
 *   - Row 1 holds the generated codeword x.
 *   - Decode frames show each candidate information word and its distance score.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 8;
const FROZEN = [0, 1, 2, 3, 4];
const INFO = [5, 6, 7];
const K = INFO.length;

/** Kronecker product of two binary matrices. */
function kron(a: number[][], b: number[][]): number[][] {
    const rows = a.length * b.length;
    const cols = (a[0]?.length ?? 0) * (b[0]?.length ?? 0);
    const out: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[i]?.length ?? 0); j += 1) {
            for (let p = 0; p < b.length; p += 1) {
                for (let q = 0; q < (b[p]?.length ?? 0); q += 1) {
                    const cell = out[i * b.length + p];
                    if (cell && a[i]?.[j] && b[p]?.[q]) cell[j * (b[p]?.length ?? 0) + q] = 1;
                }
            }
        }
    }
    return out;
}

/** Generator matrix G = [[1,0],[1,1]] raised to the third Kronecker power. */
function generator(): number[][] {
    const base = [
        [1, 0],
        [1, 1],
    ];
    return kron(kron(base, base), base);
}

/** Encode input bits u into a codeword x modulo 2. */
function encodeBits(u: number[], g: number[][]): number[] {
    return g.map((row) => {
        let parity = 0;
        for (let i = 0; i < u.length; i += 1) parity ^= (row[i] ?? 0) & (u[i] ?? 0);
        return parity;
    });
}

/** Build an input vector from an information word, freezing all other bits. */
function makeInput(message: number[]): number[] {
    const u = new Array<number>(N).fill(0);
    INFO.forEach((pos, i) => {
        u[pos] = message[i] ?? 0;
    });
    return u;
}

/** Exhaustive maximum-likelihood decode over all information words. */
function exhaustiveDecode(y: number[], g: number[][]): { decoded: number[]; chosen: number; distance: number } {
    let best: number[] = [];
    let bestWord = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let word = 0; word < 2 ** K; word += 1) {
        const message = Array.from({ length: K }, (_, i) => (word >> (K - 1 - i)) & 1);
        const codeword = encodeBits(makeInput(message), g);
        const distance = codeword.reduce((sum, bit, i) => sum + (bit === y[i] ? 0 : 1), 0);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = message;
            bestWord = word;
        }
    }
    return { decoded: best, chosen: bestWord, distance: bestDistance };
}

/** Build the two-row bit display. */
function buildEntities(u: number[], x: number[], active: number): VisualEntity[] {
    const entities: VisualEntity[] = u.map((bit, col) => ({
        id: `u-${col}`,
        type: "cell" as const,
        label: String(bit),
        value: bit,
        state: (FROZEN.includes(col) ? "idle" : col <= active ? "active" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col, kind: "u", frozen: FROZEN.includes(col) },
    }));
    x.forEach((bit, col) => {
        entities.push({
            id: `x-${col}`,
            type: "cell" as const,
            label: String(bit),
            value: bit,
            state: "visited" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, kind: "x" },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number[] } | null) ?? {};
    const fallback = [1, 0, 1];
    const message: number[] =
        Array.isArray(task.message) && task.message.length === K
            ? task.message.map((bit) => (bit === 0 || bit === 1 ? bit : bit ? 1 : 0))
            : fallback;
    const g = generator();
    const u = makeInput(message);
    const x = encodeBits(u, g);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(u, x, -1),
        edges: [],
        description: `Polar code N=${N}, k=${K}: message ${message.join("")} placed on information positions ${INFO.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: N, N, k: K, frozen: FROZEN, info: INFO, u: u.slice(), x: x.slice(), decoded: [], phase: "start" },
    };

    for (let i = 0; i < K; i += 1) {
        yield {
            stepNumber: step++,
            entities: buildEntities(u, x, INFO[i] as number),
            edges: [],
            description: `Information bit ${message[i]} assigned to synthetic channel ${INFO[i]}; other positions stay frozen at zero.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: N,
                N,
                k: K,
                frozen: FROZEN,
                info: INFO,
                u: u.slice(),
                x: x.slice(),
                decoded: [],
                phase: "place",
                index: i,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(u, x, N - 1),
        edges: [],
        description: `Polar transform produced codeword ${x.join("")} by multiplying u by G modulo 2.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: N, N, k: K, frozen: FROZEN, info: INFO, u: u.slice(), x: x.slice(), decoded: [], phase: "encode" },
    };

    const result = exhaustiveDecode(x.slice(), g);
    for (let word = 0; word < 2 ** K; word += 1) {
        const candidate = Array.from({ length: K }, (_, i) => (word >> (K - 1 - i)) & 1);
        const candidateCodeword = encodeBits(makeInput(candidate), g);
        const distance = candidateCodeword.reduce((sum, bit, i) => sum + (bit === x[i] ? 0 : 1), 0);
        yield {
            stepNumber: step++,
            entities: buildEntities(makeInput(candidate), candidateCodeword, N - 1),
            edges: [],
            description: `Candidate ${candidate.join("")} gives codeword ${candidateCodeword.join("")} at Hamming distance ${distance} from the received word.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: 2,
                cols: N,
                N,
                k: K,
                frozen: FROZEN,
                info: INFO,
                u: makeInput(candidate),
                x: candidateCodeword,
                decoded: candidate,
                phase: "candidate",
                word,
                distance,
            },
        };
    }

    const correct = result.decoded.every((bit, i) => bit === message[i]);
    yield {
        stepNumber: step++,
        entities: buildEntities(makeInput(result.decoded), x, N - 1),
        edges: [],
        description: `Closest codeword gives message ${result.decoded.join("")} at distance ${result.distance}; ${correct ? "message recovered" : "mismatch"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 2,
            cols: N,
            N,
            k: K,
            frozen: FROZEN,
            info: INFO,
            u: makeInput(result.decoded),
            x: x.slice(),
            decoded: result.decoded,
            distance: result.distance,
            phase: "done",
            correct,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A polar code splits a channel into synthetic subchannels, some reliable and some useless. Put message bits on the reliable ones and fixed zero bits on the rest, then multiply by a structured matrix to spread each bit across the whole codeword. This miniature keeps the encoder faithful and decodes by trying every possible short message and keeping the one whose codeword matches the received bits best.",
    invariants: [
        "Frozen positions always carry zero.",
        "The codeword equals u multiplied by G modulo 2.",
        "The decoder picks the information word with the smallest Hamming distance to the received bits.",
    ],
    correctness:
        "The generator matrix is invertible over the binary field, so distinct information words produce distinct codewords. On a noiseless channel the transmitted codeword has distance zero from itself and every other codeword has positive distance, so exhaustive maximum-likelihood decoding returns the transmitted bits uniquely. This miniature freezes a fixed prefix rather than channel-optimized positions, which is sufficient to demonstrate the transform and the decoding search.",
    complexityRationale:
        "Encoding multiplies an N-bit vector by an N by N matrix, costing O(N log N) with the structured generator. Decoding tries 2^k information words and encodes each one, so time is O(2^k * N log N); with k = 3 and N = 8 this is a small constant. The matrix and the displayed bits use O(N log N) space.",
    uses: [
        "Error correction in 5G control channels",
        "Teaching channel polarization and maximum-likelihood decoding",
        "A building block for more advanced list-decoded polar codes",
    ],
    references: [
        "Arikan, Channel Polarization, IEEE Trans. Information Theory 2009",
        "Wikipedia, Polar code",
    ],
    workedExample:
        "With N=8 and message 101 placed on positions 5,6,7, the input vector is 00000101. Multiplying by G modulo 2 yields the 8-bit codeword. The decoder tries all eight messages and finds that 101 is the one whose codeword matches exactly.",
    },
    id: "polar-code",
    name: "Polar Code (Toy Teaching Model)",
    category: "cryptography-security",
    complexity: { time: "O(2^k * N log N)", space: "O(N log N)" },
    defaultInput: { message: [1, 0, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the block length, frozen positions and information positions",
        "place the message bits on the information positions",
        "set every frozen position to zero",
        "build the generator matrix as a Kronecker power",
        "multiply the input vector by the matrix modulo 2 to get the codeword",
        "for each possible information word, encode it and measure its distance",
        "select the word whose codeword is closest to the received bits",
    ],
};

export default module;
