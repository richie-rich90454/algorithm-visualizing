/**
 * nested-monte-carlo-tree-search.ts - Nested Monte Carlo Tree Search.
 *
 * Nested MCTS replaces the single random playout used by ordinary UCT with a
 * short inner Monte Carlo estimate: each time an action is selected, several
 * inner samples are averaged to produce its reward. The outer tree still uses
 * a UCT bound to balance exploration and exploitation, but every update is
 * based on the mean of a nested simulation rather than one rollout.
 *
 * Time O(outer * inner), space O(actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { sims?: number; seed?: number; inner?: number };

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const NAMES = ["A", "B", "C"];
/** Expected reward of each action against the two hidden states. */
const PAYOFF = [
    [1, 3],
    [6, 5],
    [2, 2],
];
const PRIOR = [0.5, 0.5];
const TRUTH = PAYOFF.map((row) => PRIOR[0]! * row[0]! + PRIOR[1]! * row[1]!);

function entities(
    visits: number[],
    totals: number[],
    selected: number,
): VisualEntity[] {
    return [
        {
            id: "root",
            type: "node" as const,
            label: "Nested MCTS",
            value: visits.reduce((a, b) => a + b, 0),
            state: "idle" as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root", visits: visits.reduce((a, b) => a + b, 0) },
        },
        ...NAMES.map((name, i) => ({
            id: `action-${name}`,
            type: "node" as const,
            label: `${name} ${totals[i]!.toFixed(1)}/${visits[i] ?? 0}`,
            value: visits[i] ?? 0,
            state: (i === selected ? "comparing" : (visits[i] ?? 0) > 0 ? "highlight" : "unvisited") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root", visits: visits[i] ?? 0, mean: visits[i] ? totals[i]! / visits[i]! : 0 },
        })),
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const sims = Math.max(3, Math.min(600, Math.floor(Number(task.sims ?? 120) || 120)));
    const inner = Math.max(1, Math.min(20, Math.floor(Number(task.inner ?? 4) || 4)));
    const rand = lcg(Number.isFinite(task.seed) ? Number(task.seed) : 4242);
    const c = 1.4;
    const visits = [0, 0, 0];
    const totals = [0, 0, 0];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: entities(visits, totals, -1),
        edges: [],
        description: `Nested MCTS with ${sims} outer simulations and ${inner} inner samples per update over actions A/B/C.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims, inner, truth: [...TRUTH] },
    };

    const period = Math.max(1, Math.floor(sims / 6));
    for (let s = 0; s < sims; s += 1) {
        let chosen = visits.findIndex((v) => v === 0);
        if (chosen < 0) {
            const totalVisits = visits.reduce((a, b) => a + b, 0);
            let best = -Infinity;
            for (let i = 0; i < NAMES.length; i += 1) {
                const mean = totals[i]! / (visits[i] ?? 1);
                const score = mean + c * Math.sqrt(Math.log(totalVisits) / (visits[i] ?? 1));
                if (score > best) { best = score; chosen = i; }
            }
        }
        let innerSum = 0;
        for (let k = 0; k < inner; k += 1) {
            const hidden = rand() < PRIOR[0]! ? 0 : 1;
            const base = PAYOFF[chosen]![hidden]!;
            innerSum += base + (rand() - 0.5);
        }
        const reward = innerSum / inner;
        visits[chosen] = (visits[chosen] ?? 0) + 1;
        totals[chosen] = (totals[chosen] ?? 0) + reward;

        if ((s + 1) % period === 0 || s === sims - 1) {
            yield {
                stepNumber: step++,
                entities: entities(visits, totals, chosen),
                edges: [],
                description: `After ${s + 1} outer simulations, action ${NAMES[chosen]} was nested-sampled; visits ${visits.join("/")}.`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { sims: s + 1, visits: [...visits], totals: [...totals] },
            };
        }
    }

    let best = 0;
    for (let i = 1; i < NAMES.length; i += 1) {
        if ((visits[i] ?? 0) > (visits[best] ?? 0)) best = i;
    }
    yield {
        stepNumber: step,
        entities: entities(visits, totals, best).map((e) =>
            e.id === `action-${NAMES[best]}` ? { ...e, state: "sorted" as EntityState } : e,
        ),
        edges: [],
        description: `Nested search recommends action ${NAMES[best]} with ${visits[best]} visits and mean ${(totals[best]! / (visits[best] || 1)).toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { visits: [...visits], totals: [...totals], best: NAMES[best], winner: NAMES[best] },
    };
}

const module: AlgorithmModule = {
    id: "nested-monte-carlo-tree-search",
    name: "Nested Monte Carlo Tree Search",
    category: "game",
    complexity: { time: "O(outer * inner)", space: "O(actions)" },
    defaultInput: { sims: 120, inner: 4, seed: 4242 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize visit and reward totals for every action",
        "for each outer simulation select an action by UCT",
        "run inner Monte Carlo samples and average their rewards",
        "add the averaged reward to the selected action",
        "back up the visit and reward to the tree root",
        "recommend the most visited action after all simulations",
    ],
    education: {
        intuition:
            "A single random playout is a noisy estimate of an action's value. Nested MCTS averages several playouts every time it evaluates an action, so each backup carries less noise. The outer tree uses the usual UCT rule to decide where to spend simulations.",
        invariants: [
            "Every action's stored value is the mean of its nested samples.",
            "Unvisited actions are selected before actions with a visit count.",
            "The UCT score combines the mean reward with an exploration bonus.",
        ],
        correctness:
            "Averaging inner samples leaves the expected reward unchanged while reducing its variance, so the signal backed up at each visit is more concentrated around the true action value. UCT samples every action often enough that the most visited action converges to the one with the largest expected reward.",
        complexityRationale:
            "Each of the outer simulations performs one selection and inner playouts, so time is O(outer * inner). Only visit and reward totals per action are stored, giving O(actions) space.",
        uses: [
            "Game search where playouts are expensive but repeatable",
            "Reducing variance in stochastic planning estimates",
            "Teaching the difference between rollout noise and selection bias",
        ],
        references: [
            "Coulom, Efficient Selectivity and Backup Operators in Monte-Carlo Tree Search, 2006",
            "Kocsis and Szepesvari, Bandit Based Monte-Carlo Planning, 2006",
        ],
        workedExample:
            "With actions A, B, and C having expected rewards 2, 5.5, and 2, the first three simulations try each action once. Thereafter UCT keeps sampling the action with the best mean plus exploration bonus; nested averaging with four inner samples makes B's advantage clear, so B becomes the most visited action.",
    },
};

export default module;
