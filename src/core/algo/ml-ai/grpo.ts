/**
 * grpo.ts - Group Relative Policy Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GRPO removes the value network from PPO. For each prompt it samples a group
 * of completions, scores them, and uses the group-standardized reward as the
 * advantage. A clipped probability ratio keeps the policy update conservative
 * and an explicit KL term keeps it near a frozen reference policy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(G) per group for G sampled completions
 *   Space: O(G) for the advantages and ratios
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the standardized advantage of each completion in a group.
 *   - The final frame shows the clipped surrogate values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GrpoInput {
    rewards?: number[][];
    oldLogProbs?: number[][];
    newLogProbs?: number[][];
    refLogProbs?: number[][];
    clipEps?: number;
    beta?: number;
    epsilon?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "v"): VisualEntity[] {
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
    return values.length === 0 ? 0 : values.reduce((a, v) => a + v, 0) / values.length;
}

function std(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const mu = mean(values);
    return Math.sqrt(mean(values.map((v) => (v - mu) ** 2)));
}

/** Schutter's k3 unbiased KL estimator for one sample. */
function klTerm(newLogP: number, refLogP: number): number {
    const delta = refLogP - newLogP;
    return Math.exp(delta) - delta - 1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GrpoInput | null) ?? {};
    const rewards = task.rewards ?? [[1, 0, -1], [2, 1, 0]];
    const oldLogProbs = task.oldLogProbs ?? [
        [-0.2, -0.5, -0.7],
        [-0.3, -0.6, -0.9],
    ];
    const newLogProbs = task.newLogProbs ?? [
        [-0.1, -0.6, -0.8],
        [-0.1, -0.5, -1.1],
    ];
    const refLogProbs = task.refLogProbs ?? [
        [-0.25, -0.45, -0.75],
        [-0.35, -0.55, -0.85],
    ];
    const clipEps = typeof task.clipEps === "number" ? task.clipEps : 0.2;
    const beta = typeof task.beta === "number" ? task.beta : 0.04;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    const groups = Math.min(
        rewards.length,
        oldLogProbs.length,
        newLogProbs.length,
        refLogProbs.length,
    );
    const advantages: number[] = [];
    const ratios: number[] = [];
    const surrogates: number[] = [];
    const kls: number[] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars((rewards[0] ?? []).slice(), "idle", "reward"),
        edges: [],
        description: `GRPO over ${groups} group(s) with clipped ratio and KL coefficient ${beta}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, groups, clipEps, beta, loss: 0, meanKl: 0 },
    };
    step += 1;

    for (let g = 0; g < groups; g += 1) {
        const r = rewards[g] ?? [];
        const mu = mean(r);
        const sigma = std(r);
        const groupAdv: number[] = [];
        for (let i = 0; i < r.length; i += 1) {
            const adv = ((r[i] ?? 0) - mu) / (sigma + epsilon);
            groupAdv.push(adv);
            advantages.push(adv);
        }
        yield {
            stepNumber: step,
            entities: makeBars(groupAdv, "active", "adv"),
            edges: [],
            description: `Group ${g}: reward mean ${mu.toFixed(4)}, spread ${sigma.toFixed(4)}; standardized advantages computed for ${r.length} completions.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { step, group: g, mean: mu, std: sigma, advantages: groupAdv },
        };
        step += 1;

        for (let i = 0; i < r.length; i += 1) {
            const ratio = Math.exp((newLogProbs[g]?.[i] ?? 0) - (oldLogProbs[g]?.[i] ?? 0));
            const adv = groupAdv[i] ?? 0;
            const clipped = Math.min(1 + clipEps, Math.max(1 - clipEps, ratio));
            surrogates.push(Math.min(ratio * adv, clipped * adv));
            ratios.push(ratio);
            kls.push(klTerm(newLogProbs[g]?.[i] ?? 0, refLogProbs[g]?.[i] ?? 0));
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(surrogates, "idle", "surrogate"),
        edges: [],
        description: `Computed ${surrogates.length} clipped surrogates and KL terms before averaging the objective.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { step, ratios: ratios.slice(), surrogates: surrogates.slice(), meanKl: mean(kls) },
    };
    step += 1;

    const policyLoss = -mean(surrogates);
    const meanKl = mean(kls);
    const loss = policyLoss + beta * meanKl;
    yield {
        stepNumber: step,
        entities: makeBars(advantages, "sorted", "final"),
        edges: [],
        description: `Done: policy loss ${policyLoss.toFixed(6)}, mean KL ${meanKl.toFixed(6)}, objective ${loss.toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step, advantages, ratios, surrogates, policyLoss, meanKl, loss },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Training a language model with reinforcement learning usually needs a second network, the critic, to tell how much better one completion is than average. GRPO skips the critic: it samples several answers to the same question, ranks them by reward, and calls each answer's standardized score its advantage. A clipped ratio and a KL penalty to a reference model keep the update stable.",
        invariants: [
            "Inside every group the standardized rewards have mean zero and unit spread.",
            "The ratio is the exponential of the change in log probability.",
            "The surrogate is the elementwise minimum of the raw and clipped ratio times advantage.",
        ],
        correctness:
            "Standardizing subtracts the group mean and divides by the group standard deviation, so each advantage measures relative quality within its own prompt. The clipped surrogate is identical to PPO's trust region, and the k3 KL estimator is nonnegative in expectation and zero when the two policies agree. The test recomputes all group statistics, ratios, surrogates, and KL terms with an independent implementation.",
        complexityRationale:
            "Each group of G completions is scanned a constant number of times for the mean, spread, ratios, and surrogates, so the work is linear in the total number of samples and the stored arrays use linear space.",
        uses: [
            "Reasoning training for large language models with verifiable rewards",
            "Reinforcement learning from human feedback without a value model",
            "Group-based preference optimization where rewards are comparable within a prompt",
        ],
        references: [
            "Shao et al., DeepSeekMath: Pushing the Limits of Mathematical Reasoning, 2024",
            "Schulman et al., Proximal Policy Optimization Algorithms, 2017",
        ],
        workedExample:
            "If one prompt yields rewards 1, 0, and -1, the mean is zero and the spread is about 0.82, giving advantages near 1.22, 0, and -1.22. A completion whose probability rises above the old policy gets a positive ratio, but the clip caps its contribution at 1.2 times its advantage.",
    },
    id: "grpo",
    name: "Group Relative Policy Optimization",
    category: "ml-ai",
    complexity: { time: "O(G)", space: "O(G)" },
    defaultInput: {
        rewards: [
            [1, 0, -1],
            [2, 1, 0],
        ],
        oldLogProbs: [
            [-0.2, -0.5, -0.7],
            [-0.3, -0.6, -0.9],
        ],
        newLogProbs: [
            [-0.1, -0.6, -0.8],
            [-0.1, -0.5, -1.1],
        ],
        refLogProbs: [
            [-0.25, -0.45, -0.75],
            [-0.35, -0.55, -0.85],
        ],
        clipEps: 0.2,
        beta: 0.04,
    },
    visualType: "array",
    run,
    pseudocode: [
        "sample a group of completions for each prompt and score them",
        "compute the mean and standard deviation of the group rewards",
        "set each advantage to the standardized reward of its completion",
        "compute the probability ratio of new over old log probability",
        "clip the ratio and take the smaller surrogate times advantage",
        "estimate the KL divergence to the frozen reference policy",
        "average the clipped objective minus the KL penalty",
        "done: report the final policy objective",
    ],
};

export default module;
