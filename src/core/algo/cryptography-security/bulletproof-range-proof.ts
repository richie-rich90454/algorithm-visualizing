/**
 * bulletproof-range-proof.ts - Bulletproof Inner-Product Range Argument (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A real Bulletproof proves that a committed value lies in a range without
 * revealing the value, using a logarithmic-size inner-product argument. This
 * teaching model implements ONLY the exact algebra of that argument: it
 * decomposes a value into bits, forms an inner-product commitment against
 * public generators, and compresses the inner product in log(n) fold rounds
 * while tracking the cross terms so the original inner product is recovered.
 *
 * This is NOT a secure or private range proof. There is no zero knowledge, no
 * hiding randomness, and no soundness against a dishonest prover. Only the
 * arithmetic of the bit decomposition and the inner-product fold is faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) per fold round, O(n) total for n a power of two
 *   Space: O(n) for the two vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two rows of cells show the current vectors a (bits) and b (generators).
 *   - Active cells are the surviving half after each fold; idle cells are spent.
 *   - The final frame is green when the recovered inner product equals the value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 2147483647n; // 2^31 - 1, a Mersenne prime

/** Modular exponentiation with big integers. */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return result;
}

/** Modular inverse via Fermat's little theorem (P is prime). */
function modInv(a: bigint): bigint {
    return modPow(a, P - 2n, P);
}

/** Build the two rows of vector cells for a frame. */
function makeCells(a: bigint[], b: bigint[], length: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let col = 0; col < length; col += 1) {
        const av = a[col] ?? 0n;
        const bv = b[col] ?? 0n;
        const activeA = col < a.length;
        const activeB = col < b.length;
        const stateA: EntityState = activeA ? "comparing" : "idle";
        const stateB: EntityState = activeB ? "active" : "idle";
        cells.push({
            id: `a-${col}`,
            type: "cell",
            label: av.toString(),
            value: Number(av),
            state: stateA,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, vector: "a" },
        });
        cells.push({
            id: `b-${col}`,
            type: "cell",
            label: bv.toString(),
            value: Number(bv),
            state: stateB,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, vector: "b" },
        });
    }
    return cells;
}

/** Inner product of two equal-length vectors modulo P. */
function inner(a: bigint[], b: bigint[]): bigint {
    let sum = 0n;
    for (let i = 0; i < a.length; i += 1) {
        sum = (sum + (a[i] ?? 0n) * (b[i] ?? 0n)) % P;
    }
    return sum;
}

/** The toy inner-product range argument generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { value?: number; bits?: number; u?: number } | null) ?? {};
    const rawValue = typeof task.value === "number" ? Math.floor(task.value) : 7;
    let bits = typeof task.bits === "number" ? Math.floor(task.bits) : 3;
    bits = Math.min(8, Math.max(2, bits));
    const modulus = 1 << bits;
    const inRange = rawValue >= 0 && rawValue < modulus;
    const value = ((rawValue % modulus) + modulus) % modulus;
    const u = BigInt(typeof task.u === "number" ? Math.floor(task.u) : 3);
    const uSafe = u === 0n ? 3n : u;
    const uInv = modInv(uSafe);

    // a is the bit decomposition of value (least significant bit first);
    // b is the vector of powers of two, so <a, b> equals value exactly.
    const a: bigint[] = [];
    const b: bigint[] = [];
    for (let i = 0; i < bits; i += 1) {
        a.push(BigInt((value >> i) & 1));
        b.push(1n << BigInt(i));
    }
    const startInner = inner(a, b);
    const cells = makeCells(a, b, bits);

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells,
        edges: [],
        description: `Commit value ${rawValue} with ${bits} bits: a is the bit vector, b holds the powers of two, and their inner product is ${startInner}. In range: ${inRange}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 2,
            cols: bits,
            value,
            bits,
            inRange,
            rounds: 0,
            folded: Number(startInner),
            recovered: Number(startInner),
            accepted: false,
            modulus,
        },
    };
    step += 1;

    let va = [...a];
    let vb = [...b];
    let totalCorrection = 0n;
    let folded = startInner;
    let rounds = 0;

    while (va.length > 1) {
        if (va.length % 2 === 1) {
            va.push(0n);
            vb.push(0n);
        }
        const half = va.length / 2;
        const a1 = va.slice(0, half);
        const a2 = va.slice(half);
        const b1 = vb.slice(0, half);
        const b2 = vb.slice(half);

        let c1 = 0n; // <a1, b2>
        let c2 = 0n; // <a2, b1>
        for (let i = 0; i < half; i += 1) {
            c1 = (c1 + (a1[i] ?? 0n) * (b2[i] ?? 0n)) % P;
            c2 = (c2 + (a2[i] ?? 0n) * (b1[i] ?? 0n)) % P;
        }
        const correction = (uInv * c1 + uSafe * c2) % P;

        const nextA: bigint[] = [];
        const nextB: bigint[] = [];
        for (let i = 0; i < half; i += 1) {
            nextA.push(((a1[i] ?? 0n) + uSafe * (a2[i] ?? 0n)) % P);
            nextB.push(((b1[i] ?? 0n) + uInv * (b2[i] ?? 0n)) % P);
        }

        const before = folded;
        folded = inner(nextA, nextB);
        totalCorrection = (totalCorrection + correction) % P;
        rounds += 1;
        va = nextA;
        vb = nextB;

        const recovered = ((folded - totalCorrection) % P + P) % P;
        yield {
            stepNumber: step,
            entities: makeCells(va, vb, bits),
            edges: [],
            description: `Fold round ${rounds}: compress ${half * 2} entries to ${half}; cross term ${correction}; inner product ${before} becomes ${folded}. Recovered so far: ${recovered}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: bits,
                value,
                bits,
                inRange,
                rounds,
                folded: Number(folded),
                correction: Number(correction),
                recovered: Number(recovered),
                accepted: false,
                modulus,
            },
        };
        step += 1;
    }

    const recovered = ((folded - totalCorrection) % P + P) % P;
    const accepted = recovered === BigInt(value) && inRange;
    yield {
        stepNumber: step,
        entities: makeCells(va, vb, bits),
        edges: [],
        description: `After ${rounds} fold round(s) the recovered inner product is ${recovered}, equal to the value ${value}. Range argument accepted: ${accepted}. This toy gives no zero knowledge or security.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 2,
            cols: bits,
            value,
            bits,
            inRange,
            rounds,
            folded: Number(folded),
            recovered: Number(recovered),
            accepted,
            modulus,
            note: "toy model: no zero knowledge, not secure",
        },
    };
}

/** The Bulletproof inner-product argument teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A range proof can be built from an inner product between a secret bit vector and a vector of powers of two, because that inner product reconstructs the committed value. Bulletproofs compress this inner product by repeatedly halving the vectors, keeping only a constant amount of cross-term information per round. The result is a proof whose size grows logarithmically with the number of bits, not linearly.",
        invariants: [
            "The vector a is a binary decomposition and b holds powers of two, so their inner product equals the value.",
            "After each fold the new inner product equals the old inner product plus the recorded cross term, all modulo the prime P.",
            "The recovered inner product, obtained by subtracting all accumulated cross terms, always equals the original value.",
        ],
        correctness:
            "Writing a = (a1, a2) and b = (b1, b2), the fold a' = a1 + u*a2 and b' = b1 + u-inverse*b2 gives <a', b'> = <a, b> + u-inverse*<a1, b2> + u*<a2, b1>. The two cross terms are recorded, so telescoping over all rounds recovers the original inner product exactly in modular arithmetic. Since <a, b> is the binary reconstruction of the value, a match proves the decomposition encodes that value; the bit constraint is what a full proof would additionally enforce with zero knowledge.",
        complexityRationale:
            "A fold round halves both vectors and scans them once, so each round costs O(n) and there are log base two of n rounds; the total work is O(n) for a power-of-two length. Two vectors of length n occupy O(n) space.",
        uses: [
            "A teaching model for the Bulletproofs inner-product argument",
            "Explaining logarithmic-size range proofs in confidential transactions",
            "A stepping stone to understanding aggregated range proofs",
        ],
        references: [
            "Bunz, Bootle, Boneh, Poelstra, Wuille, and Maxwell, Bulletproofs, 2018",
            "Bootle, Cerulli, Chaidos, Groth, and Stafford, Efficient Zero-Knowledge Arguments for Arithmetic Circuits, 2016",
        ],
        workedExample:
            "For value 7 with 3 bits, a = (1, 1, 1) and b = (1, 2, 4), so the inner product is 7. With challenge u = 3 the first fold compresses the vectors to length two and records a cross term; the second fold reaches length one. Subtracting both cross terms from the final inner product returns 7, confirming the argument.",
    },
    id: "bulletproof-range-proof",
    name: "Bulletproof Range Proof (Toy Inner-Product Argument)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { value: 7, bits: 3, u: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "decompose the value into n bits forming vector a",
        "set vector b to the powers of two and commit with the inner product",
        "while the vectors have more than one entry",
        "split each vector into low and high halves",
        "fold using challenge u and record the cross terms",
        "replace the vectors with the folded pair",
        "recover the original inner product from the final value and cross terms",
        "accept when the recovered inner product equals the value and it is in range",
        "done: report the recovered value without revealing any secrecy guarantee",
    ],
};

export default module;
