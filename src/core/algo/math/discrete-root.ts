/**
 * discrete-root.ts – Discrete k-th Root modulo a prime
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The discrete k-th root problem is: given a, k, and prime p, find x with
 * x^k ≡ a (mod p). It can be solved in closed form when gcd(k, p−1) = 1:
 * the answer is x = a^(k⁻¹ mod (p−1)) (mod p), using the fact that the map
 * x ↦ x^k is a bijection on the multiplicative group in that case.
 *
 * For the general case it reduces to a discrete-log style search; this
 * educational version handles the coprime case directly and falls back to a
 * brute-force search otherwise.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) for the coprime case; O(p) for brute force
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The candidate roots are shown as cells.
 *   - The verified root is GREEN (sorted).
 *   - No-solution cases are reported in RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The exponent-inverse trick is the heart to teach.
 *   - Generalizes Tonelli-Shanks (the k = 2 case).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Extended Euclid for modular inverse of an exponent mod p−1. */
function extendedGcd(a: number, b: number): { x: number; y: number; gcd: number } {
    if (b === 0) {
        return { x: 1, y: 0, gcd: a };
    }
    const { x, y, gcd } = extendedGcd(b, a % b);
    return { x: y, y: x - Math.trunc(a / b) * y, gcd };
}

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

/**
 * Build a grid of cells showing the candidate search.
 *
 * @param candidates The candidate roots tested.
 * @param winner The winning index (or -1).
 * @returns Cell entities in a single row.
 */
function makeCells(candidates: number[], winner = -1): VisualEntity[] {
    return candidates.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: (index === winner ? "sorted" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Discrete Root generator.
 *
 * @param input `{ a, k, p }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; k?: number; p?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 3;
    const k = typeof task.k === "number" ? task.k : 5;
    const p = typeof task.p === "number" ? task.p : 31;

    let step = 0;

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([a]),
        edges: [],
        description: `Finding x with x^${k} ≡ ${a} (mod ${p}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Degenerate inputs: need a prime p >= 3 and a positive exponent.
    if (p < 3 || k < 1) {
        yield {
            stepNumber: step,
            entities: makeCells([a]),
            edges: [],
            description: `Degenerate input (k = ${k}, p = ${p}) – need k ≥ 1 and prime p ≥ 3.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        return;
    }

    // Case 1: gcd(k, p−1) = 1 → closed form.
    const { x: ex, gcd } = extendedGcd(k, p - 1);
    let root = -1;

    if (gcd === 1) {
        const kInv = ((ex % (p - 1)) + (p - 1)) % (p - 1);

        yield {
            stepNumber: step,
            entities: makeCells([k, p - 1, gcd]),
            edges: [],
            description: `gcd(${k}, ${p - 1}) = ${gcd} – the map x ↦ x^${k} is a bijection mod ${p}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;

        yield {
            stepNumber: step,
            entities: makeCells([kInv]),
            edges: [],
            description: `Exponent inverse: ${k}⁻¹ mod ${p - 1} = ${kInv}. Computing ${a}^${kInv} mod ${p}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;

        let result = 1;
        let base = ((a % p) + p) % p;
        let exp = kInv;
        while (exp > 0) {
            if (exp % 2 === 1) {
                const next = (result * base) % p;
                yield {
                    stepNumber: step,
                    entities: makeCells([result, base, next]),
                    edges: [],
                    description: `exp ${exp} is odd: result = ${result}·${base} mod ${p} = ${next}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: {},
                };
                result = next;
            } else {
                yield {
                    stepNumber: step,
                    entities: makeCells([result, base, exp]),
                    edges: [],
                    description: `exp ${exp} is even: square base ${base} → ${(base * base) % p} mod ${p}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: {},
                };
            }
            base = (base * base) % p;
            exp = Math.floor(exp / 2);
            step += 1;
        }
        root = result;

        yield {
            stepNumber: step,
            entities: makeCells([a, kInv, root], 2),
            edges: [],
            description: `gcd(${k}, ${p - 1}) = 1 → x = ${a}^(${k}⁻¹) = ${a}^${kInv} mod ${p} = ${root}. Verified ${root}^${k} mod ${p} = ${modPow(root, k, p)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { root },
        };
        return;
    }

    // Case 2: brute force over candidates.
    const candidates: number[] = [];
    for (let x = 0; x < p; x += 1) {
        candidates.push(x);
        if (modPow(x, k, p) === a % p) {
            root = x;
            yield {
                stepNumber: step,
                entities: makeCells(candidates, candidates.length - 1),
                edges: [],
                description: `Found root x = ${x} (x^${k} ≡ ${a}).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { root },
            };
            return;
        }
        yield {
            stepNumber: step,
            entities: makeCells(candidates),
            edges: [],
            description: `Tried x = ${x} – no match yet.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(candidates),
        edges: [],
        description: `No k-th root of ${a} exists modulo ${p}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { root },
    };
}

/** The Discrete Root module, registered with the engine. */
const module: AlgorithmModule = {
    id: "discrete-root",
    name: "Discrete Root",
    category: "math",
    complexity: { time: "O(log p) / O(p)", space: "O(1)" },
    // x^5 ≡ 3 (mod 31): gcd(5, 30) = 5 ≠ 1 → brute force. Use coprime instead:
    // x^3 ≡ 2 (mod 31) with gcd(3, 30) = 3 ≠ 1... pick k=7: gcd(7,30)=1.
    defaultInput: { a: 3, k: 7, p: 31 },
    visualType: "grid",
    run,
};

export default module;
