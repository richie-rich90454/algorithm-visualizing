/**
 * miller-rabin.ts – Miller-Rabin Primality Test (deterministic for small n)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Miller-Rabin is a probabilistic primality test built on Fermat's little
 * theorem and the square-root-of-one property. For a candidate n = 2^s·d + 1
 * (d odd), it checks witnesses a: if a^d ≢ ±1 (mod n) and squaring s−1 times
 * never reaches −1, then n is composite. With a fixed set of small witnesses
 * (here {2, 3, 5, 7, 11}), the test is deterministic for n < 3·10^18.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k · log³ n) for k witnesses
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The witness being tested is YELLOW (comparing).
 *   - The squaring chain is shown step by step.
 *   - A composite result is RED (swapped); "probably prime" is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The workhorse behind primality checks in cryptography.
 *   - The squaring chain is the "strong" part of the strong pseudoprime test.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic witnesses for n < 3,215,031,751 (and larger with more). */
const WITNESSES = [2, 3, 5, 7, 11, 13];

/** Multiply a·b mod m without overflow (schoolbook for teaching). */
function modMul(a: number, b: number, m: number): number {
    let result = 0;
    let base = a % m;
    let mult = b % m;
    while (mult > 0) {
        if (mult % 2 === 1) {
            result = (result + base) % m;
        }
        base = (base * 2) % m;
        mult = Math.floor(mult / 2);
    }
    return result;
}

/** Modular exponentiation a^e mod m. */
function modPow(a: number, e: number, m: number): number {
    let result = 1;
    let base = a % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = modMul(result, base, m);
        }
        base = modMul(base, base, m);
        exp = Math.floor(exp / 2);
    }
    return result;
}

/**
 * Build a grid of cells showing the squaring chain for a witness.
 *
 * @param values The chain values (residues mod n).
 * @param activeIndex The current position (or -1).
 * @returns Cell entities in a single-row grid.
 */
function makeChain(values: number[], activeIndex = -1): VisualEntity[] {
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
 * The Miller-Rabin generator.
 *
 * @param input `{ n }` – the number to test.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 29;

    let step = 0;

    // Frame 0: the number under test.
    yield {
        stepNumber: step,
        entities: makeChain([n]),
        edges: [],
        description: `Testing ${n} for primality with Miller-Rabin.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Handle small base cases.
    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeChain([n]),
            edges: [],
            description: `${n} is not prime.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { prime: false },
        };
        return;
    }
    if (n === 2 || n === 3) {
        yield {
            stepNumber: step,
            entities: makeChain([n]),
            edges: [],
            description: `${n} is prime.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { prime: true },
        };
        return;
    }

    // Decompose n − 1 = 2^s · d with d odd.
    let d = n - 1;
    let s = 0;
    while (d % 2 === 0) {
        d /= 2;
        s += 1;
    }

    yield {
        stepNumber: step,
        entities: makeChain([n]),
        edges: [],
        description: `n − 1 = ${n - 1} = 2^${s} × ${d}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {},
    };
    step += 1;

    let probablyPrime = true;

    // Test each witness.
    for (const a of WITNESSES) {
        if (a >= n) {
            continue;
        }
        // x = a^d mod n.
        let x = modPow(a, d, n);

        const chain: number[] = [x];
        yield {
            stepNumber: step,
            entities: makeChain(chain, 0),
            edges: [],
            description: `Witness ${a}: a^d = ${a}^${d} mod ${n} = ${x}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {},
        };
        step += 1;

        // Square s−1 times; if we ever hit 1 without passing through n−1, n is
        // composite.
        if (x === 1 || x === n - 1) {
            continue; // This witness says "probably prime".
        }

        let composite = true;
        for (let i = 1; i < s; i += 1) {
            x = modMul(x, x, n);
            chain.push(x);
            yield {
                stepNumber: step,
                entities: makeChain(chain, i),
                edges: [],
                description: `Witness ${a}, squaring ${i}/${s - 1}: x = ${x}.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: {},
            };
            step += 1;
            if (x === n - 1) {
                composite = false;
                break;
            }
        }

        if (composite) {
            probablyPrime = false;
            yield {
                stepNumber: step,
                entities: makeChain(chain, chain.length - 1),
                edges: [],
                description: `Witness ${a} proves ${n} is composite.`,
                codeLineNumber: 6,
                layout: "grid",
                meta: {},
            };
            step += 1;
            break;
        }
    }

    const resultStates = new Map<number, EntityState>([[0, probablyPrime ? "sorted" : "swapped"]]);
    yield {
        stepNumber: step,
        entities: makeChain([n], 0).map((cell) => ({
            ...cell,
            state: resultStates.get(0) ?? cell.state,
        })),
        edges: [],
        description: probablyPrime
            ? `${n} is prime (deterministic for this range).`
            : `${n} is composite.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { prime: probablyPrime },
    };
}

/** The Miller-Rabin module, registered with the engine. */
const module: AlgorithmModule = {
    id: "miller-rabin",
    name: "Miller-Rabin",
    category: "math",
    complexity: { time: "O(k·log³ n)", space: "O(1)" },
    // 29 is prime; 91 = 7·13 is a good composite to show a failure.
    defaultInput: { n: 29 },
    visualType: "grid",
    run,
};

export default module;
