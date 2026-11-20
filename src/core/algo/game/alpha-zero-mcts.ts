/**
 * alpha-zero-mcts.ts - AlphaZero-Style MCTS with PUCT
 *
 * Unlike bandit UCT, AlphaZero-style search uses a learned prior policy and a
 * learned value estimate instead of random playouts. Selection follows PUCT,
 * Q(s,a) + c_puct * P(s,a) * sqrt(N(s)) / (1 + N(s,a)), which drives search
 * toward moves with high prior and high value while still exploring. Here the
 * network is replaced by a fixed deterministic prior and value oracle so the
 * whole run is reproducible and its arithmetic can be checked exactly.
 *
 * Time O(simulations * actions); space O(actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sims?: number; c?: number; seed?: number } | null) ?? {};
    const sims = typeof task.sims === "number" ? Math.max(2, Math.min(24, Math.floor(task.sims))) : 12;
    const c = typeof task.c === "number" && Number.isFinite(task.c) ? task.c : 1.5;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const rand = lcg(seed);
    const names = ["A", "B", "C", "D"];
    const priors = [0.15, 0.35, 0.3, 0.2];
    const truth = [0.2, 0.8, 0.6, 0.4];
    const visits = [0, 0, 0, 0];
    const sums = [0, 0, 0, 0];
    let parentN = 0;

    const view = (hot: number): VisualEntity[] => [
        {
            id: "root",
            type: "node" as const,
            label: `PUCT root N=${parentN}`,
            value: parentN,
            state: "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: "root", visits: parentN },
        },
        ...names.map((nm, i) => {
            const q = visits[i] === 0 ? 0 : (sums[i] ?? 0) / (visits[i] ?? 1);
            const score = q + c * (priors[i] ?? 0) * Math.sqrt(parentN) / (1 + (visits[i] ?? 0));
            return {
                id: `move-${nm}`,
                type: "node" as const,
                label: `${nm} P=${priors[i]} N=${visits[i]} Q=${q.toFixed(2)}`,
                value: q,
                state: (i === hot ? "comparing" : (visits[i] ?? 0) > 0 ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root", visits: visits[i] ?? 0, prior: priors[i] ?? 0 },
            };
        }),
    ];

    const edges = names.map((nm) => ({
        id: `edge-root-${nm}`,
        sourceId: "root",
        targetId: `move-${nm}`,
        label: `P=${priors[names.indexOf(nm)]}`,
        state: "idle" as EntityState,
        directed: true,
    }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: view(-1),
        edges,
        description: `AlphaZero-style MCTS with ${sims} simulations, PUCT constant ${c}, fixed priors and a deterministic value oracle.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims, c, seed, priors: [...priors], actions: [...names] },
    };
    step += 1;

    for (let s = 0; s < sims; s += 1) {
        const q = visits.map((v, i) => (v === 0 ? 0 : (sums[i] ?? 0) / v));
        const scores = visits.map((v, i) => (q[i] ?? 0) + c * (priors[i] ?? 0) * Math.sqrt(parentN) / (1 + v));
        let chosen = 0;
        for (let i = 1; i < scores.length; i += 1) {
            if ((scores[i] ?? 0) > (scores[chosen] ?? 0)) chosen = i;
        }
        const nBefore = [...visits];
        const parentNBefore = parentN;
        const noise = (rand() - 0.5) * 0.2;
        const value = Math.min(1, Math.max(0, (truth[chosen] ?? 0) + noise));
        visits[chosen] = (visits[chosen] ?? 0) + 1;
        sums[chosen] = (sums[chosen] ?? 0) + value;
        parentN += 1;

        if ((s + 1) % 3 === 0 || s === sims - 1) {
            yield {
                stepNumber: step,
                entities: view(chosen),
                edges,
                description: `Simulation ${s + 1}/${sims}: PUCT selected ${names[chosen]} with score ${(scores[chosen] ?? 0).toFixed(3)}; backed up value ${value.toFixed(3)}.`,
                codeLineNumber: 3,
                layout: "tree",
                meta: {
                    simulation: s + 1,
                    parentN,
                    parentNBefore,
                    n: [...visits],
                    nBefore,
                    q: [...q],
                    p: [...priors],
                    scores: [...scores],
                    chosen,
                    c,
                    value,
                },
            };
            step += 1;
        }
    }

    let best = 0;
    for (let i = 1; i < visits.length; i += 1) {
        if ((visits[i] ?? 0) > (visits[best] ?? 0)) best = i;
    }
    yield {
        stepNumber: step,
        entities: view(best).map((n) => (n.id === `move-${names[best]}` ? { ...n, state: "sorted" as EntityState } : n)),
        edges,
        description: `Search complete: most-visited move ${names[best]} (${visits[best]}/${parentN}) is the recommended move.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { n: [...visits], visits: [...visits], best: names[best], winner: names[best], parentN, totalVisits: parentN, value: sums[best] === 0 ? 0 : (sums[best] ?? 0) / (visits[best] ?? 1) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "AlphaZero replaces random playouts with two learned predictions: a prior that says which moves look promising and a value that estimates who is winning. MCTS then repeatedly picks moves by PUCT, which adds a visit-count-scaled exploration bonus to the prior and value, backs the resulting value up the tree, and finally recommends the most-visited move.",
        invariants: [
            "Each action stores a visit count N and a mean value Q.",
            "PUCT score is Q plus c times prior P times sqrt(parent N) over 1 plus N.",
            "Backing up a simulation increments N and adds its value to the action sum.",
        ],
        correctness:
            "PUCT is a Bayesian upper confidence rule: the exploration term shrinks as an action is visited and grows with the parent's visit count, so every action with nonzero prior is sampled enough to distinguish good from bad moves. Backing up unbiased value samples makes Q converge to each action's true value, and the most-visited action therefore converges to the best one as simulations grow.",
        complexityRationale:
            "Each simulation selects among a fixed number of actions and performs one backup, so the deterministic demo runs in O(simulations * actions) time and O(actions) space rather than simulating a real neural network.",
        uses: [
            "Board game engines such as AlphaZero and MuZero style agents",
            "Planning with a learned policy and value network but no handcrafted evaluation",
            "Decision making when a simulator is cheap and rollouts are expensive",
        ],
        references: [
            "Silver et al., Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm (2017)",
            "Kocsis and Szepesvari, Bandit Based Monte-Carlo Planning (2006)",
        ],
        workedExample:
            "With priors 0.15, 0.35, 0.30, 0.20 and parent visits 4, an untried action B scores 0 + 1.5 * 0.35 * 2 / 1, which beats a heavily visited action with a modest Q. PUCT therefore expands B first, and its backed-up value raises Q for later selections.",
    },
    id: "alpha-zero-mcts",
    name: "AlphaZero MCTS (PUCT)",
    category: "game",
    complexity: { time: "O(simulations * actions)", space: "O(actions)" },
    defaultInput: { sims: 12, c: 1.5, seed: 7 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize per-action visit counts N and value sums to zero",
        "for each simulation compute PUCT score for every action",
        "select the action with the largest PUCT score",
        "evaluate the selected action with the value oracle",
        "increment its visit count and add the value to its sum",
        "repeat until the simulation budget is exhausted",
        "recommend the most-visited action as the best move",
    ],
};

export default module;
