/**
 * mcts-uct.ts – Monte Carlo Tree Search with UCT (3-arm bandit demo)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MCTS estimates each move by random playouts and grows the tree toward
 * promising lines. Simply: play each arm, then keep pulling the arm with
 * the best upper-confidence bound. Formally: UCT picks the arm maximizing
 * mean + c*sqrt(ln(N)/n) with c = 1.4, balancing exploration against
 * exploitation, and the run uses 9 fixed simulations with a seeded generator
 * so the visit and mean table is fully deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sims) playouts
 *   Space: O(arms) statistics
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Arms with visits highlight; the arm being pulled flashes YELLOW.
 *   - The most-visited arm paints GREEN (sorted) as the recommendation.
 *   - Labels show wins over visits plus the running mean value.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - UCT converges to the optimal arm as simulations grow.
 *   - The most-visited arm (not the best mean) is the recommendation.
 */
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
    const c = 1.4;
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
        description: `MCTS-UCT over bandit arms A/B/C with true means ${means.join("/")} – ${total} fixed simulations with UCT c=1.4 and seed 12345.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims: total, arms: [...names], means: [...means], c },
    };
    step += 1;
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
                description: `After ${s + 1} of ${total} simulations: visits ${names.map((nm, i) => `${nm} ${wins[i] ?? 0}/${visits[i] ?? 0}`).join(", ")} with UCT c=1.4.`,
                codeLineNumber: 2,
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
        description: `Most-visited bandit arm ${names[bestArm]} (${wins[bestArm]}/${visits[bestArm]} playouts) is the recommended optimal move.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: {
            visits: [...visits],
            wins: [...wins],
            best: names[bestArm],
            winner: names[bestArm],
        },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: snap(-1),
        edges: [],
        description: `UCT search complete: recommend arm ${names[bestArm]} as the optimal move after ${total} simulations.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: {
            visits: [...visits],
            wins: [...wins],
            best: names[bestArm],
            winner: names[bestArm],
        },
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
    pseudocode: [
        "start with bandit arms A/B/C and run 9 seeded UCT simulations",
        "pull each unvisited arm once to seed wins and visit counts",
        "select next arm by max mean + 1.4*sqrt(ln(N)/n) bound",
        "simulate a playout reward and back up wins and visits",
        "repeat selection and backup until all simulations finish",
        "recommend the most-visited arm as the optimal move",
    ],
};

export default module;
