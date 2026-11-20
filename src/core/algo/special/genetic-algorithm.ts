/**
 * genetic-algorithm.ts – Genetic Algorithm.
 * Maximizes 49-(x-7)^2 over 4-bit strings: tournament selection,
 * single-point crossover, bit-flip mutation, keep-the-best elite.
 * Fixed-seed LCG keeps the demo deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

const fit = (x: number): number => 49 - (x - 7) * (x - 7);
const bits = (x: number): string => x.toString(2).padStart(4, "0");

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { popSize?: number; generations?: number; seed?: number } | null) ?? {};
    const n = Math.max(2, Math.min(12, cfg.popSize ?? 6));
    const gens = Math.max(1, Math.min(8, cfg.generations ?? 4));
    const rnd = lcg(cfg.seed ?? 42);
    let pop: number[] = Array.from({ length: n }, () => Math.floor(rnd() * 16));
    if (pop.length === 0) pop = [0, 15];
    const bestOf = (p: number[]): number =>
        p.reduce((a, b) => (fit(b) > fit(a) ? b : a), p[0] ?? 7);
    let step = 0;
    const frame = (p: number[], gen: number, desc: string): VisualFrame => {
        const best = bestOf(p);
        const entities: VisualEntity[] = p.map((x, i) => ({
            id: `ind-${i}`,
            type: "cell" as const,
            label: `${bits(x)}=${fit(x)}`,
            value: fit(x),
            state: (x === best ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: gen, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(gen, 6),
            layout: "grid",
            meta: { generation: gen, best, bestFit: fit(best) },
        };
    };
    yield frame(pop, 0, `Generation 0: random 4-bit population (best ${bestOf(pop)}).`);
    step += 1;
    for (let g = 1; g <= gens; g += 1) {
        const elite = bestOf(pop);
        const pick = (): number => {
            const a = pop[Math.floor(rnd() * pop.length)] ?? 7;
            const b = pop[Math.floor(rnd() * pop.length)] ?? 7;
            return fit(a) >= fit(b) ? a : b;
        };
        const next: number[] = [elite];
        while (next.length < pop.length) {
            const cut = 1 + Math.floor(rnd() * 3);
            let child = parseInt(bits(pick()).slice(0, cut) + bits(pick()).slice(cut), 2);
            if (rnd() < 0.15) child ^= 1 << Math.floor(rnd() * 4);
            next.push(child);
        }
        pop = next;
        const b = bestOf(pop);
        yield frame(
            pop,
            g,
            `Generation ${g}: elite ${elite} kept, best now ${b} (fitness ${fit(b)}).`,
        );
        step += 1;
    }
    const b = bestOf(pop);
    yield frame(pop, gens, `Done: best x=${b} with fitness ${fit(b)} (optimum x=7, fitness 49).`);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A genetic algorithm evolves a population of candidate solutions using ideas from natural selection. It scores each individual by fitness, keeps the best one through elitism, and breeds the next generation by selecting parents with tournaments, crossing over their bits, and occasionally flipping a bit through mutation. Over generations, fitter traits tend to spread.",
        "invariants": [
            "The all-time best individual is never lost because the elite is carried over unchanged.",
            "Population size stays constant from one generation to the next.",
            "Every individual remains a valid 4-bit string representing a value from 0 to 15."
        ],
        "correctness": "A genetic algorithm is a metaheuristic with no general optimality guarantee. What does hold is that elitism keeps the best fitness non-decreasing across generations, and mutation gives every bit string a positive chance of appearing eventually, so the search is never permanently confined to a subset. Convergence to the global optimum is empirical.",
        "complexityRationale": "Each generation evaluates n individuals and breeds n-1 children; tournament selection and crossover are constant time for fixed-length strings, so O(n) per generation and O(g·n) for g generations. The population occupies O(n) space.",
        "uses": [
            "Engineering design and scheduling optimization",
            "Machine-learning hyperparameter tuning",
            "Evolving neural-network topologies",
            "Game AI and procedural content generation"
        ],
        "references": [
            "Holland, Adaptation in Natural and Artificial Systems, 1975",
            "Goldberg, Genetic Algorithms in Search, Optimization, and Machine Learning, 1989"
        ],
        "workedExample": "Start with six random 4-bit strings scored by 49-(x-7)^2, which peaks at x=7 with fitness 49. The fittest string is copied over as the elite. Two parents are chosen by tournament, a random crossover point splices their bits, and each child bit flips with probability 0.15. After four generations the best individual approaches 0111 (x=7), fitness 49."
    },
    id: "genetic-algorithm",
    name: "Genetic Algorithm",
    category: "math",
    complexity: { time: "O(g·n)", space: "O(n)" },
    defaultInput: { popSize: 6, generations: 4, seed: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize random 4-bit population of size n",
        "evaluate fitness 49-(x-7)^2 for every individual",
        "keep the elite best individual unchanged",
        "select parents by tournament and crossover bits",
        "mutate random bits with small probability",
        "repeat for each generation g",
        "done: best x reported near optimum 7 fitness 49",
    ],
};

export default module;
