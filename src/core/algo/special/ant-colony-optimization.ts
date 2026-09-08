/**
 * ant-colony-optimization.ts – Ant Colony Optimization.
 * Three ants tour 4 cities: move by pheromone^1 × (1/d)^2, then lay
 * pheromone 1/length on their tour and evaporate by half each round.
 * Fixed-seed LCG keeps the demo deterministic.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

const DIST = [
    [0, 2, 5, 3],
    [2, 0, 4, 1],
    [5, 4, 0, 2],
    [3, 1, 2, 0],
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { ants?: number; iters?: number; seed?: number } | null) ?? {};
    const ants = Math.max(1, Math.min(6, cfg.ants ?? 3));
    const iters = Math.max(1, Math.min(6, cfg.iters ?? 4));
    const rnd = lcg(cfg.seed ?? 11);
    const n = DIST.length;
    const pher = Array.from({ length: n }, () => new Array<number>(n).fill(1));
    let bestTour: number[] = [];
    let bestLen = Infinity;
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        pher.forEach((row, r) =>
            row.forEach((v, c) => {
                entities.push({
                    id: `ph-${r}-${c}`,
                    type: "cell" as const,
                    label: r === c ? "–" : v.toFixed(1),
                    value: Math.round(v * 10) / 10,
                    state: "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            }),
        );
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: { bestLen: bestLen === Infinity ? 0 : Math.round(bestLen * 100) / 100, bestTour },
        };
    };
    yield frame("Uniform pheromones: every edge looks equally good.", 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        const tours: number[][] = [];
        for (let a = 0; a < ants; a += 1) {
            const start = a % n;
            const tour = [start];
            const seen = new Set<number>([start]);
            while (tour.length < n) {
                const cur = tour[tour.length - 1] ?? 0;
                let total = 0;
                const weights: number[] = [];
                for (let c = 0; c < n; c += 1) {
                    const w =
                        seen.has(c) || c === cur
                            ? 0
                            : (pher[cur]?.[c] ?? 0) * (1 / (DIST[cur]?.[c] ?? 1) ** 2);
                    weights.push(w);
                    total += w;
                }
                let pick = -1;
                const roll = rnd() * total;
                let acc = 0;
                for (let c = 0; c < n; c += 1) {
                    acc += weights[c] ?? 0;
                    if ((weights[c] ?? 0) > 0 && roll <= acc) {
                        pick = c;
                        break;
                    }
                }
                if (pick < 0) {
                    for (let c = 0; c < n; c += 1) {
                        if (!seen.has(c)) {
                            pick = c;
                            break;
                        }
                    }
                }
                tour.push(pick);
                seen.add(pick);
            }
            tours.push(tour);
            let len = 0;
            for (let k = 0; k < n; k += 1) len += DIST[tour[k] ?? 0]?.[tour[(k + 1) % n] ?? 0] ?? 0;
            if (len < bestLen) {
                bestLen = len;
                bestTour = [...tour, tour[0] ?? 0];
            }
        }
        for (let r = 0; r < n; r += 1)
            for (let c = 0; c < n; c += 1) pher[r][c] = (pher[r]?.[c] ?? 0) * 0.5;
        for (const tour of tours) {
            let len = 0;
            for (let k = 0; k < n; k += 1) len += DIST[tour[k] ?? 0]?.[tour[(k + 1) % n] ?? 0] ?? 0;
            for (let k = 0; k < n; k += 1) {
                const u = tour[k] ?? 0;
                const v = tour[(k + 1) % n] ?? 0;
                pher[u][v] = (pher[u]?.[v] ?? 0) + 1 / len;
                pher[v][u] = (pher[v]?.[u] ?? 0) + 1 / len;
            }
        }
        yield frame(`Round ${t}: ants toured, pheromone laid on short tours (best ${bestLen}).`, t);
        step += 1;
    }
    yield frame(
        `Done: best tour [${bestTour.join("→")}] with length ${bestLen} (optimum 10).`,
        iters + 1,
    );
}

// Fixed-seed LCG keeps the demo deterministic.
const module: AlgorithmModule = {
    id: "ant-colony-optimization",
    name: "Ant Colony Optimization",
    category: "math",
    complexity: { time: "O(t·m·n²)", space: "O(n²)" },
    defaultInput: { ants: 3, iters: 4, seed: 11 },
    visualType: "grid",
    run,
};

export default module;
