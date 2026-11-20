/**
 * regret-matching.ts - Regret Matching
 *
 * Regret for an action is how much better that action would have performed
 * than the action actually chosen, summed over past rounds. Regret matching
 * plays each action in proportion to its positive regret, falling back to
 * uniform when no action has positive regret. In many games the average regret
 * vanishes as rounds grow, so the average strategy approaches equilibrium.
 *
 * Time O(rounds * actions); space O(actions) per player.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Payoffs = [[number, number], [number, number]];

function strategyFrom(regret: [number, number]): [number, number] {
    const pos: [number, number] = [Math.max(0, regret[0]), Math.max(0, regret[1])];
    const total = pos[0] + pos[1];
    if (total <= 0) return [0.5, 0.5];
    return [pos[0] / total, pos[1] / total];
}

function sample(p: [number, number], roll: number): number {
    return roll < p[0] ? 0 : 1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoffsA?: Payoffs; payoffsB?: Payoffs; rounds?: number; seed?: number } | null) ?? {};
    const A: Payoffs = task.payoffsA ?? [[4, 1], [3, 0]];
    const B: Payoffs = task.payoffsB ?? [[3, 1], [2, 0]];
    const rounds = typeof task.rounds === "number" ? Math.max(2, Math.min(80, Math.floor(task.rounds))) : 30;
    let s = (typeof task.seed === "number" ? Math.floor(task.seed) : 12345) >>> 0;
    const rand = (): number => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
    const regretA: [number, number] = [0, 0];
    const regretB: [number, number] = [0, 0];
    const historyA: number[] = [];
    const historyB: number[] = [];
    const sumA = [0, 0];
    const sumB = [0, 0];

    const cells = (strategyA: [number, number], strategyB: [number, number]): VisualEntity[] => [
        {
            id: "reg-A0", type: "cell", label: `A0 r=${regretA[0].toFixed(1)}`, value: regretA[0],
            state: "active" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 0, col: 0, kind: "regret" },
        },
        {
            id: "reg-A1", type: "cell", label: `A1 r=${regretA[1].toFixed(1)}`, value: regretA[1],
            state: "active" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 0, col: 1, kind: "regret" },
        },
        {
            id: "reg-B0", type: "cell", label: `B0 r=${regretB[0].toFixed(1)}`, value: regretB[0],
            state: "comparing" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 1, col: 0, kind: "regret" },
        },
        {
            id: "reg-B1", type: "cell", label: `B1 r=${regretB[1].toFixed(1)}`, value: regretB[1],
            state: "comparing" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 1, col: 1, kind: "regret" },
        },
        {
            id: "strat-A0", type: "cell", label: `p=${strategyA[0].toFixed(2)}`, value: strategyA[0],
            state: "sorted" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 2, col: 0, kind: "strategy" },
        },
        {
            id: "strat-A1", type: "cell", label: `p=${strategyA[1].toFixed(2)}`, value: strategyA[1],
            state: "sorted" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 2, col: 1, kind: "strategy" },
        },
        {
            id: "strat-B0", type: "cell", label: `p=${strategyB[0].toFixed(2)}`, value: strategyB[0],
            state: "highlight" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 3, col: 0, kind: "strategy" },
        },
        {
            id: "strat-B1", type: "cell", label: `p=${strategyB[1].toFixed(2)}`, value: strategyB[1],
            state: "highlight" as EntityState, x: 0, y: 0, width: 0, height: 0,
            metadata: { row: 3, col: 1, kind: "strategy" },
        },
    ];

    let step = 0;
    yield {
        stepNumber: step, entities: cells([0.5, 0.5], [0.5, 0.5]), edges: [],
        description: `Regret matching on a 2 by 2 game for ${rounds} rounds; regrets start at zero so play is uniform.`,
        codeLineNumber: 0, layout: "grid",
        meta: { rounds, payA: A.flat(), payB: B.flat(), regretA: [...regretA], regretB: [...regretB], strategyA: [0.5, 0.5], strategyB: [0.5, 0.5], historyA: [], historyB: [], rows: 4, cols: 2 },
    };
    step += 1;

    for (let t = 0; t < rounds; t += 1) {
        const strategyA = strategyFrom(regretA);
        const strategyB = strategyFrom(regretB);
        const a = sample(strategyA, rand());
        const b = sample(strategyB, rand());
        for (let k = 0; k < 2; k += 1) {
            regretA[k] = (regretA[k] ?? 0) + ((A[k]?.[b] ?? 0) - (A[a]?.[b] ?? 0));
            regretB[k] = (regretB[k] ?? 0) + ((B[a]?.[k] ?? 0) - (B[a]?.[b] ?? 0));
            sumA[k] = (sumA[k] ?? 0) + (k === a ? 1 : 0);
            sumB[k] = (sumB[k] ?? 0) + (k === b ? 1 : 0);
        }
        historyA.push(a);
        historyB.push(b);
        if ((t + 1) % 5 === 0 || t === rounds - 1) {
            yield {
                stepNumber: step, entities: cells(strategyA, strategyB), edges: [],
                description: `Round ${t + 1}: sampled actions ${a}, ${b}; regrets now A ${regretA.map((x) => x.toFixed(1)).join("/")}, B ${regretB.map((x) => x.toFixed(1)).join("/")}.`,
                codeLineNumber: 3, layout: "grid",
                meta: {
                    round: t + 1, regretA: [...regretA], regretB: [...regretB],
                    strategyA: [...strategyA], strategyB: [...strategyB],
                    historyA: [...historyA], historyB: [...historyB], rows: 4, cols: 2,
                },
            };
            step += 1;
        }
    }

    const avgA = sumA.map((v) => v / rounds);
    const avgB = sumB.map((v) => v / rounds);
    yield {
        stepNumber: step, entities: cells(strategyFrom(regretA), strategyFrom(regretB)), edges: [],
        description: `After ${rounds} rounds the average strategy is A ${avgA.map((x) => x.toFixed(2)).join("/")} and B ${avgB.map((x) => x.toFixed(2)).join("/")}.`,
        codeLineNumber: 6, layout: "grid",
        meta: { avgA: [...avgA], avgB: [...avgB], strategyA: strategyFrom(regretA), strategyB: strategyFrom(regretB), regretA: [...regretA], regretB: [...regretB], rounds, rows: 4, cols: 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "After each round a player asks how much better every unchosen action would have been. Actions with positive regret were missed opportunities, so the next strategy puts more weight on them. Over many rounds the accumulated regret is driven down and the average behavior settles toward equilibrium.",
        invariants: [
            "Regret of an action is the cumulative payoff difference versus the chosen action.",
            "Strategy probability is positive regret divided by total positive regret.",
            "When all regrets are nonpositive the strategy is uniform.",
        ],
        correctness:
            "The regret update is exactly the difference between each counterfactual payoff and the realized payoff, so it is the correct cumulative regret. Regret matching is known to keep average regret tending to zero in finite games, which implies the empirical distribution of play approaches a coarse correlated equilibrium; the dominant-action example concentrates on its dominant action.",
        complexityRationale:
            "Each round updates two regret vectors of length a and samples once, so the cost is O(rounds * a) time and O(a) space for regrets and action counts.",
        uses: [
            "No-regret learning and multi-agent reinforcement learning",
            "Computing equilibria in large normal-form games",
            "Online decision making with adversarial payoffs",
        ],
        references: [
            "Hart and Mas-Colell, A Simple Adaptive Procedure Leading to Correlated Equilibrium (2000)",
            "Cesa-Bianchi and Lugosi, Prediction, Learning, and Games (2006)",
        ],
        workedExample:
            "If action 0 would have paid 4 while the chosen action 1 paid 1, action 0 gains regret 3 for that round. With no other positive regret, the next strategy plays action 0 with probability one; repeating this drives the average strategy toward the dominant action.",
    },
    id: "regret-matching",
    name: "Regret Matching",
    category: "game",
    complexity: { time: "O(rounds * a)", space: "O(a)" },
    defaultInput: { payoffsA: [[4, 1], [3, 0]], payoffsB: [[3, 1], [2, 0]], rounds: 30, seed: 12345 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize all action regrets to zero for both players",
        "convert positive regrets into a probability distribution",
        "sample an action for each player from their distributions",
        "update each regret by the payoff gap to the chosen action",
        "record the chosen actions for the empirical average",
        "repeat for the specified number of rounds",
        "report the average strategies and final regrets",
    ],
};

export default module;
