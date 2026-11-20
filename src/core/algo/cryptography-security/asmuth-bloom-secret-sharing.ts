/**
 * asmuth-bloom-secret-sharing.ts - Asmuth-Bloom Threshold Secret Sharing (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Asmuth-Bloom is a threshold secret sharing scheme based on the Chinese
 * remainder theorem. The secret is hidden as the residue of a carefully chosen
 * number y modulo a small modulus m0, and each share is y reduced modulo one of
 * several larger pairwise coprime moduli. Any threshold number of shares pins
 * y down uniquely by CRT; fewer shares leave too many possibilities. The small
 * moduli here are for teaching, not for security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) modular reductions to share, O(t squared) for CRT recovery
 *   Space: O(n) for the shares
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a named value: secret, moduli, hidden y, shares, recovery.
 *   - The share rows are yellow; the recovered secret is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function modInverse(value: bigint, modulus: bigint): bigint {
    let [oldR, r] = [((value % modulus) + modulus) % modulus, modulus];
    let [oldS, s] = [1n, 0n];
    while (r !== 0n) {
        const quotient = oldR / r;
        [oldR, r] = [r, oldR - quotient * r];
        [oldS, s] = [s, oldS - quotient * s];
    }
    return ((oldS % modulus) + modulus) % modulus;
}

/** Solve a CRT system over pairwise coprime moduli. */
export function crtSolve(residues: bigint[], moduli: bigint[]): bigint {
    let x = 0n;
    let product = 1n;
    for (let i = 0; i < residues.length; i += 1) {
        const m = moduli[i]!;
        const a = residues[i]!;
        const delta = ((((a - x) % m) + m) % m * modInverse(product % m, m)) % m;
        x += product * delta;
        product *= m;
        x %= product;
    }
    return x;
}

export interface AsmuthShare {
    index: number;
    value: bigint;
}

/** Create one share per moduli entry after the secret modulus m0. */
export function asmuthBloomShare(secret: bigint, moduli: bigint[], r: bigint): { y: bigint; shares: AsmuthShare[] } {
    const m0 = moduli[0]!;
    const y = secret + r * m0;
    const shares: AsmuthShare[] = [];
    for (let i = 1; i < moduli.length; i += 1) {
        shares.push({ index: i, value: ((y % moduli[i]!) + moduli[i]!) % moduli[i]! });
    }
    return { y, shares };
}

/** Recover the secret from at least t shares using CRT. */
export function asmuthBloomRecover(shares: AsmuthShare[], moduli: bigint[]): bigint {
    const residues = shares.map((share) => share.value);
    const selected = shares.map((share) => moduli[share.index]!);
    const y = crtSolve(residues, selected);
    return ((y % moduli[0]!) + moduli[0]!) % moduli[0]!;
}

const LABELS = [
    "secret s",
    "modulus m0",
    "random r",
    "hidden y",
    "share mod m1",
    "share mod m2",
    "share mod m3",
    "recovered s",
];

function makeCells(values: string[], activeRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    LABELS.forEach((label, row) => {
        const present = values[row] !== undefined;
        for (let col = 0; col < 2; col += 1) {
            let state: EntityState = "idle";
            if (present) state = col === 0 ? "comparing" : "visited";
            if (col === 1 && row === LABELS.length - 1 && present) state = "sorted";
            if (row === activeRow && present) state = "active";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: col === 0 ? label : (values[row] ?? "-"),
                value: col === 0 ? label : (values[row] ?? "-"),
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, label, value: values[row] ?? "" },
            });
        }
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { secret?: number; moduli?: number[]; threshold?: number; r?: number } | null
    ) ?? {};
    const moduli = (Array.isArray(task.moduli) && task.moduli.length >= 3
        ? task.moduli
        : [7, 11, 13, 17]).map((m) => BigInt(m));
    const secret = BigInt(typeof task.secret === "number" ? task.secret : 5) % moduli[0]!;
    const threshold = typeof task.threshold === "number" ? Math.max(2, Math.floor(task.threshold)) : 2;
    const M = moduli.slice(1).reduce((product, m) => product * m, 1n);
    // Any t shares must uniquely determine y, so y stays below the product of
    // the smallest t share moduli, not the product of all of them.
    const bound = moduli.slice(1, 1 + threshold).reduce((product, m) => product * m, 1n);
    const maxR = (bound - 1n - secret) / moduli[0]!;
    const r = BigInt(typeof task.r === "number" ? task.r : 42) % (maxR + 1n);
    const { y, shares } = asmuthBloomShare(secret, moduli, r);
    const chosen = shares.slice(0, threshold);
    const recovered = asmuthBloomRecover(chosen, moduli);

    const values: string[] = [];
    const set = (index: number, value: bigint): void => {
        values[index] = String(value);
    };
    const metaBase = {
        rows: LABELS.length,
        cols: 2,
        secret: String(secret),
        m0: String(moduli[0]!),
        r: String(r),
        y: String(y),
        M: String(M),
        bound: String(bound),
        threshold,
        shares: shares.map((share) => String(share.value)),
        modulusList: moduli.slice(1).map(String),
        recovered: String(recovered),
    };

    let step = 0;
    set(0, secret); set(1, moduli[0]!); set(2, r); set(3, y);
    yield {
        stepNumber: step,
        entities: makeCells(values, 3),
        edges: [],
        description: `Hide secret ${secret} in y = ${secret} + ${r} times ${moduli[0]} = ${y}, below the ${threshold}-share bound ${bound}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    shares.forEach((share, i) => set(4 + i, share.value));
    yield {
        stepNumber: step,
        entities: makeCells(values, 4 + shares.length - 1),
        edges: [],
        description: `Computed ${shares.length} share(s) by reducing y modulo each larger coprime modulus.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: metaBase,
    };
    step += 1;

    set(LABELS.length - 1, recovered);
    yield {
        stepNumber: step,
        entities: makeCells(values, LABELS.length - 1),
        edges: [],
        description: `Reconstructed with ${threshold} share(s): CRT recovers y = ${y}, and y modulo m0 gives secret ${recovered}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: metaBase,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick a secret smaller than a small modulus m0, then hide it inside a larger number y that is the secret plus a random multiple of m0. Hand out remainders of y modulo several bigger, pairwise coprime numbers. Each share alone says almost nothing, but once you have enough of them the Chinese remainder theorem reconstructs y uniquely, and reducing y by m0 reveals the secret.",
        invariants: [
            "The hidden value y is smaller than the product of the smallest t share moduli.",
            "Every share is y reduced modulo its own pairwise coprime modulus.",
            "The secret equals y reduced modulo m0.",
        ],
        correctness:
            "The moduli condition m0 times the product of the largest t minus one moduli is below the product of all moduli guarantees enough room for a hidden y. Keeping y below the product of the smallest t share moduli means any t shares have a coprime product exceeding y, so CRT returns exactly y and y modulo m0 is the secret. With only t minus one shares the product is too small, leaving multiple candidates that reduce to different secrets, which is why the threshold is necessary.",
        complexityRationale:
            "Generating shares performs one modular reduction per share, so O(n) work. Recovery solves a CRT system of t congruences with extended Euclid inverses, costing O(t squared) modular operations. All arithmetic uses big integers sized by the moduli product.",
        uses: [
            "Teaching threshold access control with number-theoretic shares",
            "Splitting a key so that a quorum of custodians must cooperate",
            "Comparing CRT-based sharing with polynomial-based Shamir sharing",
        ],
        references: [
            "Asmuth and Bloom, A Modular Approach to Key Safeguarding, 1983",
            "Katz and Lindell, Introduction to Modern Cryptography, Chapter 4, 2020",
        ],
        workedExample:
            "With secret 5, m0 = 7, moduli 11, 13, 17, and threshold 2, the two-share bound is 11 times 13, or 143. Choose r = 2 so y = 5 + 14 = 19. The shares are 19 mod 11 = 8, 19 mod 13 = 6, and 19 mod 17 = 2. Any two shares reconstruct y = 19 by CRT, and 19 mod 7 returns the secret 5; one share alone leaves several possible secrets.",
    },
    id: "asmuth-bloom-secret-sharing",
    name: "Asmuth-Bloom Secret Sharing (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(t squared)", space: "O(n)" },
    defaultInput: { secret: 5, moduli: [7, 11, 13, 17], threshold: 2, r: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose pairwise coprime moduli m0 smaller than m1 through mn",
        "pick a secret below m0 and a random r so y is below the share product",
        "set y to secret plus r times m0",
        "give each participant y reduced modulo their own modulus",
        "collect at least t shares and solve the CRT system",
        "reduce the recovered y modulo m0 to reveal the secret",
        "done: report the shares and the recovered secret",
    ],
};

export default module;
