/**
 * crt-coprime.ts – Chinese Remainder Theorem (pairwise-coprime moduli)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Chinese Remainder Theorem reconstructs a number x from its remainders
 * modulo several pairwise-coprime moduli. Given x ≡ r_i (mod m_i) for
 * i = 1..k with gcd(m_i, m_j) = 1, the solution modulo M = ∏ m_i is
 *
 *   x = Σ r_i · M_i · inv(M_i, m_i)   (mod M)
 *
 * where M_i = M / m_i and inv() is the modular inverse.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k · log m) with extended Euclid per term
 *   Space: O(k)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each congruence is shown as a cell row.
 *   - The term currently being added is YELLOW (comparing).
 *   - The final solution is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The pairwise-coprime assumption is essential.
 *   - CRT is the backbone of fast modular arithmetic and secret sharing.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Extended Euclid: returns { x, y, gcd } with a·x + b·y = gcd. */
function extendedGcd(a: number, b: number): { x: number; y: number; gcd: number } {
    if (b === 0) {
        return { x: 1, y: 0, gcd: a };
    }
    const { x, y, gcd } = extendedGcd(b, a % b);
    return { x: y, y: x - Math.trunc(a / b) * y, gcd };
}

/** Modular inverse of a mod m (assumes gcd = 1). */
function invMod(a: number, m: number): number {
    const { x } = extendedGcd(a, m);
    return ((x % m) + m) % m;
}

/**
 * Build a grid of cells showing the current CRT accumulation.
 *
 * @param values The term values accumulated so far.
 * @param activeIndex The term being added.
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
 * The CRT (coprime) generator.
 *
 * @param input `{ remainders, moduli }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { remainders?: number[]; moduli?: number[] } | null) ?? {};
    const remainders = task.remainders ?? [2, 3, 2];
    const moduli = task.moduli ?? [3, 5, 7];

    let step = 0;
    const terms: number[] = [];

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([1]),
        edges: [],
        description: `Solving x ≡ [${remainders.join(", ")}] (mod [${moduli.join(", ")}]).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // The total modulus M.
    const M = moduli.reduce((acc, m) => acc * m, 1);

    let x = 0;

    // Accumulate each CRT term.
    for (let i = 0; i < moduli.length; i += 1) {
        const mi = moduli[i] ?? 1;
        const ri = remainders[i] ?? 0;
        const Mi = M / mi;
        const inv = invMod(Mi, mi);
        const term = ri * Mi * inv;

        terms.push(term);
        x += term;

        yield {
            stepNumber: step,
            entities: makeCells(terms, i),
            edges: [],
            description: `Term ${i}: ${ri}·${Mi}·${inv} = ${term}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { x: x % M },
        };
        step += 1;
    }

    // The solution modulo M.
    const solution = ((x % M) + M) % M;

    // Verify against every congruence.
    const verified = moduli.every((mi, i) => solution % mi === (remainders[i] ?? 0));

    yield {
        stepNumber: step,
        entities: makeCells(terms),
        edges: [],
        description: verified
            ? `Solution: x ≡ ${solution} (mod ${M}).`
            : `Solution mismatch – moduli may not be pairwise coprime.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { solution, modulus: M },
    };
}

/** The CRT (coprime) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "crt-coprime",
    name: "CRT (Coprime)",
    category: "math",
    complexity: { time: "O(k·log m)", space: "O(k)" },
    // x ≡ 2 (mod 3), 3 (mod 5), 2 (mod 7) → x = 23.
    defaultInput: { remainders: [2, 3, 2], moduli: [3, 5, 7] },
    visualType: "grid",
    run,
};

export default module;
