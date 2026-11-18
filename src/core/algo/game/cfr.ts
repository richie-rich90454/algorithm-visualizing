/**
 * cfr.ts - Counterfactual Regret Minimization
 *
 * CFR solves extensive-form games by minimizing regret at every information
 * set. At each set it measures how much each action would have improved the
 * player's payoff had that action been taken, weighted by the probability the
 * information set is reached. Regret matching then updates the strategy, and
 * the average of the strategies over all iterations converges to a Nash
 * equilibrium in two-player zero-sum games.
 *
 * Time O(iterations * information sets * actions); space O(information sets * actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type InfoId = "I1" | "I2a" | "I2b";
type Vec = [number, number];

const regretMatch = (r: Vec): Vec => {
    const pos: Vec = [Math.max(0, r[0]), Math.max(0, r[1])];
    const total = pos[0] + pos[1];
    return total > 0 ? [pos[0] / total, pos[1] / total] : [0.5, 0.5];
};

// A small exploration floor keeps rarely reached information sets learning.
const strategyOf = (r: Vec): Vec => {
    const base = regretMatch(r);
    return [base[0] * 0.98 + 0.01, base[1] * 0.98 + 0.01];
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { iterations?: number } | null) ?? {};
    const iterations = typeof task.iterations === "number" ? Math.max(20, Math.min(1500, Math.floor(task.iterations))) : 300;
    // Player 1 payoff, player 2 payoff for (first action, second action).
    const u1: Vec[] = [[3, 1], [0, 2]];
    const u2: Vec[] = [[-3, -1], [0, -2]];
    const regrets: Record<InfoId, Vec> = { I1: [0, 0], I2a: [0, 0], I2b: [0, 0] };
    const cum: Record<InfoId, Vec> = { I1: [0, 0], I2a: [0, 0], I2b: [0, 0] };

    const base = (strategyI1: Vec, strategyA: Vec, strategyB: Vec): VisualEntity[] => {
        const node = (id: string, label: string, parent: string | null, state: EntityState, value: number): VisualEntity => ({
            id, type: "node" as const, label, value, state,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: parent ?? "root" },
        });
        return [
            node("I1", `P1 ${strategyI1.map((x) => x.toFixed(2)).join("/")}`, null, "comparing", strategyI1[0]),
            node("I2a", `P2a ${strategyA.map((x) => x.toFixed(2)).join("/")}`, "I1", "highlight", strategyA[0]),
            node("I2b", `P2b ${strategyB.map((x) => x.toFixed(2)).join("/")}`, "I1", "highlight", strategyB[0]),
            node("t00", `(${u1[0]?.[0]},${u2[0]?.[0]})`, "I2a", "idle", u1[0]?.[0] ?? 0),
            node("t01", `(${u1[0]?.[1]},${u2[0]?.[1]})`, "I2a", "idle", u1[0]?.[1] ?? 0),
            node("t10", `(${u1[1]?.[0]},${u2[1]?.[0]})`, "I2b", "idle", u1[1]?.[0] ?? 0),
            node("t11", `(${u1[1]?.[1]},${u2[1]?.[1]})`, "I2b", "idle", u1[1]?.[1] ?? 0),
        ];
    };
    const edges = [
        ["I1", "I2a"], ["I1", "I2b"],
        ["I2a", "t00"], ["I2a", "t01"], ["I2b", "t10"], ["I2b", "t11"],
    ].map(([s, t]) => ({ id: `edge-${s}-${t}`, sourceId: s, targetId: t, label: "", state: "idle" as EntityState, directed: false }));

    const avg = (id: InfoId): Vec => {
        const total = cum[id][0] + cum[id][1];
        return total > 0 ? [cum[id][0] / total, cum[id][1] / total] : [0.5, 0.5];
    };

    let step = 0;
    yield {
        stepNumber: step, entities: base([0.5, 0.5], [0.5, 0.5], [0.5, 0.5]), edges,
        description: `Counterfactual regret minimization for ${iterations} iterations on a two-level game with three information sets.`,
        codeLineNumber: 0, layout: "tree",
        meta: { iterations, strategyI1: [0.5, 0.5], strategyI2a: [0.5, 0.5], strategyI2b: [0.5, 0.5], avgI1: [0.5, 0.5], avgI2a: [0.5, 0.5], avgI2b: [0.5, 0.5] },
    };
    step += 1;

    for (let t = 1; t <= iterations; t += 1) {
        const s1 = strategyOf(regrets.I1);
        const s2a = strategyOf(regrets.I2a);
        const s2b = strategyOf(regrets.I2b);

        const cf1: Vec = [
            s2a[0] * (u1[0]?.[0] ?? 0) + s2a[1] * (u1[0]?.[1] ?? 0),
            s2b[0] * (u1[1]?.[0] ?? 0) + s2b[1] * (u1[1]?.[1] ?? 0),
        ];
        const cf1bar = s1[0] * cf1[0] + s1[1] * cf1[1];
        for (let a = 0; a < 2; a += 1) {
            regrets.I1[a] = (regrets.I1[a] ?? 0) + ((cf1[a] ?? 0) - cf1bar);
            cum.I1[a] = (cum.I1[a] ?? 0) + (s1[a] ?? 0);
        }

        const reachA = s1[0] ?? 0;
        const u2a: Vec = [u2[0]?.[0] ?? 0, u2[0]?.[1] ?? 0];
        const u2abar = s2a[0] * u2a[0] + s2a[1] * u2a[1];
        for (let b = 0; b < 2; b += 1) {
            regrets.I2a[b] = (regrets.I2a[b] ?? 0) + reachA * ((u2a[b] ?? 0) - u2abar);
            cum.I2a[b] = (cum.I2a[b] ?? 0) + reachA * (s2a[b] ?? 0);
        }

        const reachB = s1[1] ?? 0;
        const u2b: Vec = [u2[1]?.[0] ?? 0, u2[1]?.[1] ?? 0];
        const u2bbar = s2b[0] * u2b[0] + s2b[1] * u2b[1];
        for (let b = 0; b < 2; b += 1) {
            regrets.I2b[b] = (regrets.I2b[b] ?? 0) + reachB * ((u2b[b] ?? 0) - u2bbar);
            cum.I2b[b] = (cum.I2b[b] ?? 0) + reachB * (s2b[b] ?? 0);
        }

        if (t % Math.max(1, Math.floor(iterations / 6)) === 0 || t === iterations) {
            yield {
                stepNumber: step, entities: base(s1, s2a, s2b), edges,
                description: `Iteration ${t}: current strategies P1 ${s1.map((x) => x.toFixed(2)).join("/")}, P2a ${s2a.map((x) => x.toFixed(2)).join("/")}, P2b ${s2b.map((x) => x.toFixed(2)).join("/")}.`,
                codeLineNumber: 4, layout: "tree",
                meta: {
                    iteration: t, strategyI1: [...s1], strategyI2a: [...s2a], strategyI2b: [...s2b],
                    avgI1: avg("I1"), avgI2a: avg("I2a"), avgI2b: avg("I2b"),
                    regretI1: [...regrets.I1], regretI2a: [...regrets.I2a], regretI2b: [...regrets.I2b],
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step, entities: base(avg("I1"), avg("I2a"), avg("I2b")).map((n) => n.id === "I1" ? { ...n, state: "sorted" as EntityState } : n), edges,
        description: `Average strategies converged: P1 ${avg("I1").map((x) => x.toFixed(2)).join("/")}, P2a ${avg("I2a").map((x) => x.toFixed(2)).join("/")}, P2b ${avg("I2b").map((x) => x.toFixed(2)).join("/")}.`,
        codeLineNumber: 6, layout: "tree",
        meta: { avgI1: avg("I1"), avgI2a: avg("I2a"), avgI2b: avg("I2b"), iterations, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CFR applies regret matching separately at every decision point a player might not know she is at. It measures each action's counterfactual payoff, weighting by how likely that information set is reached through no fault of the player. Averaging the strategies produced over many iterations yields an equilibrium for two-player zero-sum games.",
        invariants: [
            "Each information set keeps its own regrets and cumulative strategy.",
            "Counterfactual utilities hold the other players' strategies fixed.",
            "The average strategy is the normalized cumulative strategy at each set.",
        ],
        correctness:
            "At every information set, counterfactual regret compares each action's payoff with the strategy's expected payoff, so regret matching minimizes that regret locally. The counterfactual regret bound sums to the total regret, which grows sublinearly and therefore vanishes on average; in two-player zero-sum games vanishing average regret implies the average strategy profile is a Nash equilibrium.",
        complexityRationale:
            "Each iteration visits every information set and updates a constant number of actions, costing O(iterations * sets * actions) time and O(sets * actions) space for regrets and cumulative strategies.",
        uses: [
            "Solving poker and other imperfect-information games",
            "Computing Nash equilibria in extensive-form games",
            "Game-theoretic analysis of multi-step strategic settings",
        ],
        references: [
            "Zinkevich, Johanson, Bowling, and Piccione, Regret Minimization in Games with Incomplete Information (2007)",
            "Shoham and Leyton-Brown, Multiagent Systems, chapter on extensive-form learning (2008)",
        ],
        workedExample:
            "In a game where player 1 first chooses a0 or a1 and player 2 responds after seeing the choice, player 2's best replies are R after a0 and L after a1. CFR raises the regret of those replies, then player 1 learns to prefer a0 because player 2's response to it pays more; the average strategy approaches that equilibrium profile.",
    },
    id: "cfr",
    name: "Counterfactual Regret Minimization",
    category: "game",
    complexity: { time: "O(iterations * sets * actions)", space: "O(sets * actions)" },
    defaultInput: { iterations: 300 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize regrets and cumulative strategies at each information set",
        "form a strategy from positive regrets at every set",
        "compute counterfactual action utilities weighted by reach probability",
        "update regrets by each action's gap to the mean payoff",
        "accumulate the current strategy weighted by reach probability",
        "repeat for the iteration budget",
        "normalize cumulative strategies and report the equilibrium profile",
    ],
};

export default module;
