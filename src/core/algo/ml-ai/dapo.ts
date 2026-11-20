/**
 * dapo.ts - DAPO: Decoupled Clip and Dynamic Sampling Policy Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DAPO extends group-relative policy optimization with three concrete changes.
 * It discards groups whose sampled rewards all agree, because they provide no
 * learning signal (dynamic sampling). It uses different clip bounds below and
 * above one so positive advantages are not clipped as aggressively (clip
 * higher). Finally it normalizes the objective by the total number of tokens
 * rather than by the number of samples, giving every token equal weight.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(G k) for G groups of k completions
 *   Space: O(G k) for the advantages, ratios, and surrogates
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show rewards, standardized advantages, and clipped surrogates.
 *   - A group with zero reward spread is shown as filtered out.
 *   - Meta exposes the asymmetric clip bounds and the token-level loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DapoInput {
    rewards?: number[][];
    oldLogProbs?: number[][];
    newLogProbs?: number[][];
    tokenCounts?: number[];
    epsLow?: number;
    epsHigh?: number;
    epsilon?: number;
}

function bars(values: number[], state: EntityState, prefix: string): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DapoInput | null) ?? {};
    const rewards = task.rewards ?? [
        [1, 0, -1],
        [2, 2, 2],
        [0.5, -0.5, 1.5],
    ];
    const oldLogProbs = task.oldLogProbs ?? [
        [-0.2, -0.5, -0.7],
        [-0.1, -0.1, -0.1],
        [-0.3, -0.6, -0.9],
    ];
    const newLogProbs = task.newLogProbs ?? [
        [-0.1, -0.6, -0.8],
        [-0.2, -0.2, -0.2],
        [-0.1, -0.5, -1.1],
    ];
    const tokenCounts = task.tokenCounts ?? [12, 8, 10];
    const epsLow = typeof task.epsLow === "number" ? Math.max(0, task.epsLow) : 0.2;
    const epsHigh = typeof task.epsHigh === "number" ? Math.max(0, task.epsHigh) : 0.28;
    const epsilon = typeof task.epsilon === "number" ? Math.max(0, task.epsilon) : 1e-8;

    const groups = Math.min(rewards.length, oldLogProbs.length, newLogProbs.length);
    const keptGroups: number[] = [];
    const filteredGroups: number[] = [];
    const perGroupStd: number[] = [];
    const advantages: number[] = [];
    const ratios: number[] = [];
    const surrogates: number[] = [];
    let totalTokens = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(rewards[0] ?? [], "idle", "reward"),
        edges: [],
        description: `DAPO over ${groups} groups with clip bounds [${1 - epsLow}, ${1 + epsHigh}] and token-level loss.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { groups, epsLow, epsHigh, epsilon, keptGroups, filteredGroups, advantages, ratios, surrogates, totalTokens, perGroupStd, policyLoss: 0 },
    };
    step += 1;

    for (let g = 0; g < groups; g += 1) {
        const r = rewards[g] ?? [];
        const mu = mean(r);
        const sigma = Math.sqrt(mean(r.map((v) => (v - mu) ** 2)));
        perGroupStd.push(sigma);
        if (sigma <= epsilon) {
            filteredGroups.push(g);
            continue;
        }
        keptGroups.push(g);
        totalTokens += tokenCounts[g] ?? 0;
        const groupAdv = r.map((v) => (v - mu) / (sigma + epsilon));
        advantages.push(...groupAdv);
        yield {
            stepNumber: step,
            entities: bars(groupAdv, "active", "adv"),
            edges: [],
            description: `Group ${g} kept: reward spread ${sigma.toFixed(4)}; standardized advantages computed for ${r.length} completions.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { groups, group: g, epsLow, epsHigh, keptGroups: [...keptGroups], filteredGroups: [...filteredGroups], advantages: [...advantages], perGroupStd: [...perGroupStd], totalTokens, ratios, surrogates },
        };
        step += 1;

        for (let i = 0; i < r.length; i += 1) {
            const ratio = Math.exp((newLogProbs[g]?.[i] ?? 0) - (oldLogProbs[g]?.[i] ?? 0));
            const clipped = Math.min(1 + epsHigh, Math.max(1 - epsLow, ratio));
            const adv = groupAdv[i] ?? 0;
            ratios.push(ratio);
            surrogates.push(Math.min(ratio * adv, clipped * adv));
        }
    }

    for (let g = 0; g < groups; g += 1) {
        if (filteredGroups.includes(g)) {
            yield {
                stepNumber: step,
                entities: bars(rewards[g] ?? [], "error", "filtered"),
                edges: [],
                description: `Group ${g} filtered by dynamic sampling: all rewards equal, so it carries no advantage signal.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { groups, group: g, epsLow, epsHigh, keptGroups: [...keptGroups], filteredGroups: [...filteredGroups], perGroupStd: [...perGroupStd], totalTokens },
            };
            step += 1;
        }
    }

    const policyLoss = totalTokens > 0 ? -surrogates.reduce((sum, v) => sum + v, 0) / totalTokens : 0;
    yield {
        stepNumber: step,
        entities: bars(surrogates, "sorted", "surrogate"),
        edges: [],
        description: `Done: ${keptGroups.length} group(s) kept, ${filteredGroups.length} filtered; token-level policy loss ${policyLoss.toFixed(6)} over ${totalTokens} token(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            groups,
            epsLow,
            epsHigh,
            keptGroups,
            filteredGroups,
            advantages,
            ratios,
            surrogates,
            perGroupStd,
            totalTokens,
            policyLoss,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When training a policy on groups of sampled answers, some groups have every answer scored the same and teach nothing. DAPO first drops those groups. It then clips probability ratios with an asymmetric window, allowing larger increases than decreases so promising answers are not held back. Finally it divides the objective by the total number of generated tokens, so long and short answers contribute in proportion to their length.",
        invariants: [
            "A group is kept only when its reward standard deviation exceeds epsilon.",
            "Within a kept group the standardized advantages have mean zero and unit spread.",
            "Each surrogate uses the asymmetric window [1 minus epsLow, 1 plus epsHigh].",
        ],
        correctness:
            "Dynamic sampling removes exactly the groups with zero reward variance, so no kept group has a degenerate advantage. Clip-higher sets separate lower and upper bounds, which is a decoupled trust region: positive advantages can gain up to 1 plus epsHigh before clipping while downside is capped at 1 minus epsLow. Dividing the summed surrogates by the total token count gives each token equal weight. The test recomputes the filter, the asymmetric clip, and the token-level average with an independent implementation.",
        complexityRationale:
            "Every group is scanned a constant number of times for its mean, spread, advantages, ratios, and surrogates, so time is O(G k) for k completions per group. The ratio, advantage, and surrogate arrays take O(G k) space.",
        uses: [
            "Reinforcement learning with verifiable rewards for large language models",
            "Reasoning training where many prompts yield all-equal rewards",
            "Stable policy optimization with length-aware normalization",
        ],
        references: [
            "Yu et al., DAPO: An Open-Source LLM Reinforcement Learning System, 2025",
            "Shao et al., DeepSeekMath: Pushing the Limits of Mathematical Reasoning, 2024",
            "Schulman et al., Proximal Policy Optimization Algorithms, 2017",
        ],
        workedExample:
            "Three groups score [1,0,-1], [2,2,2], and [0.5,-0.5,1.5]. The middle group has zero spread and is dropped. With epsLow 0.2 and epsHigh 0.28, a ratio of 1.25 is below the upper clip even though it exceeds the old symmetric 1.2 bound, and the final loss divides the sum of surrogates by the 22 tokens from the two kept groups.",
    },
    id: "dapo",
    name: "DAPO: Decoupled Clip and Dynamic Sampling Policy Optimization",
    category: "ml-ai",
    complexity: { time: "O(G k)", space: "O(G k)" },
    defaultInput: {
        rewards: [
            [1, 0, -1],
            [2, 2, 2],
            [0.5, -0.5, 1.5],
        ],
        oldLogProbs: [
            [-0.2, -0.5, -0.7],
            [-0.1, -0.1, -0.1],
            [-0.3, -0.6, -0.9],
        ],
        newLogProbs: [
            [-0.1, -0.6, -0.8],
            [-0.2, -0.2, -0.2],
            [-0.1, -0.5, -1.1],
        ],
        tokenCounts: [12, 8, 10],
        epsLow: 0.2,
        epsHigh: 0.28,
    },
    visualType: "array",
    run,
    pseudocode: [
        "sample groups of completions and score each with a reward",
        "compute each group's reward mean and standard deviation",
        "drop groups whose reward spread is below epsilon",
        "standardize rewards to advantages inside each kept group",
        "compute the probability ratio of new over old log probability",
        "clip the ratio into the asymmetric window and take the smaller surrogate",
        "average surrogates by total tokens and negate for the loss",
        "done: report kept groups and the token-level policy loss",
    ],
};

export default module;
