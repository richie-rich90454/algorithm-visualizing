/**
 * monte-carlo-cfr.ts - Monte Carlo Counterfactual Regret Minimization.
 *
 * Monte Carlo CFR estimates counterfactual regrets from sampled terminal
 * histories instead of traversing the whole game tree. Regret matching turns
 * accumulated positive regrets into a strategy, and the average strategy
 * converges to a Nash equilibrium in two-player zero-sum games.
 *
 * Time O(iterations * actions), space O(actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { iterations?: number; seed?: number; epsilon?: number };

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const NAMES = ["A", "B", "C"];
/** Player-one payoff for each root action against each chance outcome. */
const PAYOFF = [
    [1, 3],
    [6, 5],
    [2, 2],
];
const PRIOR = [0.5, 0.5];
const EXPECTED = PAYOFF.map((r) => PRIOR[0]! * r[0]! + PRIOR[1]! * r[1]!);

function strategyOf(regrets: number[]): number[] {
    const positive = regrets.map((r) => Math.max(0, r));
    const total = positive.reduce((a, b) => a + b, 0);
    if (total <= 0) return positive.map(() => 1 / positive.length);
    return positive.map((v) => v / total);
}

function entities(strategy: number[], hot: number): VisualEntity[] {
    return [
        {
            id: "root", type: "node" as const, label: "Monte Carlo CFR",
            value: 0, state: "idle", x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root" },
        },
        ...NAMES.map((name, i) => ({
            id: `action-${name}`, type: "node" as const,
            label: `${name} ${((strategy[i] ?? 0) * 100).toFixed(0)}%`,
            value: strategy[i] ?? 0,
            state: (i === hot ? "comparing" : (strategy[i] ?? 0) > 0.4 ? "sorted" : "unvisited") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root", probability: strategy[i] ?? 0 },
        })),
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const iterations = Math.max(10, Math.min(2000, Math.floor(Number(task.iterations ?? 600) || 600)));
    const epsilon = Math.max(0, Math.min(0.9, Number(task.epsilon ?? 0.15)));
    const rand = lcg(Number.isFinite(task.seed) ? Number(task.seed) : 99);
    const regrets = [0, 0, 0];
    const strategySum = [0, 0, 0];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: entities(strategyOf(regrets), -1),
        edges: [],
        description: `Monte Carlo CFR with ${iterations} sampled histories and uniform initial strategy.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { iterations, expected: [...EXPECTED] },
    };

    const period = Math.max(1, Math.floor(iterations / 6));
    for (let t = 0; t < iterations; t += 1) {
        const strategy = strategyOf(regrets);
        const explore = rand() < epsilon;
        let sampled = NAMES.length - 1;
        if (explore) {
            sampled = Math.min(NAMES.length - 1, Math.floor(rand() * NAMES.length));
        } else {
            const r = rand();
            let acc = 0;
            for (let i = 0; i < strategy.length; i += 1) {
                acc += strategy[i]!;
                if (r <= acc) { sampled = i; break; }
            }
        }
        const hidden = rand() < PRIOR[0]! ? 0 : 1;
        const sampledPayoff = PAYOFF[sampled]![hidden]!;
        for (let a = 0; a < NAMES.length; a += 1) {
            regrets[a] = (regrets[a] ?? 0) + (PAYOFF[a]![hidden]! - sampledPayoff);
        }
        for (let a = 0; a < NAMES.length; a += 1) {
            strategySum[a] = (strategySum[a] ?? 0) + (strategy[a] ?? 0);
        }

        if ((t + 1) % period === 0 || t === iterations - 1) {
            const current = strategyOf(regrets);
            yield {
                stepNumber: step++,
                entities: entities(current, sampled),
                edges: [],
                description: `History ${t + 1}: sampled action ${NAMES[sampled]} under outcome ${hidden}; strategy now ${current.map((p, i) => `${NAMES[i]}=${p.toFixed(2)}`).join(", ")}.`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { iterations: t + 1, regrets: [...regrets], strategy: current },
            };
        }
    }

    const average = strategySum.map((v) => v / iterations);
    let best = 0;
    for (let a = 1; a < NAMES.length; a += 1) {
        if ((average[a] ?? 0) > (average[best] ?? 0)) best = a;
    }
    yield {
        stepNumber: step,
        entities: entities(average, best).map((e) =>
            e.id === `action-${NAMES[best]}` ? { ...e, state: "sorted" as EntityState } : e,
        ),
        edges: [],
        description: `Average strategy converges to ${NAMES[best]} (${(average[best]! * 100).toFixed(0)}%), the best response in expectation.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { strategy: average, best: NAMES[best], winner: NAMES[best] },
    };
}

const module: AlgorithmModule = {
    id: "monte-carlo-cfr",
    name: "Monte Carlo Counterfactual Regret Minimization",
    category: "game",
    complexity: { time: "O(iterations * actions)", space: "O(actions)" },
    defaultInput: { iterations: 600, seed: 99, epsilon: 0.15 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize counterfactual regrets and strategy sums to zero",
        "for each iteration sample a history and its chance outcomes",
        "compute each action's counterfactual payoff along the sampled history",
        "add payoff minus sampled payoff to each action's regret",
        "convert positive regrets into a strategy by regret matching",
        "accumulate the average strategy over all iterations",
        "report the best action of the average strategy",
    ],
    education: {
        intuition:
            "Regret for an action measures how much better the player would have done had they always chosen it in hindsight. Monte Carlo CFR estimates those regrets from a few sampled games instead of every possible game, then plays actions in proportion to their positive regret. Averaging the strategy over time smooths out the sampling noise.",
        invariants: [
            "Every regret is the accumulated payoff difference against the sampled action.",
            "The strategy assigns zero probability to actions with nonpositive regret.",
            "Strategy probabilities always sum to one.",
        ],
        correctness:
            "Counterfactual regret matching bounds each information set's regret by a quantity that grows sublinearly in the number of iterations. In two-player zero-sum games the sum of the players' average regrets bounds the exploitability, so the average strategy converges to a Nash equilibrium. Sampling preserves the same expectation as full traversal, keeping the guarantee in expectation.",
        complexityRationale:
            "Each sampled history updates one regret per action, giving O(iterations * actions) time. Regret and strategy-sum arrays use O(actions) space for this single decision node.",
        uses: [
            "Solving large poker and other imperfect-information games",
            "Approximate equilibrium computation in extensive-form games",
            "Online decision making with hindsight regret guarantees",
        ],
        references: [
            "Zinkevich, Johanson, Bowling, and Piccione, Regret Minimization in Games with Incomplete Information, 2007",
            "Lanctot et al., Monte Carlo Sampling for Regret Minimization in Extensive Games, 2009",
        ],
        workedExample:
            "Against two equally likely outcomes, action A pays 1 or 3, B pays 6 or 5, and C pays 2 or 2. A sampled history where B pays 6 gives B no regret but makes A and C regret their lower payoffs. Over many histories B's positive regret dominates, so the average strategy concentrates on B.",
    },
};

export default module;
