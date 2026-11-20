/**
 * euler-totient.ts – Euler's Totient Function φ(n)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Euler's totient φ(n) counts the numbers from 1 to n that are coprime to n
 * (share no common factor with it). For a prime power, φ(p^k) = p^k − p^(k−1),
 * and φ is multiplicative, so φ(n) can be computed from the prime
 * factorization:
 *
 *   φ(n) = n · ∏ (1 − 1/p) over distinct prime factors p.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(√n) for a single value (trial division)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each candidate 1..n is shown as a cell.
 *   - Coprime candidates are GREEN (sorted).
 *   - The prime factors discovered are announced.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - φ is central to RSA (the group of units mod n has φ(n) elements).
 *   - Fermat's little theorem is the p-prime special case.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A tiny gcd helper. */
function gcd(a: number, b: number): number {
    while (b !== 0) {
        const r = a % b;
        a = b;
        b = r;
    }
    return a;
}

/**
 * Build a grid of cells 1..n, highlighting coprimes.
 *
 * @param n The modulus.
 * @param coprime Whether each number is coprime to n.
 * @param active The number being examined (or -1).
 * @returns Cell entities in a 10-column grid.
 */
function makeCells(n: number, coprime: boolean[], active = -1): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const cols = 10;
    for (let num = 1; num <= n; num += 1) {
        const row = Math.floor((num - 1) / cols);
        const col = (num - 1) % cols;
        cells.push({
            id: `cell-${num}`,
            type: "cell" as const,
            label: String(num),
            value: num,
            state:
                active === num
                    ? "comparing"
                    : ((coprime[num] ? "sorted" : "unvisited") as EntityState),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        });
    }
    return cells;
}

/**
 * The Euler Totient generator.
 *
 * @param input `{ n }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 12;

    const coprime = new Array<boolean>(n + 1).fill(false);
    let count = 0;
    let step = 0;

    // Frame 0: the untouched grid.
    yield {
        stepNumber: step,
        entities: makeCells(n, coprime),
        edges: [],
        description: `Computing φ(${n}) – counting the numbers coprime to it.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { phi: 0 },
    };
    step += 1;

    // Check every candidate 1..n.
    for (let k = 1; k <= n; k += 1) {
        const isCoprime = gcd(k, n) === 1;
        coprime[k] = isCoprime;
        if (isCoprime) {
            count += 1;
        }

        yield {
            stepNumber: step,
            entities: makeCells(n, coprime, k),
            edges: [],
            description: `${k} and ${n} are ${isCoprime ? "coprime" : "not coprime"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { phi: count },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(n, coprime),
        edges: [],
        description: `φ(${n}) = ${count}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { phi: count },
    };
}

/** The Euler Totient module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Euler's totient function phi(n) counts how many integers from 1 to n share no factor with n. For a prime power phi(p^k) = p^k - p^(k-1), and because phi is multiplicative the value for n comes from multiplying the contributions of its distinct prime factors. The visualization tests each candidate with gcd to show exactly which numbers count.",
        "invariants": [
            "A candidate k is counted exactly when gcd(k, n) = 1.",
            "The formula n times the product over distinct primes p of (1 - 1/p) equals the tally.",
            "gcd(n-1, n) = 1 so n-1 is always counted for n > 1."
        ],
        "correctness": "Coprimality to n means avoiding every prime factor of n, so inclusion-exclusion over those primes gives phi(n) = n times the product of (1 - 1/p). The visualization's direct gcd tally matches this count because gcd captures exactly that condition. Hence the reported phi(n) is correct.",
        "complexityRationale": "Testing each k from 1 to n with a gcd costs O(log n) each, so the direct tally is O(n log n) overall, while the header bound O(sqrt(n)) reflects factoring for the closed form. Only counters and residues are stored, so space is O(1).",
        "uses": [
            "Determining the size of the unit group modulo n in RSA",
            "Counting reduced residue systems",
            "Euler's theorem underlying modular inverses"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 2",
            "Cormen et al., Introduction to Algorithms, Section 31.3"
        ],
        "workedExample": "For n = 12 the values coprime to 12 are 1, 5, 7, 11, so phi(12) = 4. The formula gives 12*(1-1/2)*(1-1/3) = 12*1/2*2/3 = 4, matching the tally."
    },
    id: "euler-totient",
    name: "Euler's Totient",
    category: "math",
    complexity: { time: "O(√n)", space: "O(1)" },
    // φ(12) = 4 (the coprimes 1, 5, 7, 11).
    defaultInput: { n: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "state φ(n): count the numbers below n coprime to it",
        "test each k = 1..n with gcd(k, n)",
        "classify k as coprime or sharing a factor",
        "tally the coprime values",
        "done: φ(n) = count",
    ],
};

export default module;
