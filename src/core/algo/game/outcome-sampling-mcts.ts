/**
 * outcome-sampling-mcts.ts - Outcome Sampling Monte Carlo Tree Search.
 *
 * Outcome sampling keeps MCTS affordable in large stochastic games: when the
 * traversal reaches a chance node it samples a single outcome instead of
 * expanding every branch, and weights the resulting backup by the inverse
 * probability of that outcome. The weighting keeps the value estimate
 * unbiased while each playout follows only one path through chance nodes.
 *
 * Time O(sims * depth), space O(actions).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Input = { sims?: number; seed?: number };

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const NAMES = ["A", "B", "C"];
const PAYOFF = [
    [1, 3],
    [6, 4],
    [2, 2],
];
const PRIOR = [0.5, 0.5];
const EXPECTED = PAYOFF.map((r) => PRIOR[0]! * r[0]! + PRIOR[1]! * r[1]!);

function entities(mean: number[], visits: number[], hot: number): VisualEntity[] {
    return [
        {
            id: "root", type: "node" as const, label: "Outcome Sampling MCTS",
            value: 0, state: "idle", x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root" },
        },
        ...NAMES.map((name, i) => ({
            id: `action-${name}`, type: "node" as const,
            label: `${name} ${mean[i]!.toFixed(2)} (w=${(visits[i] ?? 0).toFixed(0)})`,
            value: mean[i] ?? 0,
            state: (i === hot ? "comparing" : (visits[i] ?? 0) > 0 ? "highlight" : "unvisited") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { parentId: "root", visits: visits[i] ?? 0 },
        })),
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const sims = Math.max(4, Math.min(800, Math.floor(Number(task.sims ?? 240) || 240)));
    const rand = lcg(Number.isFinite(task.seed) ? Number(task.seed) : 5150);
    const c = 1.4;
    const visits = [0, 0, 0];
    const weighted = [0, 0, 0];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: entities([0, 0, 0], visits, -1),
        edges: [],
        description: `Outcome sampling MCTS: ${sims} playouts, one chance outcome sampled per playout with inverse-probability backup.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { sims, expected: [...EXPECTED] },
    };

    const period = Math.max(1, Math.floor(sims / 6));
    for (let s = 0; s < sims; s += 1) {
        let chosen = visits.findIndex((v) => v === 0);
        if (chosen < 0) {
            const total = visits.reduce((a, b) => a + b, 0);
            let best = -Infinity;
            for (let a = 0; a < NAMES.length; a += 1) {
                const score = weighted[a]! / visits[a]! +
                    c * Math.sqrt(Math.log(total) / visits[a]!);
                if (score > best) { best = score; chosen = a; }
            }
        }
        const r = rand();
        const hidden = r < PRIOR[0]! ? 0 : 1;
        const probability = hidden === 0 ? PRIOR[0]! : PRIOR[1]!;
        const weight = 1 / probability;
        const reward = PAYOFF[chosen]![hidden]!;
        visits[chosen] = (visits[chosen] ?? 0) + 1;
        weighted[chosen] = (weighted[chosen] ?? 0) + weight * reward;

        if ((s + 1) % period === 0 || s === sims - 1) {
            const mean = visits.map((v, i) => (v > 0 ? weighted[i]! / v : 0));
            yield {
                stepNumber: step++,
                entities: entities(mean, visits, chosen),
                edges: [],
                description: `Playout ${s + 1}: sampled outcome ${hidden} under ${NAMES[chosen]}, backed up with weight ${weight.toFixed(1)}.`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { sims: s + 1, visits: [...visits], mean },
            };
        }
    }

    const mean = visits.map((v, i) => (v > 0 ? weighted[i]! / v : 0));
    let best = 0;
    for (let a = 1; a < NAMES.length; a += 1) {
        if (mean[a]! > mean[best]!) best = a;
    }
    yield {
        stepNumber: step,
        entities: entities(mean, visits, best).map((e) =>
            e.id === `action-${NAMES[best]}` ? { ...e, state: "sorted" as EntityState } : e,
        ),
        edges: [],
        description: `Weighted estimates recommend ${NAMES[best]} with value ${mean[best]!.toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { mean, best: NAMES[best], winner: NAMES[best] },
    };
}

const module: AlgorithmModule = {
    id: "outcome-sampling-mcts",
    name: "Outcome Sampling Monte Carlo Tree Search",
    category: "game",
    complexity: { time: "O(sims * depth)", space: "O(actions)" },
    defaultInput: { sims: 240, seed: 5150 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize visit counts and weighted reward totals",
        "for each playout select an action by UCT",
        "at the chance node sample one outcome from its distribution",
        "weight the observed reward by one over the outcome probability",
        "back up the weighted reward to the chosen action",
        "repeat until the playout budget is exhausted",
        "recommend the action with the largest weighted mean",
    ],
    education: {
        intuition:
            "Expanding every chance outcome makes a playout expensive. Outcome sampling follows just one randomly chosen outcome, then compensates by scaling its reward up by the inverse of that outcome's probability. Rare outcomes get larger weights, so the average stays unbiased.",
        invariants: [
            "Every backup is weighted by the inverse probability of the sampled outcome.",
            "The expected weighted reward equals the true action value.",
            "Unvisited actions are tried before well-visited ones.",
        ],
        correctness:
            "For each sampled outcome the contribution has expectation equal to the unweighted game value because the sampling probability cancels the inverse-probability weight. Averaging these unbiased contributions therefore converges to the true action value, and UCT concentrates visits on the highest-valued action.",
        complexityRationale:
            "A playout follows one path through the chance layer, costing O(depth), so sims playouts take O(sims * depth) time. Only per-action visit and reward totals are kept, using O(actions) space.",
        uses: [
            "Monte Carlo search in games with large chance branches",
            "Unbiased evaluation from sparse samples",
            "A component of Monte Carlo CFR implementations",
        ],
        references: [
            "Lanctot et al., Monte Carlo Sampling for Regret Minimization in Extensive Games, 2009",
            "Browne et al., A Survey of Monte Carlo Tree Search Methods, 2012",
        ],
        workedExample:
            "An action pays 6 in world 0 and 4 in world 1, each with probability one half. Sampling world 1 gives reward 4 but weight 2, contributing 8; sampling world 0 gives reward 6 with weight 2, contributing 12. The average of these weighted contributions is 10, matching twice the true expected reward of 5.",
    },
};

export default module;
