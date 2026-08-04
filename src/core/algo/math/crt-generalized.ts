/**
 * crt-generalized.ts – Chinese Remainder Theorem (general / non-coprime moduli)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The generalised CRT handles moduli that are *not* pairwise coprime. It
 * merges the congruences two at a time: given x ≡ a (mod m) and x ≡ b (mod n),
 * a solution exists iff gcd(m, n) divides (a − b), in which case the pair is
 * combined into a single congruence x ≡ x0 (mod lcm(m, n)). Repeating over
 * all pairs yields the final solution or reports inconsistency.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k · log max m)
 *   Space: O(k)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The congruence pair being merged is YELLOW (comparing).
 *   - A successful merge is GREEN (sorted).
 *   - An inconsistent pair is RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The pairwise-coprime CRT is the special case.
 *   - This generalization is what is actually implemented in libraries.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Extended Euclid: returns { x, y, gcd }. */
function extendedGcd(a: number, b: number): { x: number; y: number; gcd: number } {
    if (b === 0) {
        return { x: 1, y: 0, gcd: a };
    }
    const { x, y, gcd } = extendedGcd(b, a % b);
    return { x: y, y: x - Math.floor(a / b) * y, gcd };
}

/** Least common multiple. */
function lcm(a: number, b: number): number {
    return Math.abs(a * b) / extendedGcd(a, b).gcd;
}

/**
 * Build a grid of cells showing the merge progress.
 *
 * @param values The merged congruence counts.
 * @param activeIndex The pair being merged.
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
 * The CRT (generalised) generator.
 *
 * @param input `{ remainders, moduli }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { remainders?: number[]; moduli?: number[] } | null) ?? {};
    const remainders = task.remainders ?? [2, 3, 1];
    const moduli = task.moduli ?? [4, 6, 3];

    let step = 0;
    const progress: number[] = [];

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([1]),
        edges: [],
        description: `Solving x ≡ [${remainders.join(", ")}] (mod [${moduli.join(", ")}]) with possibly non-coprime moduli.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Merge two congruences into one.
    const merge = (
        a: number,
        m: number,
        b: number,
        n: number,
    ): { x: number; mod: number } | null => {
        const { x, gcd } = extendedGcd(m, n);
        const diff = a - b;
        if (diff % gcd !== 0) {
            return null; // inconsistent
        }
        // x ≡ a + m·(x·diff/gcd) (mod lcm(m, n))
        const multiplier = (x * (diff / gcd)) % n;
        const merged = (((a + m * multiplier) % lcm(m, n)) + lcm(m, n)) % lcm(m, n);
        return { x: merged, mod: lcm(m, n) };
    };

    // Start with the first congruence.
    let currentX = remainders[0] ?? 0;
    let currentMod = moduli[0] ?? 1;
    let inconsistent = false;

    for (let i = 1; i < moduli.length; i += 1) {
        const next = merge(currentX, currentMod, remainders[i] ?? 0, moduli[i] ?? 1);
        progress.push(i);

        if (next === null) {
            inconsistent = true;
            yield {
                stepNumber: step,
                entities: makeCells(progress, i),
                edges: [],
                description: `Pair ${i} is inconsistent – no solution exists.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { inconsistent: true },
            };
            step += 1;
            break;
        }

        currentX = next.x;
        currentMod = next.mod;

        yield {
            stepNumber: step,
            entities: makeCells(progress, i),
            edges: [],
            description: `Merged pair ${i}: x ≡ ${currentX} (mod ${currentMod}).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { x: currentX, modulus: currentMod },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(progress),
        edges: [],
        description: inconsistent
            ? "No solution exists (inconsistent congruences)."
            : `Solution: x ≡ ${currentX} (mod ${currentMod}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { solution: currentX, modulus: currentMod, inconsistent },
    };
}

/** The CRT (generalised) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "crt-generalized",
    name: "CRT (Generalized)",
    category: "math",
    complexity: { time: "O(k·log max m)", space: "O(k)" },
    // x ≡ 2 (mod 4), 3 (mod 6), 1 (mod 3) – merges to a solution mod lcm.
    defaultInput: { remainders: [2, 3, 1], moduli: [4, 6, 3] },
    visualType: "grid",
    run,
};

export default module;
