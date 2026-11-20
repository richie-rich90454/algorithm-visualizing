/**
 * fortuna-prng.ts - Fortuna Pseudorandom Number Generator (Teaching Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fortuna collects entropy into pools and periodically reseeds a block-based
 * generator. This toy keeps the architecture: a 32-word pool array, a reseed
 * counter, and an eight-word generator state that produces output words on
 * demand. The mixing uses a fast avalanche function instead of a block cipher,
 * so this is a teaching model of Fortuna's structure and not a secure PRNG.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n generated words plus O(pools) per reseed
 *   Space: O(pools + n) for the pools and recorded outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the eight generator state words after each operation.
 *   - The word just advanced is highlighted.
 *   - meta carries the output stream and reseed count for checking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const POOLS = 32;
const STATE_WORDS = 8;
const MASK = 0xffffffff;

/** Avalanche mixer used in place of a block cipher for this teaching model. */
export function mix32(value: number): number {
    let x = value >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x85ebca6b) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0;
    x = Math.imul(x, 0xc2b2ae35) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x >>> 0;
}

interface GeneratorState {
    pools: number[];
    state: number[];
    reseeds: number;
    counter: number;
}

function initialize(seed: number): GeneratorState {
    const pools = new Array<number>(POOLS).fill(0);
    const state = new Array<number>(STATE_WORDS).fill(0);
    for (let i = 0; i < STATE_WORDS; i += 1) {
        state[i] = mix32((seed >>> 0) + Math.imul(i + 1, 0x9e3779b9)) >>> 0;
    }
    return { pools, state, reseeds: 0, counter: 0 };
}

function reseed(gen: GeneratorState, entropy: number): void {
    gen.reseeds += 1;
    for (let p = 0; p < POOLS; p += 1) {
        gen.pools[p] = mix32(gen.pools[p]! ^ mix32((entropy >>> 0) + gen.reseeds * 0x9e3779b9 + p)) >>> 0;
    }
    for (let j = 0; j < STATE_WORDS; j += 1) {
        gen.state[j] = mix32(gen.state[j]! ^ gen.pools[j]!) >>> 0;
    }
    gen.counter = 0;
}

function nextWord(gen: GeneratorState): number {
    const index = gen.counter % STATE_WORDS;
    gen.counter += 1;
    const value = mix32((gen.state[index]! + gen.counter) >>> 0) >>> 0;
    gen.state[index] = value;
    return value;
}

interface Operation {
    type: "reseed" | "generate";
    entropy?: number;
    count?: number;
}

function stateBars(state: number[], active: number, done: boolean): VisualEntity[] {
    return state.map((word, index) => ({
        id: `word-${index}`,
        type: "bar" as const,
        label: `w${index}=${word.toString(16)}`,
        value: word,
        state: (done ? "sorted" : index === active ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, word },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; operations?: Operation[] } | null) ?? {};
    const seed = Math.floor(Number(task.seed ?? 12345)) >>> 0;
    const operations: Operation[] = task.operations ?? [
        { type: "generate", count: 3 },
        { type: "reseed", entropy: 987654321 },
        { type: "generate", count: 4 },
        { type: "generate", count: 2 },
    ];
    const gen = initialize(seed);
    const outputs: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: stateBars(gen.state, -1, false),
        edges: [],
        description: `Fortuna toy initialized with seed ${seed} and ${POOLS} entropy pools.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { seed, outputs: [], reseeds: 0, state: [...gen.state] },
    };
    step += 1;

    for (let i = 0; i < operations.length; i += 1) {
        const operation = operations[i]!;
        if (operation.type === "reseed") {
            reseed(gen, Math.floor(Number(operation.entropy ?? 0)) >>> 0);
        } else {
            const count = Math.min(16, Math.max(0, Math.floor(Number(operation.count ?? 1)) || 0));
            for (let j = 0; j < count; j += 1) outputs.push(nextWord(gen));
        }
        yield {
            stepNumber: step,
            entities: stateBars(gen.state, gen.counter % STATE_WORDS, false),
            edges: [],
            description: operation.type === "reseed"
                ? `Operation ${i}: reseed from entropy pool, reseed count now ${gen.reseeds}.`
                : `Operation ${i}: generate ${Math.floor(Number(operation.count ?? 0))} word(s), stream length now ${outputs.length}.`,
            codeLineNumber: operation.type === "reseed" ? 3 : 5,
            layout: "array",
            meta: { seed, outputs: [...outputs], reseeds: gen.reseeds, state: [...gen.state] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: stateBars(gen.state, -1, true),
        edges: [],
        description: `Fortuna toy produced ${outputs.length} word(s) across ${gen.reseeds} reseed(s).`,
        codeLineNumber: 7,
        layout: "array",
        meta: { seed, outputs: [...outputs], reseeds: gen.reseeds, state: [...gen.state] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Collect entropy in many pools and periodically stir it into a small generator state. Each reseed mixes fresh entropy through all pools before refreshing the state, so compromising the current state does not reveal past output. Generation then advances one state word at a time, producing a stream that looks random to an observer who lacks the seed.",
        invariants: [
            "Every state and output word is an unsigned 32-bit integer.",
            "A reseed increments the reseed counter and resets the output counter.",
            "Replaying the same seed and operations always yields the same output stream.",
        ],
        correctness:
            "The mixer is deterministic and avalanche-like: a one-bit input change flips roughly half the output bits. Because reseeding depends on the entropy and the reseed count, and each generated word depends on the current state slot and the counter, the replayed stream is identical for identical inputs. In the real Fortuna the mixer is a block cipher and the pools provide forward secrecy.",
        complexityRationale:
            "A reseed mixes all 32 pools and eight state words, constant work; generating n words is linear in n. Storing the pools, state and outputs uses space linear in the pools plus the stream length.",
        uses: [
            "A classroom model of pool-based random number generation",
            "Understanding reseeding and forward secrecy ideas",
            "A deterministic stream for reproducible teaching demos",
        ],
        references: [
            "Schneier, Fortuna: A Cryptographic Random Number Generator, 2003",
            "NIST SP 800-90A, Recommendation for Random Number Generation",
        ],
        workedExample:
            "Seeding with 12345 initializes eight state words. Generating three words advances state slots zero, one and two. A reseed with entropy 987654321 mixes all 32 pools and refreshes the state; the next generated word differs from the pre-reseed stream, and replaying the same seed reproduces every word exactly.",
    },
    id: "fortuna-prng",
    name: "Fortuna PRNG (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(n + pools)", space: "O(n + pools)" },
    defaultInput: {
        seed: 12345,
        operations: [
            { type: "generate", count: 3 },
            { type: "reseed", entropy: 987654321 },
            { type: "generate", count: 4 },
            { type: "generate", count: 2 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize all entropy pools to zero and derive eight state words from the seed",
        "for each requested operation",
        "on a reseed, mix entropy and the reseed count into every pool",
        "refresh the generator state from the pools and reset the output counter",
        "on generation, advance one state word and emit its mixed value",
        "append each emitted word to the output stream",
        "after all operations, report the stream and the reseed count",
        "publish the final state words in the closing frame",
    ],
};

export default module;
