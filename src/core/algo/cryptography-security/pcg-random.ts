/**
 * pcg-random.ts - PCG32 Pseudorandom Number Generator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PCG is a family of small, fast pseudorandom generators with good statistical
 * quality. The 32-bit variant advances a 64-bit linear congruential state by
 * state = state * 6364136223846793005 + increment, then permutes the high bits
 * with an XOR shift and a variable rotation (the XSH-RR output function). The
 * increment is odd, which gives the state recurrence full period. The same
 * seed and increment always produce the same stream.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) for d draws
 *   Space: O(d) for the displayed draw history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Array bars show each generated value reduced to a display range.
 *   - The current draw is CYAN; earlier draws are GREEN.
 *   - The final frame reports the full 32-bit outputs.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const MASK64 = (1n << 64n) - 1n;
const MULTIPLIER = 6364136223846793005n;

/** Advance PCG32 once and return the 32-bit permuted output. */
function next(state: bigint, increment: bigint): { state: bigint; output: number } {
    const s = (state * MULTIPLIER + increment) & MASK64;
    const xorshifted = ((s >> 18n) ^ s) >> 27n;
    const rotation = Number(s >> 59n);
    const rotated =
        ((xorshifted >> BigInt(rotation)) | (xorshifted << BigInt((-rotation) & 31))) & 0xffffffffn;
    return { state: s, output: Number(rotated) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; increment?: number; draws?: number } | null) ?? {};
    const seed = BigInt(Math.floor(task.seed ?? 42));
    const increment = ((BigInt(Math.floor(task.increment ?? 54)) << 1n) | 1n) & MASK64;
    const draws = Math.max(1, Math.min(64, Math.floor(task.draws ?? 8)));

    const outputs: number[] = [];
    let state = seed;
    const entities = (active: number): VisualEntity[] =>
        Array.from({ length: draws }, (_, index) => ({
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(outputs[index] ?? 0),
            value: (outputs[index] ?? 0) % 1000,
            state: index === active ? "active" : index < active ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, output: outputs[index] ?? 0 },
        }));

    yield {
        stepNumber: 0,
        entities: entities(-1),
        edges: [],
        description: `Seeding PCG32 with seed ${seed} and odd increment ${increment}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { draws, seed: Number(seed), outputs: [] },
    };
    let step = 1;
    for (let i = 0; i < draws; i += 1) {
        const result = next(state, increment);
        state = result.state;
        outputs.push(result.output);
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: `Draw ${i}: state advanced to 0x${state.toString(16)}; output ${result.output}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { draws, seed: Number(seed), outputs: [...outputs], index: i, output: result.output },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `Generated ${draws} PCG32 value(s); seed ${seed} reproduces this stream exactly.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { draws, seed: Number(seed), outputs },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A linear congruential generator has good long-range structure but weak low bits. PCG keeps the strong state recurrence and then scrambles its output: it shifts the state, folds the high bits together with an exclusive or, and rotates the result by a state-dependent amount. This hides the lattice structure while staying tiny and fast, which is why PCG is popular in simulations and game engines.",
        invariants: [
            "The increment is odd, so the 64-bit state recurrence has full period.",
            "A given seed and increment always produce the same output stream.",
            "Every displayed output is a 32-bit unsigned integer.",
        ],
        correctness:
            "An odd increment is coprime with two to the sixty-fourth power, so adding it repeatedly visits every 64-bit state before repeating. The XSH-RR step is a bijection on 32-bit words, so it preserves randomness quality without collapsing distinct states onto the same output. Because state advancement and output permutation are deterministic functions, identical seeds reproduce identical streams, which is the defining correctness requirement of a pseudorandom generator.",
        complexityRationale:
            "Each draw performs one 64-bit multiply and add plus a few shifts, so generating d values takes O(d). The bar display and output history store one value per draw, giving O(d) space.",
        uses: [
            "Simulation and Monte Carlo sampling",
            "Game engines and procedural content generation",
            "Seeded reproducible test data",
        ],
        references: [
            "O'Neill, PCG: A Family of Simple Fast Space-Efficient Statistically Good Algorithms, 2014",
            "Wikipedia, PCG random number generator",
        ],
        workedExample:
            "With seed 42 and increment 54, the odd internal increment is 109. The first three XSH-RR outputs are 211770500, 199114405 and 1239240681. Running the same seed again reproduces those values exactly.",
    },
    id: "pcg-random",
    name: "PCG32 Random Number Generator",
    category: "cryptography-security",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { seed: 42, increment: 54, draws: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "set the state to zero and force the increment odd",
        "for each requested draw",
        "multiply the state by the constant and add the increment",
        "fold the high bits with an exclusive or shift",
        "rotate the result by a state-dependent amount",
        "mask to thirty-two bits and emit the value",
        "done: report the generated output stream",
    ],
};

export default module;
