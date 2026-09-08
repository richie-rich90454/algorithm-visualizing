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
            codeLineNumber: gen,
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
    id: "genetic-algorithm",
    name: "Genetic Algorithm",
    category: "math",
    complexity: { time: "O(g·n)", space: "O(n)" },
    defaultInput: { popSize: 6, generations: 4, seed: 42 },
    visualType: "grid",
    run,
};

export default module;
