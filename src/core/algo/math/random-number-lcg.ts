/**
 * random-number-lcg.ts - Linear Congruential Generator
 *
 * Produces a deterministic pseudorandom sequence with the recurrence
 * x(k+1) = (a*x(k) + c) mod m. The visualization shows the generated values and
 * reports the exact period found by cycling, together with the Hull-Dobell
 * conditions that characterize a full-period generator for a power-of-two
 * modulus.
 *
 *   Time:  O(count + period) BigInt steps
 *   Space: O(count) stored values
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LcgInput {
    a?: number;
    c?: number;
    m?: number;
    seed?: number;
    count?: number;
}

function step(state: bigint, a: bigint, c: bigint, m: bigint): bigint {
    return (a * state + c) % m;
}

function gcd(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function hullDobell(a: number, c: number, m: number): boolean {
    if (gcd(BigInt(c), BigInt(m)) !== 1n) return false;
    const am1 = a - 1;
    let remaining = m;
    for (let p = 2; p * p <= remaining; p += 1) {
        if (remaining % p === 0) {
            if (am1 % p !== 0) return false;
            while (remaining % p === 0) remaining /= p;
        }
    }
    if (remaining > 1 && am1 % remaining !== 0) return false;
    if (m % 4 === 0 && am1 % 4 !== 0) return false;
    return true;
}

function findPeriod(a: bigint, c: bigint, m: bigint, seed: bigint): number {
    let current = seed;
    for (let period = 1; period <= Number(m) + 1; period += 1) {
        current = step(current, a, c, m);
        if (current === seed) return period;
    }
    return -1;
}

function makeEntities(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === active ? "active" : index < active ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LcgInput | null) ?? {};
    const m = typeof task.m === "number" && Number.isFinite(task.m) && task.m > 1 ? Math.trunc(task.m) : 16;
    const a = typeof task.a === "number" && Number.isFinite(task.a) ? ((Math.trunc(task.a) % m) + m) % m : 5;
    const c = typeof task.c === "number" && Number.isFinite(task.c) ? ((Math.trunc(task.c) % m) + m) % m : 3;
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed) ? ((Math.trunc(task.seed) % m) + m) % m : 7;
    const count = typeof task.count === "number" && task.count >= 1 && task.count <= 128 ? Math.trunc(task.count) : 16;
    const A = BigInt(a);
    const C = BigInt(c);
    const M = BigInt(m);

    const values: number[] = [];
    let current = BigInt(seed);
    for (let i = 0; i < count; i += 1) {
        current = step(current, A, C, M);
        values.push(Number(current));
    }
    const period = findPeriod(A, C, M, BigInt(seed));
    const fullPeriod = hullDobell(a, c, m);

    let stepNumber = 0;
    yield {
        stepNumber,
        entities: makeEntities(values, -1),
        edges: [],
        description: `LCG x(k+1) = (${a}*x(k) + ${c}) mod ${m} starting from seed ${seed}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: count, a, c, modulus: m, seed, count, period, fullPeriod, sequence: values.slice() },
    };
    stepNumber += 1;

    for (let i = 0; i < values.length; i += 1) {
        yield {
            stepNumber,
            entities: makeEntities(values, i),
            edges: [],
            description: `Draw ${i + 1}: x = (${a} * previous + ${c}) mod ${m} = ${values[i]}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { rows: 1, cols: count, a, c, modulus: m, seed, draw: i + 1, value: values[i], period, fullPeriod },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber,
        entities: makeEntities(values, values.length),
        edges: [],
        description: `Done: period ${period}; Hull-Dobell full-period condition ${fullPeriod ? "holds" : "does not hold"}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { rows: 1, cols: count, a, c, modulus: m, seed, count, period, fullPeriod, sequence: values.slice() },
    };
}

const module: AlgorithmModule = {
    id: "random-number-lcg",
    name: "Linear Congruential Generator",
    category: "math",
    complexity: { time: "O(count + period)", space: "O(count)" },
    defaultInput: { a: 5, c: 3, m: 16, seed: 7, count: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "choose multiplier a, increment c, modulus m, and seed x0",
        "for each draw set x = (a*x + c) mod m",
        "record x as the next pseudorandom value",
        "cycle from the seed to measure the exact period",
        "check the Hull-Dobell conditions for a full period",
        "done: report the sequence and the period",
    ],
    education: {
        intuition:
            "A linear congruential generator keeps one integer state and advances it by multiply, add, and reduce modulo a fixed number. Each state maps deterministically to the next, so the sequence eventually repeats; choosing the constants well makes that cycle as long as the modulus.",
        invariants: [
            "Every generated value lies in the range from zero to m minus one.",
            "The recurrence x(k+1) = (a*x(k) + c) mod m holds for every draw.",
            "Once the state repeats, the entire sequence repeats with that period.",
        ],
        correctness:
            "The recurrence is implemented directly with exact BigInt arithmetic, so every draw matches the mathematical definition without overflow. Cycling from the seed with the same recurrence must eventually return to the seed because there are only m states, and the first return is exactly the period. For a power-of-two modulus, the Hull-Dobell theorem states that the period is m precisely when c is coprime to m, a minus one is divisible by every prime factor of m, and a minus one is divisible by four.",
        complexityRationale:
            "Generating count values takes count constant-time BigInt steps. Finding the period requires at most m such steps, giving O(count + period) time, and storing the displayed values uses O(count) space.",
        uses: [
            "Fast pseudorandom streams in simulations and games",
            "Reproducible test data with an explicit seed",
            "Teaching the structure and limits of pseudorandom generation",
        ],
        references: [
            "Knuth, The Art of Computer Programming Volume 2, Section 3.2.1",
            "Hull and Dobell, Random Number Generators, 1962",
        ],
        workedExample:
            "With a = 5, c = 3, m = 16, and seed 7, the first draws are (5*7+3) mod 16 = 6, then (5*6+3) mod 16 = 1, then 8. Because a minus one is four and c is odd, the Hull-Dobell conditions hold and the generator visits all 16 states before repeating.",
    },
};

export default module;
