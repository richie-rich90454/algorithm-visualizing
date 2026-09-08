// mcts-uct.ts – MCTS with UCT on a 3-arm bandit: FIXED 9 simulations and a
// seeded LCG, so the run is fully deterministic. UCT with c=1.4 balances the
// arms; the visit/mean table is computed live, never hardcoded.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function mnode(
    id: string,
    label: string,
    parent: string | null,
    state: EntityState,
    value: number,
    visits: number,
): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent ?? "root", visits },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sims?: number } | null) ?? {};
    const total =
        typeof task.sims === "number" && task.sims >= 3 ? Math.min(9, Math.floor(task.sims)) : 9;
    const means = [0.2, 0.5, 0.7];
    const names = ["A", "B", "C"];
    const rand = lcg(12345);
    const visits = [0, 0, 0];
    const wins = [0, 0, 0];
    let step = 0;
    const snap = (hot: number): VisualEntity[] => [
        mnode(
            "root",
            `MCTS sims=${total}`,
            null,
            "idle",
            0,
            visits.reduce((a, b) => a + b, 0),
        ),
        ...names.map((nm, i) =>
            mnode(
                `arm-${nm}`,
                `${nm} ${wins[i] ?? 0}/${visits[i] ?? 0}`,
                "root",
                (i === hot
                    ? "comparing"
                    : (visits[i] ?? 0) > 0
                      ? "highlight"
                      : "idle") as EntityState,
                (visits[i] ?? 0) > 0 ? (wins[i] ?? 0) / (visits[i] ?? 1) : 0,
                visits[i] ?? 0,
            ),
        ),
    ];
    yield {
        stepNumber: step,
        entities: snap(-1),
        edges: [],
        description: `MCTS-UCT over arms A/B/C (true means ${means.join("/")}) – ${total} fixed simulations, seed 12345.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims: total },
    };
    step += 1;
    const c = 1.4;
    for (let s = 0; s < total; s += 1) {
        let chosen = visits.findIndex((v) => v === 0);
        if (chosen < 0) {
            let bestUct = -Infinity;
            chosen = 0;
            const n = visits.reduce((a, b) => a + b, 0);
            for (let i = 0; i < 3; i += 1) {
                const uct =
                    (wins[i] ?? 0) / (visits[i] ?? 1) +
                    c * Math.sqrt(Math.log(n) / (visits[i] ?? 1));
                if (uct > bestUct) {
                    bestUct = uct;
                    chosen = i;
                }
            }
        }
        const reward = rand() < (means[chosen] ?? 0) ? 1 : 0;
        visits[chosen] = (visits[chosen] ?? 0) + 1;
        wins[chosen] = (wins[chosen] ?? 0) + reward;
        if ((s + 1) % 3 === 0 || s === total - 1) {
            yield {
                stepNumber: step,
                entities: snap(chosen),
                edges: [],
                description: `After ${s + 1}/${total} sims: ${names.map((nm, i) => `${nm} ${wins[i] ?? 0}/${visits[i] ?? 0}`).join(", ")}.`,
                codeLineNumber: 1,
                layout: "tree",
                meta: { sims: s + 1, visits: [...visits], wins: [...wins] },
            };
            step += 1;
        }
    }
    let bestArm = 0;
    for (let i = 1; i < 3; i += 1) {
        if ((visits[i] ?? 0) > (visits[bestArm] ?? 0)) bestArm = i;
    }
    yield {
        stepNumber: step,
        entities: snap(-1).map((n) =>
            n.id === `arm-${names[bestArm]}` ? { ...n, state: "sorted" as EntityState } : n,
        ),
        edges: [],
        description: `Most-visited arm ${names[bestArm]} (${wins[bestArm]}/${visits[bestArm]}) is the recommendation.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { visits: [...visits], wins: [...wins], best: names[bestArm] },
    };
}

const module: AlgorithmModule = {
    id: "mcts-uct",
    name: "MCTS-UCT",
    category: "game",
    complexity: { time: "O(sims)", space: "O(arms)" },
    defaultInput: { sims: 9 },
    visualType: "tree",
    run,
};

export default module;
