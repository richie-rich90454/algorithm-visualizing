/**
 * prime-counting-legendre.ts - Legendre's Prime Counting Formula
 *
 * Computes pi(x), the number of primes at most x, with Legendre's combinatorial
 * identity pi(x) = phi(x, a) + a - 1, where a = pi(floor(sqrt(x))) and
 * phi(x, a) counts integers up to x not divisible by the first a primes. The
 * recurrence phi(x, a) = phi(x, a-1) - phi(x/p_a, a-1) is evaluated with
 * memoization.
 *
 *   Time:  O(x log log x) for the small sieve plus recursion
 *   Space: O(x + number of memoized states)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PrimeCountInput {
    x?: number;
}

function sievePrimes(limit: number): number[] {
    if (limit < 2) return [];
    const composite = new Array<boolean>(limit + 1).fill(false);
    const primes: number[] = [];
    for (let i = 2; i <= limit; i += 1) {
        if (!composite[i]) {
            primes.push(i);
            if (i * i <= limit) {
                for (let j = i * i; j <= limit; j += i) composite[j] = true;
            }
        }
    }
    return primes;
}

function makeEntities(limit: number, primes: Set<number>, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 2; i <= limit; i += 1) {
        const isPrime = primes.has(i);
        const state: EntityState = i > revealed ? "idle" : isPrime ? "sorted" : "comparing";
        entities.push({
            id: `bar-${i}`,
            type: "bar" as const,
            label: String(i),
            value: isPrime ? 1 : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { value: i, prime: isPrime },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PrimeCountInput | null) ?? {};
    const x = typeof task.x === "number" && Number.isFinite(task.x) && task.x >= 2 ? Math.floor(task.x) : 100;
    const root = Math.floor(Math.sqrt(x));
    const smallPrimes = sievePrimes(root);
    const a = smallPrimes.length;
    const memo = new Map<string, number>();

    const phi = (value: number, count: number): number => {
        if (count === 0) return value;
        const key = `${value},${count}`;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;
        const prime = smallPrimes[count - 1] ?? 2;
        const result = phi(value, count - 1) - phi(Math.floor(value / prime), count - 1);
        memo.set(key, result);
        return result;
    };

    const phiValue = phi(x, a);
    const count = phiValue + a - 1;
    const allPrimes = new Set(sievePrimes(x));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(x, allPrimes, 1),
        edges: [],
        description: `Count primes up to ${x}: first find a = pi(sqrt(${x})) = ${a}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: x - 1, x, a, root, count: 0, memoStates: 0 },
    };
    step += 1;

    const marks = [root, Math.floor(x / 2), Math.floor((3 * x) / 4), x];
    for (let i = 0; i < marks.length; i += 1) {
        const revealed = Math.min(x, marks[i] ?? x);
        yield {
            stepNumber: step,
            entities: makeEntities(x, allPrimes, revealed),
            edges: [],
            description: `Evaluating phi up to ${revealed} removes multiples of the first ${a} primes.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { rows: 1, cols: x - 1, x, a, revealed, memoStates: memo.size, phiValue },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(x, allPrimes, x),
        edges: [],
        description: `Done: pi(${x}) = phi(${x}, ${a}) + ${a} - 1 = ${count}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { rows: 1, cols: x - 1, x, a, root, phiValue, count, memoStates: memo.size },
    };
}

const module: AlgorithmModule = {
    id: "prime-counting-legendre",
    name: "Legendre Prime Counting",
    category: "math",
    complexity: { time: "O(x log log x + states)", space: "O(x + states)" },
    defaultInput: { x: 100 },
    visualType: "array",
    run,
    pseudocode: [
        "let a be the number of primes up to sqrt(x)",
        "define phi(v, 0) = floor(v)",
        "define phi(v, k) = phi(v, k-1) - phi(floor(v / p_k), k-1)",
        "evaluate phi(x, a) with memoization on (v, k)",
        "return phi(x, a) + a - 1 as pi(x)",
    ],
    education: {
        intuition:
            "Counting primes directly is slow for large limits. Legendre observed that after sieving out multiples of the first few small primes, what remains is counted by a recursive function phi. Because only primes up to the square root of the limit are needed, the recursion is small and each state can be reused.",
        invariants: [
            "phi(v, k) counts integers from 1 to v with no factor among the first k primes.",
            "Every prime factor of a composite number at most x is at most sqrt(x).",
            "phi(v, k) equals phi(v, k-1) minus the integers divisible by the k-th prime.",
        ],
        correctness:
            "The base case phi(v, 0) = floor(v) counts all integers up to v. Passing from k minus one to k removes exactly those survivors divisible by the k-th prime, which are in one-to-one correspondence with survivors up to floor(v / p_k), giving the recurrence. After removing all primes up to sqrt(x), the survivors are one plus the primes greater than sqrt(x), so adding a minus one yields pi(x).",
        complexityRationale:
            "The initial sieve costs O(x log log x). The memoized recurrence visits each distinct (v, k) state once; for modest x the number of states is small, and each does constant work.",
        uses: [
            "Estimating prime density in analytic number theory",
            "Sizing prime tables in computational libraries",
            "A stepping stone to the Meissel-Lehmer algorithm",
        ],
        references: [
            "Crandall and Pomerance, Prime Numbers, Chapter 3",
            "Wikipedia, Prime counting function, Legendre's formula",
        ],
        workedExample:
            "For x = 30, sqrt(x) is about 5 and the primes up to 5 are 2, 3, 5, so a = 3. phi(30, 3) counts numbers up to 30 not divisible by 2, 3, or 5, which is 10. Legendre's formula gives pi(30) = 10 + 3 - 1 = 12, matching the primes 2 through 29.",
    },
};

export default module;
