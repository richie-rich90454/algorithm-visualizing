/**
 * merkle-hellman-knapsack.ts - Merkle-Hellman Knapsack Cryptosystem (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Merkle-Hellman cryptosystem hides an easy superincreasing knapsack by
 * multiplying every weight by a secret factor modulo a larger number. The
 * public weights look random, so forming a subset sum is easy but recovering
 * the subset seems hard. The private factor undoes the disguise and reveals
 * the easy knapsack. It was broken by Shamir's attack and is shown only for
 * its historical idea; the tiny parameters here are not secure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to encrypt or decrypt an n-bit message
 *   Space: O(n) for the displayed weights and bits
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row 0: private superincreasing weights.
 *   - Row 1: public disguised weights.
 *   - Row 2: the message bits; set bits contribute to the ciphertext.
 *   - Decryption highlights each weight as the greedy subtraction runs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KnapsackInput {
    bits?: number[];
    weights?: number[];
    modulus?: number;
    multiplier?: number;
}

/** Extended Euclidean inverse of a modulo m. */
function modInverse(a: number, m: number): number {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1;
    let s = 0;
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        const nextR = oldR - quotient * r;
        oldR = r;
        r = nextR;
        const nextS = oldS - quotient * s;
        oldS = s;
        s = nextS;
    }
    return ((oldS % m) + m) % m;
}

/** Build the three rows of cells. */
function makeCells(
    weights: number[],
    publicKeys: number[],
    bits: number[],
    highlight: number,
    row: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    weights.forEach((value, index) => {
        entities.push({
            id: `w-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (row === 0 && index === highlight ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, value },
        });
    });
    publicKeys.forEach((value, index) => {
        entities.push({
            id: `b-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (row === 1 && index === highlight ? "comparing" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index, value },
        });
    });
    bits.forEach((bit, index) => {
        entities.push({
            id: `bit-${index}`,
            type: "cell" as const,
            label: String(bit),
            value: bit,
            state: (row === 2 && index === highlight ? "comparing" : bit === 1 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 2, col: index, bit },
        });
    });
    return entities;
}

/** The Merkle-Hellman generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KnapsackInput | null) ?? {};
    const weights = Array.isArray(task.weights) ? [...task.weights] : [2, 3, 6, 13, 27, 52, 105, 210];
    const n = weights.length;
    const modulus = typeof task.modulus === "number" ? task.modulus : 541;
    const multiplier = typeof task.multiplier === "number" ? task.multiplier : 17;
    const bits = Array.isArray(task.bits)
        ? weights.map((_, index) => (task.bits?.[index] === 1 ? 1 : 0))
        : [1, 0, 1, 1, 0, 1, 0, 1];
    const publicKeys = weights.map((weight) => (multiplier * weight) % modulus);
    const inverse = modInverse(multiplier, modulus);
    let ciphertext = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(weights, publicKeys, bits, -1, -1),
        edges: [],
        description: `Merkle-Hellman with ${n} weights, modulus ${modulus}, and multiplier ${multiplier}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: n, modulus, multiplier, inverse, ciphertext: 0, recovered: "", n },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        if (bits[i] === 1) {
            ciphertext += publicKeys[i] ?? 0;
        }
        yield {
            stepNumber: step,
            entities: makeCells(weights, publicKeys, bits, i, 2),
            edges: [],
            description: `Bit ${i} is ${bits[i]}; cumulative public subset sum is ${ciphertext}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 3, cols: n, modulus, multiplier, inverse, ciphertext, recovered: "", n },
        };
        step += 1;
    }

    let reduced = (ciphertext * inverse) % modulus;
    yield {
        stepNumber: step,
        entities: makeCells(weights, publicKeys, bits, -1, 1),
        edges: [],
        description: `Private multiplier gives reduced sum ${reduced} on the easy knapsack.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 3, cols: n, modulus, multiplier, inverse, ciphertext, reduced, recovered: "", n },
    };
    step += 1;

    const recovered = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        const weight = weights[i] ?? 0;
        if (reduced >= weight) {
            reduced -= weight;
            recovered[i] = 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(weights, publicKeys, recovered, i, 0),
            edges: [],
            description: `Greedy test on weight ${weight}: bit ${i} = ${recovered[i]}, remainder ${reduced}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                rows: 3,
                cols: n,
                modulus,
                multiplier,
                inverse,
                ciphertext,
                reduced,
                recovered: recovered.join(""),
                n,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(weights, publicKeys, recovered, -1, -1),
        edges: [],
        description: `Recovered message ${recovered.join("")} from ciphertext ${ciphertext}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 3,
            cols: n,
            modulus,
            multiplier,
            inverse,
            ciphertext,
            reduced,
            recovered: recovered.join(""),
            n,
        },
    };
}

/** The Merkle-Hellman module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An easy knapsack is one whose weights are superincreasing: each weight exceeds the sum of all smaller ones, so a greedy subtraction reads off the subset. Multiplying every weight by a secret number modulo a larger secret modulus scrambles them into a hard-looking public key. The owner multiplies the ciphertext by the inverse factor, restoring the easy knapsack and the greedy solution.",
        invariants: [
            "Each private weight is larger than the sum of all smaller weights.",
            "The modulus exceeds the sum of all private weights.",
            "The multiplier and modulus are relatively prime.",
        ],
        correctness:
            "Because the modulus is larger than the total private sum, no wraparound occurs during decryption after multiplying by the inverse. The inverse multiplication maps every public weight back to its private value, so the reduced ciphertext is exactly the private subset sum. For a superincreasing sequence, the largest weight not exceeding the remainder must belong to the subset, so greedy subtraction recovers the original bits uniquely. The companion test brute-forces every possible bit pattern and confirms exact recovery.",
        complexityRationale:
            "Encryption sums at most n public weights and decryption performs one multiplication plus n greedy comparisons, so both take O(n) arithmetic operations. The three displayed rows use O(n) space; the cipher itself stores only the current sums.",
        uses: [
            "A historical first public-key cryptosystem",
            "Teaching the difference between easy and hard knapsack instances",
            "Motivating lattice-reduction attacks on hidden structure",
        ],
        references: [
            "Merkle and Hellman, Hiding Information and Signatures in Trapdoor Knapsacks, 1978",
            "Shamir, A Polynomial-Time Algorithm for Breaking the Basic Merkle-Hellman Cryptosystem, 1984",
        ],
        workedExample:
            "With weights 2, 3, 6 and multiplier 7 modulo 17, public weights are 14, 4, 8. The message 101 gives ciphertext 22. Multiplying by the inverse of 7, which is 5, gives 110 mod 17 = 8, and greedy subtraction on 2, 3, 6 recovers 101.",
    },
    id: "merkle-hellman-knapsack",
    name: "Merkle-Hellman Knapsack (Teaching Model)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        bits: [1, 0, 1, 1, 0, 1, 0, 1],
        weights: [2, 3, 6, 13, 27, 52, 105, 210],
        modulus: 541,
        multiplier: 17,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with a superincreasing private weight list",
        "choose a modulus larger than the weight sum and a coprime multiplier",
        "publish each weight multiplied by the multiplier modulo the modulus",
        "encrypt by summing public weights where the message bit is one",
        "decrypt by multiplying the ciphertext by the inverse multiplier",
        "scan private weights from largest to smallest",
        "subtract a weight and set the bit when it fits the remainder",
        "done: report the ciphertext and recovered message",
    ],
};

export default module;
