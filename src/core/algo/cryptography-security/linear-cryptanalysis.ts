/**
 * linear-cryptanalysis.ts - Linear Cryptanalysis (Toy Block Cipher)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Linear cryptanalysis looks for a biased linear relation between plaintext
 * bits, ciphertext bits, and key bits. For a four-bit S-box it searches all
 * input and output masks and keeps the pair whose parity is least uniform.
 * Applied to the toy cipher C = S(P xor K), the strongest approximation also
 * reveals the key: guessing the right K reproduces the S-box bias, while wrong
 * guesses look closer to random. This is a teaching model, not an attack on a
 * production cipher.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^(2w) + 2^w * 2^w) for w-bit masks and 2^w plaintexts
 *   Space: O(2^w) for the count tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero lists input masks; row one lists output masks and their counts.
 *   - The key guess row highlights the candidate with the strongest bias.
 *   - meta carries the best mask pair, the bias, and the recovered key.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LinearInput {
    key?: number;
    sbox?: number[];
}

const DEFAULT_SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7];

/** Parity of the bitwise and of a mask and a value. */
function parity(mask: number, value: number): number {
    let bits = mask & value;
    let result = 0;
    while (bits > 0) {
        result ^= bits & 1;
        bits >>>= 1;
    }
    return result;
}

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LinearInput | null) ?? {};
    const sbox = Array.isArray(task.sbox) && task.sbox.length === 16 ? task.sbox.map(Number) : DEFAULT_SBOX;
    const key = ((Math.floor(task.key ?? 6) % 16) + 16) % 16;
    let step = 0;
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 3, cols: 16, key, ...meta },
    });

    yield emit(
        sbox.map((value, i) => cell(`sb-${i}`, 0, i, String(value), value, "idle")),
        "Analyzing a four-bit S-box for biased linear input and output masks.",
        0,
        { stage: "setup", sbox: [...sbox] },
    );

    let bestX = 0;
    let bestY = 0;
    let bestCount = 8;
    let bestTable: Array<{ x: number; y: number; count: number }> = [];
    for (let x = 1; x < 16; x += 1) {
        let localY = 0;
        let localCount = 8;
        for (let y = 1; y < 16; y += 1) {
            let count = 0;
            for (let u = 0; u < 16; u += 1) {
                if (parity(x, u) === parity(y, sbox[u] as number)) count += 1;
            }
            bestTable.push({ x, y, count });
            if (Math.abs(count - 8) > Math.abs(localCount - 8)) {
                localCount = count;
                localY = y;
            }
        }
        if (Math.abs(localCount - 8) > Math.abs(bestCount - 8)) {
            bestCount = localCount;
            bestX = x;
            bestY = localY;
        }
        yield emit(
            [cell(`x-${x}`, 0, x, `x:${x}`, x, "active"), cell(`besty-${x}`, 1, x, `y:${localY} c:${localCount}`, localCount, "comparing")],
            `Input mask ${x}: best output mask ${localY} holds in ${localCount} of 16 cases (bias ${localCount - 8}).`,
            1,
            { stage: "mask-search", inputMask: x, bestOutputMask: localY, count: localCount },
        );
    }

    const trueBias = Math.abs(bestCount - 8);
    yield emit(
        [cell("bx", 0, bestX, `x:${bestX}`, bestX, "sorted"), cell("by", 1, bestY, `y:${bestY}`, bestY, "sorted")],
        `Best approximation: parity(${bestX} xor P) equals parity(${bestY} xor C) in ${bestCount} of 16 cases.`,
        2,
        { stage: "best", inputMask: bestX, outputMask: bestY, count: bestCount, bias: trueBias },
    );

    let recovered = 0;
    const evidence: string[] = [];
    for (const bitMask of [1, 2, 4, 8]) {
        const candidates = bestTable.filter((entry) => entry.x === bitMask).sort((a, b) => Math.abs(b.count - 8) - Math.abs(a.count - 8));
        const chosen = candidates[0] as { x: number; y: number; count: number };
        let observed = 0;
        for (let plaintext = 0; plaintext < 16; plaintext += 1) {
            const ciphertext = sbox[(plaintext ^ key) % 16] as number;
            if (parity(bitMask, plaintext) === parity(chosen.y, ciphertext)) observed += 1;
        }
        const bit = (observed > 8) === (chosen.count > 8) ? 0 : 1;
        if (bit === 1) recovered |= bitMask;
        evidence.push(`${bitMask}:${chosen.y}:${chosen.count}:${observed}:${bit}`);
        yield emit(
            [cell(`mask-${bitMask}`, 0, bitMask, `x:${bitMask}`, bitMask, "active"), cell(`obs-${bitMask}`, 1, bitMask, `s:${chosen.count} c:${observed}`, observed, "comparing"), cell(`bit-${bitMask}`, 2, bitMask, `bit:${bit}`, bit, "sorted")],
            `Basis mask ${bitMask} with output ${chosen.y}: S-box count ${chosen.count}, cipher count ${observed} -> key bit ${bit}.`,
            3,
            { stage: "key-search", bitMask, outputMask: chosen.y, sboxCount: chosen.count, cipherCount: observed, bit, recovered, evidence: [...evidence] },
        );
    }

    yield emit(
        [cell("true", 0, 0, `key:${key}`, key, "visited"), cell("guess", 1, 0, `guess:${recovered}`, recovered, recovered === key ? "sorted" : "error")],
        `Done: recovered key ${recovered} from four biased basis masks; the real key is ${key}.`,
        4,
        { stage: "done", recovered, key, correct: recovered === key, inputMask: bestX, outputMask: bestY, count: bestCount, bias: trueBias, evidence, bestTable: bestTable.map((e) => `${e.x}:${e.y}:${e.count}`) },
    );
}

/** The linear cryptanalysis module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A good cipher makes every parity of plaintext and ciphertext bits look like a fair coin. Linear cryptanalysis searches for the rare mask pair where the parity is slightly biased. Because the bias depends on the key, guessing the key and measuring the bias reveals the right guess: the correct key reproduces the strong bias while wrong keys wash it out.",
        invariants: [
            "A linear approximation is a xor of selected plaintext and ciphertext bits.",
            "Its bias is the deviation of its truth count from half the samples.",
            "The correct key guess reproduces the S-box bias for the chosen masks.",
        ],
        correctness:
            "For the one-round toy, parity(x and (P xor K)) xor parity(y and C) is biased for a good mask pair. Rearranging, parity(x and P) xor parity(y and C) differs from the S-box bias by parity(x and K). Choosing x from the four basis masks 1, 2, 4, and 8 reveals one bit of K each, because a sign change between the S-box count and the observed cipher count means that key bit is one. The exhaustive mask search guarantees a biased partner y exists for every basis mask.",
        complexityRationale:
            "Searching all 16 by 16 mask pairs over 16 inputs costs a constant number of operations here, or O(2^(2w) * 2^w) for w-bit words in general. Key recovery adds 16 guesses over 16 plaintexts. Storing the count table uses O(2^(2w)) space.",
        uses: [
            "Historical cryptanalysis of DES and FEAL",
            "Evaluating the linear resistance of new block-cipher S-boxes",
            "A teaching counterpart to differential cryptanalysis",
        ],
        references: [
            "Matsui, Linear Cryptanalysis Method for DES Cipher, EUROCRYPT 1993",
            "Heys, A Tutorial on Linear and Differential Cryptanalysis, 2002",
        ],
        workedExample:
            "With the PRESENT S-box the mask pair x=1, y=7 holds in 14 of 16 cases. The four basis masks 1, 2, 4, and 8 each have a biased partner; comparing each S-box count with the count seen on plaintext and ciphertext pairs reveals one bit of the key, which together reconstruct all four bits.",
    },
    id: "linear-cryptanalysis",
    name: "Linear Cryptanalysis (Toy Cipher)",
    category: "cryptography-security",
    complexity: { time: "O(2^(3w))", space: "O(2^(2w))" },
    defaultInput: { key: 6 },
    visualType: "grid",
    run,
    pseudocode: [
        "list all nonzero input and output masks",
        "count parity agreement for every mask pair",
        "select the pair with the largest absolute bias",
        "repeat for basis masks one two four and eight",
        "compare the s-box bias sign with the observed cipher sign",
        "set the corresponding key bit when the signs differ",
        "done: report the recovered key and the bias",
    ],
};

export default module;
