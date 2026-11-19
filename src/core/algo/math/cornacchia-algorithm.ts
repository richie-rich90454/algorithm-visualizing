/**
 * cornacchia-algorithm.ts - Cornacchia's Sum of Two Squares Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cornacchia's algorithm represents a prime p as x^2 + d*y^2 when -d is a
 * quadratic residue modulo p. It first finds a square root t of -d mod p,
 * then runs the Euclidean algorithm on (p, t) until the remainder is smaller
 * than sqrt(p). That remainder is y; (p - d*y^2) is a perfect square x^2.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) Euclidean steps after finding the modular square root
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the current (r0, r1) pair of the Euclidean run.
 *   - The final frame reports x and y in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}

function makeCells(values: number[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; d?: number } | null) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? task.p : 41;
    const d = typeof task.d === "number" && task.d > 0 ? task.d : 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([p, d]),
        edges: [],
        description: `Representing ${p} as x^2 + ${d}*y^2 with Cornacchia's algorithm.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;

    if (!isPrime(p)) {
        yield {
            stepNumber: step,
            entities: makeCells([p], 0),
            edges: [],
            description: `${p} is not prime; Cornacchia's statement needs a prime modulus.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, x: -1, y: -1 },
        };
        return;
    }

    // Need -d to be a quadratic residue modulo p.
    const target = (((-d) % p) + p) % p;
    let t = -1;
    for (let candidate = 1; candidate < p; candidate += 1) {
        if ((candidate * candidate) % p === target) {
            t = candidate;
            break;
        }
    }
    if (t < 0) {
        yield {
            stepNumber: step,
            entities: makeCells([target], 0),
            edges: [],
            description: `-${d} is not a quadratic residue mod ${p}, so no representation x^2 + ${d}*y^2 is guaranteed.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { step, x: -1, y: -1 },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeCells([t, p], 0),
        edges: [],
        description: `Found t = ${t} with t^2 ≡ -${d} (mod ${p}); run Euclid on (${p}, ${t}).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step, t },
    };
    step += 1;

    let r0 = p;
    let r1 = t;
    const limit = Math.floor(Math.sqrt(p));
    while (r1 > limit) {
        const next = r0 % r1;
        yield {
            stepNumber: step,
            entities: makeCells([r0, r1, next], 2),
            edges: [],
            description: `Euclid step: ${r0} mod ${r1} = ${next}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { step, r0, r1 },
        };
        step += 1;
        r0 = r1;
        r1 = next;
        if (r1 === 0) break;
    }

    const y = r1;
    const remainder = p - d * y * y;
    if (y > 0 && remainder >= 0 && remainder % d === 0) {
        const xSquared = remainder / d;
        const x = Math.round(Math.sqrt(xSquared));
        if (x > 0 && x * x === xSquared) {
            yield {
                stepNumber: step,
                entities: makeCells([x, y], 0),
                edges: [],
                description: `${p} = ${x}^2 + ${d}*${y}^2.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: { step, x, y, d, squared: x * x + d * y * y },
            };
            return;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells([y, remainder], 0),
        edges: [],
        description: `No representation found for d = ${d}; the Euclidean remainder did not yield a perfect square.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { step, x: -1, y: -1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If -d is a square modulo the prime p, then p can often be written as x^2 + d*y^2. Cornacchia's algorithm finds this representation by first taking a modular square root t of -d, then running the Euclidean algorithm starting from (p, t). The first remainder below sqrt(p) is the candidate y, and the leftover p - d*y^2 should be d times a perfect square.",
        invariants: [
            "t squared is congruent to -d modulo p.",
            "Each Euclidean step preserves gcd(r0, r1) = 1, so the descent terminates at a small positive remainder.",
            "When a representation exists, d*y^2 never exceeds p.",
        ],
        correctness:
            "The Euclidean algorithm produces the unique smallest positive residue y with y^2 congruent to -d times an inverse relationship modulo p, which is exactly the y for which p - d*y^2 is divisible by p's cofactor. Because y is below sqrt(p), the value (p - d*y^2)/d is small enough to test as a perfect square directly; when it is a square x^2, the identity x^2 + d*y^2 = p holds exactly, proving the representation.",
        complexityRationale:
            "Locating t by scanning residues costs O(p) worst case (a modular exponentiation per trial in a faster variant), while the Euclidean descent runs in O(log p) steps with constant-size integers. Only a handful of residues are stored, so space is O(1).",
        uses: [
            "Writing a prime as a sum of two squares in number theory",
            "Constructing points and curves with prescribed CM discriminant",
            "Primality proofs and quadratic-form reduction",
        ],
        references: [
            "Cornacchia, Sui numeri primi che in sistema di due quadrati sono espressi, 1908",
            "Cohen, A Course in Computational Algebraic Number Theory, Algorithm 1.5.3",
        ],
        workedExample:
            "For p = 41 and d = 1, t = 9 satisfies 9^2 = 81 = -1 mod 41. Euclid on (41, 9) gives 41 mod 9 = 5, and 5 is already below sqrt(41) which is about 6.4. With y = 5, p - y^2 = 16 = 4^2, so the representation is 41 = 4^2 + 5^2.",
    },
    id: "cornacchia-algorithm",
    name: "Cornacchia's Algorithm",
    category: "math",
    complexity: { time: "O(log p) after root finding", space: "O(1)" },
    defaultInput: { p: 41, d: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "state prime p and positive d",
        "find t with t^2 ≡ -d (mod p)",
        "if no such t exists, stop",
        "set r0 = p and r1 = t",
        "while r1 exceeds sqrt(p), replace (r0, r1) with (r1, r0 mod r1)",
        "set y = r1 and test whether (p - d*y^2)/d is a square",
        "done: report x and y with p = x^2 + d*y^2",
    ],
};

export default module;
