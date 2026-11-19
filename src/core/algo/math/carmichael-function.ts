/**
 * carmichael-function.ts - Carmichael Function lambda(n).
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Carmichael function lambda(n) is the exponent of the multiplicative
 * group modulo n: the smallest positive m with a^m congruent to 1 modulo n
 * for every a coprime to n. It is computed by factoring n, evaluating lambda
 * on each prime power, and taking the least common multiple of those values.
 * It is always at most Euler's totient and is often strictly smaller.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sqrt(n)) for trial-division factoring
 *   Space: O(number of distinct prime factors)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row shows a prime power factor and its individual lambda.
 *   - The active row is highlighted while the lcm is updated.
 *   - The final frame reports lambda(n) and, for comparison, phi(n).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CarmichaelInput {
    n?: number;
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

function lcm(a: number, b: number): number {
    return (a / gcd(a, b)) * b;
}

function factor(n: number): Array<[number, number]> {
    const factors: Array<[number, number]> = [];
    let remaining = n;
    for (let p = 2; p * p <= remaining; p += 1) {
        if (remaining % p === 0) {
            let exponent = 0;
            while (remaining % p === 0) {
                remaining /= p;
                exponent += 1;
            }
            factors.push([p, exponent]);
        }
    }
    if (remaining > 1) {
        factors.push([remaining, 1]);
    }
    return factors;
}

function primePowerLambda(p: number, exponent: number): number {
    if (p === 2) {
        if (exponent === 1) {
            return 1;
        }
        if (exponent === 2) {
            return 2;
        }
        return 2 ** (exponent - 2);
    }
    return p ** (exponent - 1) * (p - 1);
}

function totient(n: number, factors: Array<[number, number]>): number {
    let result = n;
    for (const [p] of factors) {
        result -= result / p;
    }
    return Math.trunc(result);
}

function table(
    n: number,
    factors: Array<[number, number]>,
    upto: number,
    running: number,
    active: boolean,
    done: boolean,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number | string }> = [
        { field: "n", value: n },
        { field: "factors seen", value: upto },
        { field: "running lcm", value: running },
    ];
    factors.forEach(([p, exponent], index) => {
        rows.push({
            field: `prime power ${index + 1}`,
            value: `${p}^${exponent} -> lambda ${primePowerLambda(p, exponent)}`,
        });
    });
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : active && i === 2 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CarmichaelInput | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 1 ? Math.trunc(task.n) : 561;
    const factors = factor(n);
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(n, factors, 0, 1, false, false),
        edges: [],
        description: `Compute lambda(${n}) from the prime-power factorization of ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3 + factors.length, cols: 1, n, factorCount: factors.length },
    };
    step += 1;

    let value = 1;
    for (let index = 0; index < factors.length; index += 1) {
        const [p, exponent] = factors[index] ?? [2, 1];
        const component = primePowerLambda(p, exponent);
        value = lcm(value, component);
        yield {
            stepNumber: step,
            entities: table(n, factors, index + 1, value, true, false),
            edges: [],
            description: `Factor ${p}^${exponent} contributes lambda ${component}; running lcm is now ${value}.`,
            codeLineNumber: p === 2 ? 3 : 4,
            layout: "grid",
            meta: { rows: 3 + factors.length, cols: 1, n, prime: p, exponent, component, lcm: value },
        };
        step += 1;
    }

    const phi = totient(n, factors);
    yield {
        stepNumber: step,
        entities: table(n, factors, factors.length, value, false, true),
        edges: [],
        description: `Done: lambda(${n}) = ${value}, while phi(${n}) = ${phi}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 3 + factors.length, cols: 1, n, result: value, phi, dividesTotient: phi % value === 0 },
    };
}

const module: AlgorithmModule = {
    id: "carmichael-function",
    name: "Carmichael Function",
    category: "math",
    complexity: { time: "O(sqrt(n))", space: "O(k)" },
    defaultInput: { n: 561 },
    visualType: "grid",
    run,
    pseudocode: [
        "factor n into prime powers p^e",
        "set the result to one",
        "for each odd prime power use phi(p^e) = p^(e-1)(p-1)",
        "for powers of two use 1, 2, or 2^(e-2) as e grows",
        "replace the result by its least common multiple with each value",
        "return the result as lambda(n)",
    ],
    education: {
        intuition:
            "Euler's totient counts how many residues are coprime to n, but the Carmichael function asks a sharper question: how long until every one of them returns to one under repeated multiplication. The answer is assembled locally from each prime power and combined with least common multiples because the group modulo n splits into a product of prime-power groups.",
        invariants: [
            "lambda(n) divides phi(n) for every positive n.",
            "For an odd prime power p^e, lambda equals phi(p^e).",
            "The running lcm is the exponent of the product of the prime-power groups processed so far.",
        ],
        correctness:
            "By the Chinese remainder theorem the group modulo n is the direct product of the groups modulo its prime-power factors, and the exponent of a direct product is the lcm of the component exponents. The exponent of an odd prime-power group is its totient, and the unit group modulo a power of two has exponent 1, 2, or 2^(e-2) according to the exponent, so combining these values gives exactly lambda(n).",
        complexityRationale:
            "Trial division scans divisors up to the square root of n, costing O(sqrt(n)) time, and the number of prime-power components is small, so storage is O(k) for k distinct primes.",
        uses: [
            "Characterizing Carmichael numbers in primality testing",
            "Choosing safe exponents in RSA and other cryptosystems",
            "Analyzing the order of elements in finite groups",
        ],
        references: [
            "Carmichael, On Composite Numbers n Which Satisfy the Fermat Congruence, 1910",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective",
        ],
        workedExample:
            "For n = 561 = 3 x 11 x 17 the prime powers are odd, so their lambdas are 2, 10, and 16. Their least common multiple is 80, hence lambda(561) = 80, which is smaller than phi(561) = 320.",
    },
};

export default module;
