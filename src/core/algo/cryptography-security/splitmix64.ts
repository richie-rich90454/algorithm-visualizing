/**
 * splitmix64.ts - SplitMix64 Pseudorandom Number Generator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SplitMix64 advances a 64-bit state by the golden-ratio constant, then mixes
 * the result with two multiply-xorshift steps and a final xorshift. The large
 * odd multipliers and shifts diffuse every input bit across the output, giving
 * excellent statistical quality with only a handful of operations. It is often
 * used to seed larger generators such as xoshiro and to fill hash tables.
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
 *   - Array bars show the low 32 bits of each 64-bit output.
 *   - The current draw is CYAN; earlier draws are GREEN.
 *   - The final frame reports the full outputs as decimal strings.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const MIX1 = 0xbf58476d1ce4e5b9n;
const MIX2 = 0x94d049bb133111ebn;

/** Advance SplitMix64 once and return the mixed 64-bit output. */
function next(state: bigint): { state: bigint; output: bigint } {
    const s = (state + GOLDEN) & MASK64;
    let z = s;
    z = ((z ^ (z >> 30n)) * MIX1) & MASK64;
    z = ((z ^ (z >> 27n)) * MIX2) & MASK64;
    return { state: s, output: z ^ (z >> 31n) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number; draws?: number } | null) ?? {};
    const seed = BigInt(Math.floor(task.seed ?? 0));
    const draws = Math.max(1, Math.min(64, Math.floor(task.draws ?? 8)));

    const outputs: bigint[] = [];
    let state = seed;
    const low32 = (): number[] => outputs.map((v) => Number(v & 0xffffffffn));
    const entities = (active: number): VisualEntity[] =>
        Array.from({ length: draws }, (_, index) => ({
            id: `bar-${index}`,
            type: "bar" as const,
            label: (outputs[index] ?? 0n).toString().slice(0, 8),
            value: Number((outputs[index] ?? 0n) & 0xffffffffn) % 1000,
            state: index === active ? "active" : index < active ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, low32: Number((outputs[index] ?? 0n) & 0xffffffffn) },
        }));

    yield {
        stepNumber: 0,
        entities: entities(-1),
        edges: [],
        description: `Seeding SplitMix64 at 0x${state.toString(16)} for ${draws} draw(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { draws, seed: Number(seed), outputs: [] },
    };
    let step = 1;
    for (let i = 0; i < draws; i += 1) {
        const result = next(state);
        state = result.state;
        outputs.push(result.output);
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: `Draw ${i}: mixed output ${result.output.toString()} (low 32 bits ${Number(result.output & 0xffffffffn)}).`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                draws,
                seed: Number(seed),
                outputs: outputs.map((v) => v.toString()),
                low32: low32(),
                index: i,
            },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `Generated ${draws} SplitMix64 value(s); the seed fixes the entire stream.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { draws, seed: Number(seed), outputs: outputs.map((v) => v.toString()), low32: low32() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adding an irrational-looking constant to a counter spreads states evenly, but the result still has visible patterns. SplitMix64 destroys those patterns by multiplying by two large odd constants and exclusive-or shifting between steps. Every bit of the state influences every bit of the output, so the generator passes strong statistical tests while needing only a few machine words of state.",
        invariants: [
            "Adding the odd golden-ratio constant makes the state period two to the sixty-fourth power.",
            "The same seed always yields the same output stream.",
            "Each output is a 64-bit word, displayed through its low 32 bits.",
        ],
        correctness:
            "The state recurrence adds an odd constant modulo two to the sixty-fourth power, so it cycles through all states. The mixing function composes xor shifts with multiplication by odd constants, all of which are bijections on 64-bit words; their composition is therefore a bijection, so distinct states cannot collide. Determinism follows because every operation is a fixed function of the state, which is exactly what a seedable generator requires.",
        complexityRationale:
            "Each draw uses one addition, two multiplications and a few shifts on 64-bit words, so d draws take O(d) time. The output history and bar display store one word per draw, giving O(d) space.",
        uses: [
            "Seeding xoshiro and other modern generators",
            "Fast pseudorandom keys for hash tables and sampling",
            "Monte Carlo and randomized algorithm experiments",
        ],
        references: [
            "Steele, Lea and Flood, SplitMix64, 2014",
            "Wikipedia, Pseudorandom number generator, splitmix",
        ],
        workedExample:
            "From seed zero the first four SplitMix64 outputs are 16294208416658607535, 7960286522194355700, 487617019471545679 and 17909611376780542444. Reusing seed zero reproduces this sequence exactly.",
    },
    id: "splitmix64",
    name: "SplitMix64 Random Number Generator",
    category: "cryptography-security",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { seed: 0, draws: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "set the state to the seed value",
        "for each requested draw",
        "add the golden-ratio constant to the state",
        "multiply-xorshift the value by the first constant",
        "multiply-xorshift the result by the second constant",
        "apply a final xorshift and emit the word",
        "done: report the generated output stream",
    ],
};

export default module;
