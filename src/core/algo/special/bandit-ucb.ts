/**
 * bandit-ucb.ts – Multi-Armed Bandit (UCB1).
 * Three arms pay out with hidden rates [0.2,0.8,0.5]: try each once,
 * then always pull the arm maximizing avg + sqrt(2·ln t / n).
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { rounds?: number; seed?: number } | null) ?? {};
    const rounds = Math.max(4, Math.min(12, cfg.rounds ?? 9));
    const rnd = lcg(cfg.seed ?? 3);
    const means = [0.2, 0.8, 0.5];
    const counts = [0, 0, 0];
    const wins = [0, 0, 0];
    let step = 0;
    let last = -1;
    const frame = (t: number, desc: string): VisualFrame => {
        const entities: VisualEntity[] = means.map((_, i) => ({
            id: `arm-${i}`,
            type: "cell" as const,
            label: `a${i} ${(counts[i] ?? 0) > 0 ? ((wins[i] ?? 0) / (counts[i] ?? 1)).toFixed(2) : "?"}(${counts[i]})`,
            value:
                (counts[i] ?? 0) > 0
                    ? Math.round(((wins[i] ?? 0) / (counts[i] ?? 1)) * 100) / 100
                    : 0,
            state: (i === last ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: t,
            layout: "grid",
            meta: { round: t, counts: [...counts] },
        };
    };
    yield frame(0, "Three arms, unknown payouts: optimism first — try each once.");
    step += 1;
    for (let t = 1; t <= rounds; t += 1) {
        let arm = counts.indexOf(0);
        if (arm < 0) {
            let score = -Infinity;
            arm = 0;
            for (let i = 0; i < 3; i += 1) {
                const u =
                    (wins[i] ?? 0) / (counts[i] ?? 1) +
                    Math.sqrt((2 * Math.log(t)) / (counts[i] ?? 1));
                if (u > score) {
                    score = u;
                    arm = i;
                }
            }
        }
        const reward = rnd() < (means[arm] ?? 0) ? 1 : 0;
        counts[arm] = (counts[arm] ?? 0) + 1;
        wins[arm] = (wins[arm] ?? 0) + reward;
        last = arm;
        yield frame(
            t,
            `Round ${t}: pulled arm ${arm} → reward ${reward} (avg ${((wins[arm] ?? 0) / (counts[arm] ?? 1)).toFixed(2)}).`,
        );
        step += 1;
    }
    const fav = counts.indexOf(Math.max(...counts));
    yield frame(
        rounds + 1,
        `Done: arm ${fav} pulled most (${counts[fav]}×); true best is arm 1 (0.8).`,
    );
}

const module: AlgorithmModule = {
    id: "bandit-ucb",
    name: "Bandit UCB1",
    category: "math",
    complexity: { time: "O(t·k)", space: "O(k)" },
    defaultInput: { rounds: 9, seed: 3 },
    visualType: "grid",
    run,
};

export default module;
