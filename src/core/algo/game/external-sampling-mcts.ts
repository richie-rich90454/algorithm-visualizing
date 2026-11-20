/**
 * external-sampling-mcts.ts - External Sampling Monte Carlo Tree Search.
 *
 * External sampling enumerates chance outcomes inside the subtree being
 * evaluated and samples a single outcome everywhere else. The target subtree
 * therefore gets an exact expected value while the rest of the tree is
 * approximated cheaply, which is the key trick behind efficient sequence-form
 * search in large games.
 *
 * Time O(rounds * actions * outcomes), space O(actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { rounds?: number; seed?: number };

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const NAMES = ["A", "B", "C"];
const PAYOFF = [
    [1, 4],
    [6, 5],
    [2, 3],
];
const PRIOR = [0.5, 0.5];
const EXPECTED = PAYOFF.map((r) => PRIOR[0]! * r[0]! + PRIOR[1]! * r[1]!);

function entities(mean: number[], target: number): VisualEntity[] {
    return [
        {
            id: "root", type: "node" as const, label: "External Sampling MCTS",
            value: 0, state: "idle", x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root" },
        },
        ...NAMES.map((name, i) => ({
            id: `action-${name}`, type: "node" as const,
            label: `${name} ${mean[i]!.toFixed(2)}${i === target ? " *" : ""}`,
            value: mean[i] ?? 0,
            state: (i === target ? "comparing" : (mean[i] ?? 0) > 4 ? "sorted" : "unvisited") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root", target: i === target },
        })),
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const rounds = Math.max(6, Math.min(900, Math.floor(Number(task.rounds ?? 240) || 240)));
    const rand = lcg(Number.isFinite(task.seed) ? Number(task.seed) : 2024);
    const visits = [0, 0, 0];
    const totals = [0, 0, 0];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: entities([0, 0, 0], -1),
        edges: [],
        description: `External sampling over ${NAMES.length} actions for ${rounds} rounds; chance inside the target is enumerated.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { rounds, expected: [...EXPECTED] },
    };

    const period = Math.max(1, Math.floor(rounds / 6));
    for (let t = 0; t < rounds; t += 1) {
        const target = t % NAMES.length;
        for (let a = 0; a < NAMES.length; a += 1) {
            let reward: number;
            if (a === target) {
                reward = PRIOR[0]! * PAYOFF[a]![0]! + PRIOR[1]! * PAYOFF[a]![1]!;
            } else {
                const hidden = rand() < PRIOR[0]! ? 0 : 1;
                reward = PAYOFF[a]![hidden]!;
            }
            totals[a] = (totals[a] ?? 0) + reward;
            visits[a] = (visits[a] ?? 0) + 1;
        }

        if ((t + 1) % period === 0 || t === rounds - 1) {
            const mean = visits.map((v, i) => totals[i]! / Math.max(1, v));
            yield {
                stepNumber: step++,
                entities: entities(mean, target),
                edges: [],
                description: `Round ${t + 1}: target ${NAMES[target]} evaluated exactly; other actions sampled. Values ${mean.map((m) => m.toFixed(2)).join("/")}.`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { rounds: t + 1, mean: [...mean] },
            };
        }
    }

    const mean = visits.map((v, i) => totals[i]! / Math.max(1, v));
    let best = 0;
    for (let a = 1; a < NAMES.length; a += 1) {
        if (mean[a]! > mean[best]!) best = a;
    }
    yield {
        stepNumber: step,
        entities: entities(mean, best).map((e) =>
            e.id === `action-${NAMES[best]}` ? { ...e, state: "sorted" as EntityState } : e,
        ),
        edges: [],
        description: `External sampling recommends ${NAMES[best]} with estimated value ${mean[best]!.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { mean, best: NAMES[best], winner: NAMES[best] },
    };
}

const module: AlgorithmModule = {
    id: "external-sampling-mcts",
    name: "External Sampling Monte Carlo Tree Search",
    category: "game",
    complexity: { time: "O(rounds * actions * outcomes)", space: "O(actions)" },
    defaultInput: { rounds: 240, seed: 2024 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize visit counts and reward totals per action",
        "for each round choose a target action in rotation",
        "enumerate every chance outcome inside the target subtree",
        "sample one chance outcome for every other action",
        "accumulate the observed rewards for all actions",
        "repeat until the round budget is exhausted",
        "recommend the action with the largest mean reward",
    ],
    education: {
        intuition:
            "Sampling everywhere is fast but noisy; enumerating everywhere is accurate but slow. External sampling does the accurate thing only in the part of the tree currently being evaluated and samples the rest. Rotating which action is the target spreads the exact evaluations across all moves.",
        invariants: [
            "Chance nodes below the target action are expanded over all outcomes.",
            "Chance nodes elsewhere are represented by one sampled outcome.",
            "Every action is visited once per round.",
        ],
        correctness:
            "The target action's update equals its exact expected reward, so it is unbiased and low variance. Sampled updates for other actions are unbiased because a single outcome is drawn from the true distribution. Averaging over many rounds therefore converges every action estimate to its expected reward, making the largest mean the optimal action.",
        complexityRationale:
            "Each round enumerates two outcomes for one action and samples one outcome for the others, costing O(actions * outcomes) time. Only visit counts and reward totals per action are stored, so space is O(actions).",
        uses: [
            "Sequence-form search in large imperfect-information games",
            "Efficient policy improvement with stochastic environments",
            "A building block of sampled regret-minimization algorithms",
        ],
        references: [
            "Johanson, Bard, Bowling, and Zinkevich, Simplifying Action-Domain Regret Minimization, 2012",
            "Browne et al., A Survey of Monte Carlo Tree Search Methods, 2012",
        ],
        workedExample:
            "Actions A, B, and C earn 1 or 4, 6 or 5, and 2 or 3 across two equally likely outcomes. When B is the target its value is computed exactly as 5.5, while A and C use one sampled outcome each. Over many rounds A and C converge to 2.5 and B stays at 5.5, so B is recommended.",
    },
};

export default module;
