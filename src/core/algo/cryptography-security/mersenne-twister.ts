/**
 * mersenne-twister.ts - MT19937 Mersenne Twister Pseudorandom Generator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MT19937 is the most widely used pseudorandom number generator. It keeps a
 * state of 624 words, periodically twists that state with a recurrence based on
 * a Mersenne prime, and tempers each output word with a few shifts and masks.
 * The result has a period of 2 superscript 19937 minus one and passes demanding
 * statistical tests. This is a faithful teaching implementation of the generator,
 * not a cryptographically secure source.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) amortized per 32-bit word (a twist every 624 words)
 *   Space: O(624) words of state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per generated word, scaled to a readable height.
 *   - The label carries the full unsigned 32-bit output value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

/** Create a fresh MT19937 generator seeded by a single 32-bit value. */
export function createMt19937(seed: number): { next: () => number } {
    const mt = new Array<number>(N).fill(0);
    mt[0] = seed >>> 0;
    for (let i = 1; i < N; i += 1) {
        const prev = mt[i - 1]!;
        mt[i] = ((Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + i) >>> 0);
    }
    let index = N;

    const twist = (): void => {
        let y: number;
        for (let i = 0; i < N - M; i += 1) {
            y = (mt[i]! & UPPER_MASK) | (mt[i + 1]! & LOWER_MASK);
            mt[i] = (mt[i + M]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0)) >>> 0;
        }
        for (let i = N - M; i < N - 1; i += 1) {
            y = (mt[i]! & UPPER_MASK) | (mt[i + 1]! & LOWER_MASK);
            mt[i] = (mt[i + (M - N)]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0)) >>> 0;
        }
        y = (mt[N - 1]! & UPPER_MASK) | (mt[0]! & LOWER_MASK);
        mt[N - 1] = (mt[M - 1]! ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0)) >>> 0;
        index = 0;
    };

    const next = (): number => {
        if (index >= N) twist();
        let y = mt[index]!;
        index += 1;
        y ^= y >>> 11;
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= y >>> 18;
        return y >>> 0;
    };

    return { next };
}

/** Generate the first count words of a seeded MT19937 stream. */
export function mt19937Sequence(seed: number, count: number): number[] {
    const rng = createMt19937(seed);
    const output: number[] = [];
    for (let i = 0; i < count; i += 1) output.push(rng.next());
    return output;
}

function makeBars(outputs: number[], activeIndex: number): VisualEntity[] {
    return outputs.map((value, index) => {
        const scaled = Math.round((value / 4294967296) * 100);
        let state: EntityState = "visited";
        if (index === activeIndex) state = "active";
        return {
            id: `word-${index}`,
            type: "bar" as const,
            label: String(value),
            value: scaled,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, scaled },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; count?: number } | null) ?? {};
    const seed = (typeof task.seed === "number" ? Math.trunc(task.seed) : 5489) >>> 0;
    const count = typeof task.count === "number" ? Math.max(1, Math.min(64, Math.floor(task.count))) : 16;
    const outputs = mt19937Sequence(seed, count);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([], -1),
        edges: [],
        description: `Initialized the MT19937 state from seed ${seed}; about to generate ${count} word(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, count, outputs: [] as number[], generated: 0 },
    };
    step += 1;

    for (let i = 0; i < count; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(outputs.slice(0, i + 1), i),
            edges: [],
            description: `Word ${i + 1}: generated ${outputs[i]} (0x${outputs[i]!.toString(16).toUpperCase()}).`,
            codeLineNumber: i % 624 === 623 ? 2 : 1,
            layout: "array",
            meta: {
                seed,
                count,
                generated: i + 1,
                outputs: outputs.slice(0, i + 1),
                twisted: i % 624 === 623,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(outputs, -1),
        edges: [],
        description: `Generated ${count} word(s); the stream is deterministic for seed ${seed} but is not cryptographically secure.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { seed, count, generated: count, outputs, first: outputs[0] ?? 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a long shift register of 624 words. Every so often a recurrence mixes the high bit of one word with the low bits of the next and folds the result back into the state; that is the twist. Each request for a number pulls one word out and scrambles its bits with a few shifts and masks so the output looks uniform. The same seed always produces the same stream.",
        invariants: [
            "Every generated word is an unsigned 32-bit integer in the range zero to two to the thirty second power minus one.",
            "The state is twisted exactly once every 624 output words.",
            "A fixed seed yields a fully deterministic, reproducible stream.",
        ],
        correctness:
            "The twist recurrence mt[i] = mt[i+M] xor ((upper(mt[i]) or lower(mt[i+1])) shifted right by one) xor (matrix A when the low bit is one) is exactly the reference MT19937 recurrence, and the tempering shifts and masks match the published constants. Reproducing the canonical test vector for seed 5489 confirms the implementation is faithful; the tempering is a bijection, so distinct internal words give distinct outputs within a cycle.",
        complexityRationale:
            "A twist touches all 624 words once every 624 outputs, so the amortized cost per word is constant; tempering is a handful of bit operations. The state is a fixed array of 624 words, which is O(1) with respect to the number of outputs.",
        uses: [
            "Monte Carlo simulation and randomized testing in scientific code",
            "Procedural content generation in games and graphics",
            "A teaching reference for comparing statistical versus cryptographic randomness",
        ],
        references: [
            "Matsumoto and Nishimura, Mersenne Twister: A 623-Dimensionally Equidistributed Uniform Pseudo-Random Number Generator, 1998",
            "Nishimura and Matsumoto, Tables of 64-Bit Mersenne Twisters, 2000",
        ],
        workedExample:
            "Seeding with 5489 and asking for the first five words gives 3499211612, 581869302, 3890346734, 3586334585, and 545404204. Re-running with the same seed reproduces those five words exactly, while a different seed produces a completely different sequence.",
    },
    id: "mersenne-twister",
    name: "Mersenne Twister (MT19937)",
    category: "cryptography-security",
    complexity: { time: "O(1) amortized per word", space: "O(624) words" },
    defaultInput: { seed: 5489, count: 16 },
    visualType: "array",
    run,
    pseudocode: [
        "seed the 624-word state from the given seed",
        "for each requested word",
        "if the state is exhausted, twist all 624 words",
        "take the next internal word and apply the tempering shifts",
        "emit the resulting unsigned 32-bit value",
        "done: report the generated stream",
    ],
};

export default module;
