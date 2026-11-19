/**
 * hart-one-line-factorization.ts - Hart's One-Line Factoring Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hart's algorithm scans the integers s = ceil(sqrt(k*n)) for k = 1, 2, 3, ...
 * and tests whether s squared modulo n is itself a perfect square t squared.
 * When it is, n divides s squared minus t squared, so gcd(s minus t, n) is a
 * nontrivial factor. The whole method fits in one line of code, yet for small
 * semiprimes it is competitive with much longer continued-fraction methods.
 * It is distinct from SQUFOF, Fermat, and continued-fraction factorization.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * log n) for the first successful multiplier k
 *   Space: O(k) for the recorded residues in the visualization
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Integer square root corrected for floating-point rounding. */
function isqrt(value: number): number {
    let root = Math.floor(Math.sqrt(value));
    while ((root + 1) * (root + 1) <= value) {
        root += 1;
    }
    while (root * root > value) {
        root -= 1;
    }
    return root;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Build bar entities from the residues s squared mod n examined so far. */
function makeBars(residues: number[], highlight: number): VisualEntity[] {
    return residues.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === highlight ? "active" : index === residues.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/** Search for the first multiplier whose residue is a perfect square. */
function factor(n: number, maxK: number): { factor: number; k: number; s: number; t: number; residues: number[] } | null {
    if (n % 2 === 0) {
        return { factor: 2, k: 0, s: 0, t: 0, residues: [] };
    }
    const root = isqrt(n);
    if (root * root === n) {
        return { factor: root, k: 0, s: 0, t: 0, residues: [] };
    }
    const residues: number[] = [];
    for (let k = 1; k <= maxK; k += 1) {
        const ni = k * n;
        if (!Number.isSafeInteger(ni)) {
            break;
        }
        let s = isqrt(ni);
        if (s * s === ni) {
            // ni cannot be a perfect square unless n is, but guard anyway.
            continue;
        }
        s += 1;
        const m = (s * s) % n;
        residues.push(m);
        const t = isqrt(m);
        if (t * t === m) {
            const d = gcd(s - t, n);
            if (d > 1 && d < n) {
                return { factor: d, k, s, t, residues };
            }
        }
    }
    return null;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; maxK?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 10001;
    const maxK = typeof task.maxK === "number" ? Math.max(1, Math.trunc(task.maxK)) : 5000;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([n], 0),
        edges: [],
        description: `Factoring ${n} with Hart's one-line algorithm (up to ${maxK} multipliers).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, phase: "start" },
    };
    step += 1;

    if (!(n > 0) || !Number.isSafeInteger(n)) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: "Input must be a positive safe integer.",
            codeLineNumber: 0,
            layout: "array",
            meta: { n, error: true },
        };
        return;
    }

    const result = factor(n, maxK);
    if (!result) {
        const partial = factor(n, Math.min(maxK, 20));
        yield {
            stepNumber: step,
            entities: makeBars(partial?.residues ?? [], -1),
            edges: [],
            description: `No nontrivial factor was found for ${n} within ${maxK} multipliers.`,
            codeLineNumber: 7,
            layout: "array",
            meta: { n, factor: 0, complete: true },
        };
        return;
    }

    const visible = result.residues.slice(0, 16);
    yield {
        stepNumber: step,
        entities: makeBars(visible, -1),
        edges: [],
        description: result.k === 0
            ? `${n} has an easy factor.`
            : `After ${result.k} multiplier(s), s = ${result.s} gives residue ${result.t * result.t}, a perfect square.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, k: result.k, s: result.s, t: result.t, residues: result.residues.length },
    };
    step += 1;

    const other = n / result.factor;
    yield {
        stepNumber: step,
        entities: makeBars(visible, visible.length - 1),
        edges: [],
        description: `Since ${result.s} squared is congruent to ${result.t} squared modulo ${n}, gcd gives factor ${result.factor}, so ${n} = ${result.factor} times ${other}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, factor: result.factor, other, product: result.factor * other, k: result.k, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If two different numbers have the same square modulo n, then n divides the difference of their squares, which factors as the product of their sum and difference. A gcd of one of those factors with n then reveals a divisor. Hart scans nearby square roots of multiples of n until the leftover square root is itself a whole number, at which point the congruence and the gcd are immediate.",
        invariants: [
            "For each multiplier k, s is the smallest integer whose square exceeds k*n.",
            "The residue m is s squared reduced modulo n, so s squared is congruent to m.",
            "When m is a perfect square t squared, s squared minus t squared is divisible by n.",
        ],
        correctness:
            "The residue m is by construction congruent to s squared modulo n. If m equals t squared exactly, then n divides (s minus t)(s plus t). Because s is near the square root of k*n, neither factor is a multiple of n in general, so gcd(s minus t, n) is a proper divisor. For odd composite n a suitable k exists before the bound, so the scan terminates with a factor.",
        complexityRationale:
            "Each multiplier requires one integer square root, one multiplication, one remainder, and one gcd, all costing O(log n) bit work. The number of multipliers tried is k, so the time is O(k log n). Storing the residues for the visualization uses O(k) space.",
        uses: [
            "Factoring small integers quickly without a large precomputation",
            "A fallback factor routine inside computer-algebra systems for 32-bit inputs",
            "A compact teaching example of the difference-of-squares factoring idea",
        ],
        references: [
            "Hart, A One Line Factoring Algorithm, Journal of the Australian Mathematical Society, 2012",
            "Lehman, Factoring Large Integers, 1974",
        ],
        workedExample:
            "For n = 10001 the useful multiplier is k = 8: eight times 10001 is 80008, whose square root is just over 282, so s = 283. Now 283 squared is 80089, which leaves residue 81 modulo 10001, and 81 is 9 squared. Because 283 squared minus 9 squared is divisible by 10001, gcd(283 minus 9, 10001) = 137, giving 10001 = 73 times 137.",
    },
    id: "hart-one-line-factorization",
    name: "Hart One-Line Factorization",
    category: "math",
    complexity: { time: "O(k log n)", space: "O(k)" },
    defaultInput: { n: 10001 },
    visualType: "array",
    run,
    pseudocode: [
        "if n is even or a perfect square, return that easy factor",
        "for k from one up to a chosen bound",
        "set s to the ceiling of the square root of k times n",
        "set m to s squared modulo n",
        "set t to the integer square root of m",
        "if t squared equals m, form gcd of s minus t with n",
        "if that gcd is a proper divisor, report it",
        "otherwise continue with the next multiplier",
    ],
};

export default module;
