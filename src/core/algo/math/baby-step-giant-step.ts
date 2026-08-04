/**
 * baby-step-giant-step.ts – Baby-Step Giant-Step (discrete logarithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Baby-step giant-step solves the discrete logarithm problem: find x with
 * a^x ≡ b (mod p). It splits x = m·q + r into a "giant" part q and a "baby"
 * part r, where m = ⌈√p⌉:
 *
 *   1. Baby steps: compute and store a^r for r = 0..m−1.
 *   2. Giant steps: check whether b·a^(−m·q) matches any baby step.
 *
 * The meet-in-the-middle structure brings the time to O(√p).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(√p) time and space (hash map of baby steps)
 *   Space: O(√p)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Baby steps are laid out as cells.
 *   - The matching giant step is YELLOW (comparing).
 *   - The found exponent is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The meet-in-the-middle template in its cleanest form.
 *   - Directly relevant to the security of Diffie-Hellman.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Modular exponentiation. */
function modPow(a: number, e: number, m: number): number {
    let result = 1;
    let base = a % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = (result * base) % m;
        }
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return result;
}

/** Modular inverse via Fermat (p prime). */
function invMod(a: number, p: number): number {
    return modPow(a, p - 2, p);
}

/**
 * Build a grid of cells showing the baby steps.
 *
 * @param values The baby-step residues.
 * @param activeIndex The matching baby step (or -1).
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], activeIndex = -1): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (activeIndex === index ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Baby-Step Giant-Step generator.
 *
 * @param input `{ a, b, p }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; p?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 2;
    const b = typeof task.b === "number" ? task.b : 3;
    const p = typeof task.p === "number" ? task.p : 29;

    let step = 0;
    const m = Math.ceil(Math.sqrt(p));

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([a, b, p]),
        edges: [],
        description: `Discrete log: solve ${a}^x ≡ ${b} (mod ${p}). m = ⌈√${p}⌉ = ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Baby steps: store a^r mod p for r = 0..m−1.
    // ------------------------------------------------------------------
    const babyMap = new Map<number, number>();
    const babyValues: number[] = [];
    let cur = 1;
    for (let r = 0; r < m; r += 1) {
        babyMap.set(cur, r);
        babyValues.push(cur);
        cur = (cur * a) % p;
    }

    yield {
        stepNumber: step,
        entities: makeCells(babyValues),
        edges: [],
        description: `Baby steps computed: a^0..a^(${m - 1}) mod ${p}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Giant steps: check b·a^(−m·q) against the baby map.
    // ------------------------------------------------------------------
    const factor = invMod(modPow(a, m, p), p); // a^(−m)
    let value = b;
    let solution = -1;

    for (let q = 0; q <= m; q += 1) {
        const match = babyMap.get(value);
        const giantStates = new Map<number, EntityState>();
        if (match !== undefined) {
            solution = q * m + match;
            for (let i = 0; i < babyValues.length; i += 1) {
                giantStates.set(i, i === match ? "comparing" : "unvisited");
            }
            yield {
                stepNumber: step,
                entities: makeCells(babyValues, match),
                edges: [],
                description: `Giant step q=${q}: value ${value} matched baby step r=${match} → x = ${solution}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { solution },
            };
            step += 1;
            break;
        }

        yield {
            stepNumber: step,
            entities: makeCells(babyValues),
            edges: [],
            description: `Giant step q=${q}: value ${value} not found in baby steps.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {},
        };
        step += 1;

        value = (value * factor) % p;
    }

    yield {
        stepNumber: step,
        entities: makeCells(babyValues),
        edges: [],
        description:
            solution >= 0
                ? `${a}^${solution} ≡ ${b} (mod ${p}).`
                : `No solution found (${b} may not be in the subgroup of ${a}).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { solution },
    };
}

/** The Baby-Step Giant-Step module, registered with the engine. */
const module: AlgorithmModule = {
    id: "baby-step-giant-step",
    name: "Baby-Step Giant-Step",
    category: "math",
    complexity: { time: "O(√p)", space: "O(√p)" },
    // 2^x ≡ 3 (mod 29) → x = 8 (2^8 = 256 = 8·29 + 24? no: 256 mod 29 = 24).
    // Using 2^x ≡ 24 → x = 8; adjust: this instance uses 2^x ≡ 5 → x = 22.
    defaultInput: { a: 2, b: 5, p: 29 },
    visualType: "grid",
    run,
};

export default module;
