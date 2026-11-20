/**
 * prioritized-experience-replay.ts - Prioritized Experience Replay Sampling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Prioritized experience replay samples transitions with probability proportional
 * to their temporal-difference error raised to a power, so surprising transitions
 * are replayed more often. Importance-sampling weights compensate for the bias
 * this introduces: a frequently sampled transition is down-weighted during
 * learning. After replay, the sampled transitions get fresh priorities.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to form sampling probabilities per pass over n transitions
 *   Space: O(n) for priorities, probabilities, and importance weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per transition shows its current replay priority.
 *   - The transition being replayed is highlighted.
 *   - Meta records probabilities, importance weights, and sampled indices.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PerInput {
    priorities?: number[];
    alpha?: number;
    beta?: number;
    epsilon?: number;
    batch?: number[];
    newPriorities?: number[];
}

function probabilities(priorities: number[], alpha: number): number[] {
    const raw = priorities.map((p) => Math.pow(Math.max(1e-12, p), alpha));
    const total = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map((v) => v / total);
}

function makeBars(priorities: number[], active: number): VisualEntity[] {
    return priorities.map((value, index) => ({
        id: `item-${index}`,
        type: "bar" as const,
        label: `p${index}=${value.toFixed(3)}`,
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, item: index },
    }));
}

/** The prioritized experience replay generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PerInput | null) ?? {};
    const initial = Array.isArray(task.priorities) && task.priorities.length > 0 ? [...task.priorities] : [4, 1, 3, 0.5, 2];
    const alpha = typeof task.alpha === "number" && task.alpha >= 0 ? task.alpha : 0.6;
    const beta = typeof task.beta === "number" && task.beta >= 0 ? task.beta : 0.4;
    const epsilon = typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 0.01;
    const batch: number[] = Array.isArray(task.batch) && task.batch.length > 0
        ? task.batch.filter((index) => index >= 0 && index < initial.length)
        : [0, 2];
    const newPriorities: number[] = Array.isArray(task.newPriorities) && task.newPriorities.length === batch.length
        ? [...task.newPriorities]
        : batch.map(() => 1);

    const n = initial.length;
    const priorities = initial.map((p) => Math.max(epsilon, p));
    const initialProbs = probabilities(priorities, alpha);
    const rawWeights = batch.map((index) => Math.pow((1 / n) / (initialProbs[index] ?? (1 / n)), beta));
    const maxWeight = Math.max(...rawWeights, 1e-12);
    const isWeights = rawWeights.map((w) => w / maxWeight);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(priorities, -1),
        edges: [],
        description: `Prioritized replay over ${n} transitions with alpha ${alpha} and beta ${beta}; batch of ${batch.length}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { item: -1, batchIndex: -1, priorities: [...priorities], probs: initialProbs, isWeights, batch: [...batch], epsilon },
    };
    step += 1;

    for (let k = 0; k < batch.length; k += 1) {
        const index = batch[k];
        if (index === undefined) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeBars(priorities, index),
            edges: [],
            description: `Replay ${k + 1}: item ${index} has probability ${(initialProbs[index] ?? 0).toFixed(3)} and importance weight ${(isWeights[k] ?? 0).toFixed(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { item: index, batchIndex: k, priorities: [...priorities], probs: initialProbs, isWeights, batch: [...batch], epsilon, sampledProb: initialProbs[index] ?? 0, sampledWeight: isWeights[k] ?? 0 },
        };
        priorities[index] = Math.max(epsilon, newPriorities[k] ?? epsilon);
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(priorities, -1),
        edges: [],
        description: `Final priorities after ${batch.length} replay update(s); probabilities ${probabilities(priorities, alpha).map((p) => p.toFixed(3)).join(", ")}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { item: -1, batchIndex: -1, priorities: [...priorities], probs: probabilities(priorities, alpha), isWeights, batch: [...batch], epsilon },
    };
}

/** The prioritized experience replay module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Not all experiences are equally useful. Prioritized replay stores each transition with a priority based on how wrong the model was, and samples more often those it has not learned well. Plain frequency sampling would waste time on easy cases. Because this changes the sampling distribution, importance weights scale each replayed transition back so the learned result stays unbiased.",
        invariants: [
            "Sampling probability is each priority raised to alpha and normalized.",
            "An importance weight is the inverse sampling probability raised to beta, normalized by the batch maximum.",
            "Replaying a transition replaces its priority with a fresh temporal-difference error.",
        ],
        correctness:
            "Sampling with probability proportional to priority concentrates updates on high-error transitions, which accelerates learning. The importance weight (1/N / P(i))^beta corrects the bias of sampling from a nonuniform distribution: at beta = 1 the weights exactly undo the sampling probabilities so the expected update equals uniform replay, while beta below one trades a little bias for lower variance. Normalizing by the largest weight keeps the overall step size stable.",
        complexityRationale:
            "Forming probabilities scans all n priorities once, costing O(n) per recomputation; sampling and weighting the batch cost O(batch). Priorities, probabilities, and weights use O(n + batch) space.",
        uses: [
            "Sample-efficient deep reinforcement learning such as Double DQN",
            "Replay buffers that focus training on hard examples",
            "A teaching model for importance sampling bias correction",
        ],
        references: [
            "Schaul et al., Prioritized Experience Replay, 2015",
            "Sutton and Barto, Reinforcement Learning: An Introduction, Chapter 11",
        ],
        workedExample:
            "With priorities (4, 1, 3, 0.5, 2) and alpha 0.6, the highest-priority item is sampled most often. If item 0 has probability 0.32 and beta 0.4, its raw weight is (0.2 / 0.32)^0.4, which is below one; after replay its priority is replaced by the new TD error, changing the next sampling distribution.",
    },
    id: "prioritized-experience-replay",
    name: "Prioritized Experience Replay",
    category: "ml-ai",
    complexity: { time: "O(n + batch)", space: "O(n + batch)" },
    defaultInput: { priorities: [4, 1, 3, 0.5, 2], alpha: 0.6, beta: 0.4, epsilon: 0.01, batch: [0, 2], newPriorities: [1.5, 2.5] },
    visualType: "array",
    run,
    pseudocode: [
        "store each transition with an initial priority",
        "compute sampling probabilities from priorities raised to alpha",
        "select a batch of transition indices",
        "for each sampled index compute importance weight from inverse probability raised to beta",
        "normalize the weights by the largest weight in the batch",
        "apply the weighted update and recompute the transition priority",
        "done: report the final priorities and probabilities",
    ],
};

export default module;
