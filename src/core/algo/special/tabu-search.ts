/**
 * tabu-search.ts – Tabu Search.
 * Minimizes (x-2)^2 on 0..9 from x=8: each step moves to the best
 * non-tabu neighbor (±1), remembering the last 2 positions. Aspiration
 * allows a tabu move that beats the all-time best.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const f = (x: number): number => (x - 2) * (x - 2);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { start?: number; iters?: number; tenure?: number } | null) ?? {};
    let cur = Math.max(0, Math.min(9, cfg.start ?? 8));
    const iters = Math.max(1, Math.min(10, cfg.iters ?? 6));
    const tenure = Math.max(1, Math.min(5, cfg.tenure ?? 2));
    let best = cur;
    const tabu: number[] = [];
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = Array.from({ length: 10 }, (_, x) => ({
            id: `x-${x}`,
            type: "bar" as const,
            label: String(f(x)),
            value: f(x),
            state: (x === best
                ? "sorted"
                : x === cur
                  ? "comparing"
                  : tabu.includes(x)
                    ? "visited"
                    : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: x },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "array",
            meta: { cur, best, bestFit: f(best) },
        };
    };
    yield frame(`Start at x=${cur} (f=${f(cur)}); tabu list empty.`, 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        const cands = [cur - 1, cur + 1].filter((x) => x >= 0 && x <= 9);
        const free = cands.filter((x) => !tabu.includes(x) || f(x) < f(best));
        const pool = free.length > 0 ? free : cands;
        const nxt = pool.reduce((a, b) => (f(b) < f(a) ? b : a), pool[0] ?? cur);
        tabu.push(cur);
        while (tabu.length > tenure) tabu.shift();
        cur = nxt;
        if (f(cur) < f(best)) best = cur;
        yield frame(`Step ${t}: moved to x=${cur} (f=${f(cur)}); tabu=[${tabu.join(",")}].`, t);
        step += 1;
    }
    yield frame(`Done: minimum x=${best} with f=${f(best)} (optimum x=2).`, iters + 1);
}

const module: AlgorithmModule = {
    id: "tabu-search",
    name: "Tabu Search",
    category: "math",
    complexity: { time: "O(t·n)", space: "O(tabu)" },
    defaultInput: { start: 8, iters: 6, tenure: 2 },
    visualType: "array",
    run,
};

export default module;
