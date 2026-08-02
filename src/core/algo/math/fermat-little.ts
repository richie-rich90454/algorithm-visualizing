/**
 * fermat-little.ts – Fermat's Little Theorem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fermat's little theorem states that if p is prime and gcd(a, p) = 1, then
 * a^(p−1) ≡ 1 (mod p). This is the theoretical foundation of modular
 * exponentiation, the probabilistic primality tests, and the classic way to
 * compute modular inverses: a^(p−2) mod p is the inverse of a mod p.
 *
 * This visualisation verifies the theorem for a chosen (a, p) by computing
 * the modular powers a^1, a^2, …, a^(p−1) mod p and watching them land on 1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p) to walk the powers; O(log p) for a single exponentiation
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The exponent being evaluated is YELLOW (comparing).
 *   - The running residue is PINK (highlight).
 *   - Reaching 1 at exponent p−1 confirms the theorem (GREEN / sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A single line: a^(p−1) ≡ 1 (mod p).
 *   - Backs Fermat primality testing and RSA.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a grid of cells showing the residues a^k mod p for k = 1..p−1.
 *
 * @param residues The residues per exponent.
 * @param activeIndex The exponent being highlighted.
 * @returns Cell entities in a single-row grid.
 */
function makeCells(residues: number[], activeIndex = -1): VisualEntity[] {
    return residues.map((value, index) => ({
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
 * The Fermat Little Theorem generator.
 *
 * @param input `{ a, p }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; p?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 3;
    const p = typeof task.p === "number" ? task.p : 7;

    const residues: number[] = [];
    let step = 0;

    // Frame 0: the setup.
    yield {
        stepNumber: step,
        entities: makeCells([1]),
        edges: [],
        description: `Verifying Fermat: ${a}^(${p}−1) ≡ 1 (mod ${p}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Walk the powers a^1 .. a^(p−1) mod p.
    let residue = 1;
    for (let k = 1; k <= p - 1; k += 1) {
        residue = (residue * a) % p;
        residues.push(residue);

        yield {
            stepNumber: step,
            entities: makeCells(residues, k - 1),
            edges: [],
            description: `${a}^${k} mod ${p} = ${residue}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }

    // The theorem holds if the last residue is 1.
    const verified = residue === 1;
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < residues.length; i += 1) {
        finalStates.set(i, verified && i === residues.length - 1 ? "sorted" : "unvisited");
    }

    yield {
        stepNumber: step,
        entities: makeCells(residues).map((cell) => ({
            ...cell,
            state: finalStates.get(Number(cell.metadata["col"])) ?? cell.state,
        })),
        edges: [],
        description: verified
            ? `${a}^(${p}−1) mod ${p} = 1 – Fermat's little theorem holds.`
            : `${a}^(${p}−1) mod ${p} = ${residue} ≠ 1 – the theorem does not apply (${p} may not be prime, or gcd≠1).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { verified },
    };
}

/** The Fermat Little Theorem module, registered with the engine. */
const module: AlgorithmModule = {
    id: "fermat-little",
    name: "Fermat's Little Theorem",
    category: "math",
    complexity: { time: "O(p)", space: "O(1)" },
    // 3^6 mod 7 = 1 – a clean verification.
    defaultInput: { a: 3, p: 7 },
    visualType: "grid",
    run,
};

export default module;
