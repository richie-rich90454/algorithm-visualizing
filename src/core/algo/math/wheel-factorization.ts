/**
 * wheel-factorization.ts - Wheel Factorization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Wheel factorization speeds up trial division by skipping every candidate
 * that is divisible by a small set of base primes. The base primes multiply
 * to a circumference M; only the residues coprime to M are "spokes" of the
 * wheel, and candidates advance by the gaps between consecutive spokes.
 * Testing only those residues skips a large constant fraction of integers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sqrt(n) * phi(M) / M) trial divisions for a pure wheel
 *   Space: O(M) for the wheel residues and gaps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The wheel residues 0..M-1 are shown as bars over one revolution.
 *   - Spokes (coprime residues) are GREEN; skipped residues are idle.
 *   - Each trial candidate lights up as ACTIVE, then SORTED if it divides.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** gcd, used to find the wheel spokes. */
function gcd(a: number, b: number): number {
    while (b !== 0) {
        const r = a % b;
        a = b;
        b = r;
    }
    return a;
}

/** Build one bar entity. */
function bar(index: number, value: number, state: EntityState, tag: string): VisualEntity {
    return {
        id: `${tag}-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    };
}

/** The wheel-factorization generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; basePrimes?: number[] } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 943;
    const basePrimes: number[] =
        Array.isArray(task.basePrimes) && task.basePrimes.length > 0
            ? task.basePrimes.filter((p) => p >= 2)
            : [2, 3, 5];

    let step = 0;

    // Degenerate inputs.
    if (!Number.isFinite(n) || n < 2) {
        yield {
            stepNumber: step,
            entities: [bar(0, Math.max(0, n), "highlight", "wheel")],
            edges: [],
            description: "Wheel factorization needs n >= 2.",
            codeLineNumber: 0,
            layout: "array",
            meta: { factor: 0, n },
        };
        return;
    }

    // Build the wheel: circumference M and residues coprime to M.
    const circumference = basePrimes.reduce((product, p) => product * p, 1);
    const isSpoke = new Array<boolean>(circumference).fill(false);
    const spokes: number[] = [];
    for (let r = 1; r < circumference; r += 1) {
        if (basePrimes.every((p) => gcd(r, p) === 1)) {
            isSpoke[r] = true;
            spokes.push(r);
        }
    }

    const wheelBars = (active = -1): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let r = 0; r < circumference; r += 1) {
            entities.push(bar(r, r, isSpoke[r] ? "sorted" : "idle", "wheel"));
        }
        if (active >= 0) {
            const target = entities.find((entity) => entity.metadata["value"] === active);
            if (target) {
                target.state = "comparing";
            }
        }
        return entities;
    };

    yield {
        stepNumber: step,
        entities: wheelBars(),
        edges: [],
        description:
            `Base primes [${basePrimes.join(", ")}] give circumference ${circumference} ` +
            `with ${spokes.length} coprime spokes; candidates skip the other residues.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { circumference, spokes: spokes.length, n },
    };
    step += 1;

    // Trial-divide by the base primes themselves.
    for (const p of basePrimes) {
        const divides = n % p === 0;
        yield {
            stepNumber: step,
            entities: [...wheelBars(), bar(0, p, divides ? "sorted" : "comparing", "candidate")],
            edges: [],
            description: divides
                ? `Base prime ${p} divides ${n}, so ${p} is the smallest factor.`
                : `Base prime ${p} does not divide ${n}; continue along the wheel.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { candidate: p, divides, n },
        };
        step += 1;
        if (divides) {
            yield {
                stepNumber: step,
                entities: wheelBars(p),
                edges: [],
                description: `Smallest factor of ${n} is ${p} (other factor ${n / p}).`,
                codeLineNumber: 5,
                layout: "array",
                meta: { factor: p, n, circumference },
            };
            return;
        }
    }

    // Walk candidates in increasing order using the wheel spokes.
    const largestBase = Math.max(...basePrimes);
    let revolution = 0;
    let found = 0;
    outer: while (true) {
        for (let k = 0; k < spokes.length; k += 1) {
            const candidate = revolution * circumference + (spokes[k] ?? 1);
            if (candidate <= largestBase) {
                continue;
            }
            if (candidate * candidate > n) {
                break outer;
            }
            const divides = n % candidate === 0;
            yield {
                stepNumber: step,
                entities: [...wheelBars(candidate % circumference), bar(0, candidate, divides ? "sorted" : "comparing", "candidate")],
                edges: [],
                description: divides
                    ? `Candidate ${candidate} lies on a spoke and divides ${n}.`
                    : `Candidate ${candidate} is on a spoke but does not divide ${n}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { candidate, divides, n, revolution },
            };
            step += 1;
            if (divides) {
                found = candidate;
                break outer;
            }
        }
        revolution += 1;
        if (revolution * circumference > Math.sqrt(n) + circumference) {
            break;
        }
    }

    const answer = found > 0 ? found : n;
    yield {
        stepNumber: step,
        entities: wheelBars(found > 0 ? found % circumference : -1),
        edges: [],
        description:
            found > 0
                ? `Smallest factor of ${n} is ${found} (other factor ${n / found}).`
                : `${n} has no factor on the wheel up to sqrt(n), so it is prime and its least factor is ${n}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { factor: answer, n, circumference },
    };
}

/** The Wheel Factorization module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Wheel factorization is trial division that refuses to test numbers it already knows cannot divide the target. If we fix a few small base primes and multiply them into a circumference M, every integer is either divisible by one of those primes or falls on one of the residues coprime to M. Testing only those residues skips a predictable fraction of candidates for free.",
        invariants: [
            "Every integer not divisible by a base prime is congruent modulo M to exactly one wheel spoke.",
            "Candidate values increase strictly, so the first divisor found is the smallest factor.",
            "Once a candidate exceeds sqrt(n) with no divisor found, n is prime.",
        ],
        correctness:
            "Any composite n has a prime factor at most sqrt(n). If that factor is a base prime it is found in the first pass. Otherwise it is coprime to M and therefore congruent to a wheel spoke, so the increasing candidate walk reaches it before any larger divisor. The first divisor found is the least factor, and finding none up to sqrt(n) certifies primality.",
        complexityRationale:
            "There are phi(M) spokes out of M residues, so the wheel tests only phi(M)/M of the candidates up to sqrt(n), giving O(sqrt(n) * phi(M)/M) divisions. Building the wheel stores M residues and gaps, which is O(M) space.",
        uses: [
            "Speeding up trial division inside general-purpose factoring routines",
            "Generating candidate primes without storing a full sieve",
            "Teaching the idea of skipping provably useless work in number theory",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.5.4",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 3",
        ],
        workedExample:
            "With base primes 2, 3, 5 the circumference is 30 and the spokes are 1, 7, 11, 13, 17, 19, 23, 29, so 8 of every 30 candidates are tested. To factor 943 we skip all multiples of 2, 3, and 5 and test 7, 11, 13, 17, 19, 23; 23 divides 943, giving 943 = 23 * 41.",
    },
    id: "wheel-factorization",
    name: "Wheel Factorization",
    category: "math",
    complexity: { time: "O(sqrt(n) * phi(M) / M)", space: "O(M)" },
    defaultInput: { n: 943, basePrimes: [2, 3, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "choose base primes and set circumference M to their product",
        "list residues below M coprime to M (the wheel spokes)",
        "trial divide n by each base prime and report an early factor",
        "generate candidates as spoke plus k times M, in increasing order",
        "stop when a candidate divides n or its square exceeds n",
        "done: report the smallest factor, or that n is prime",
    ],
};

export default module;
