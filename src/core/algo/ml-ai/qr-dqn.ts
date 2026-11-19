/**
 * qr-dqn.ts - Quantile Regression DQN Loss
 *
 * QR-DQN replaces a scalar value estimate with a set of quantile predictions.
 * The Bellman target supplies a distribution of sampled returns, and a quantile
 * Huber loss pulls each predicted quantile toward every sampled return with a
 * weight set by its quantile level.
 *
 * Time:  O(N^2) for N quantile atoms
 * Space: O(N) for the target levels and loss vector
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QrInput {
    reward: number;
    gamma: number;
    done: boolean;
    nextQuantiles: number[];
    currentQuantiles: number[];
    kappa: number;
}

/** Quantile midlevels (2i+1)/(2N) used by QR-DQN. */
export function quantileLevels(n: number): number[] {
    return Array.from({ length: n }, (_unused, i) => (2 * i + 1) / (2 * n));
}

/** Asymmetric Huber loss at quantile level tau. */
export function quantileHuber(tau: number, residual: number, kappa: number): number {
    const magnitude = Math.abs(residual);
    const huber = magnitude < kappa
        ? (0.5 * residual * residual) / kappa
        : magnitude - 0.5 * kappa;
    return Math.abs(tau - (residual < 0 ? 1 : 0)) * huber;
}

function makeBars(values: number[], active: number, labelPrefix: string): VisualEntity[] {
    return values.map((value, i) => {
        const state: EntityState = i === active ? "comparing" : (value < 0 ? "active" : "sorted");
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `${labelPrefix}${i}: ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, level: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<QrInput> | null) ?? {};
    const current: number[] = Array.isArray(task.currentQuantiles) && task.currentQuantiles.length > 0
        ? task.currentQuantiles
        : [0.4, 0.9, 1.5, 2.2, 3.1, 4.5, 6.0, 8.0];
    const N = current.length;
    const next: number[] = Array.isArray(task.nextQuantiles) && task.nextQuantiles.length === N
        ? task.nextQuantiles
        : [0.5, 1.0, 1.6, 2.4, 3.3, 4.7, 6.2, 8.2];
    const reward = typeof task.reward === "number" ? task.reward : 2;
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.9;
    const done = Boolean(task.done);
    const kappa = Math.max(1e-6, task.kappa ?? 1);
    const tau = quantileLevels(N);
    const targets = next.map((q) => reward + (done ? 0 : gamma * q));
    const perQuantile = current.map((pred, i) =>
        targets.reduce((sum, target) => sum + quantileHuber(tau[i]!, target - pred, kappa), 0) / N,
    );
    const totalLoss = perQuantile.reduce((a, b) => a + b, 0) / N;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(current, -1, "q"),
        edges: [],
        description: `QR-DQN with ${N} quantile atoms predicts a distribution of returns, not a single value.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { N, rows: 1, cols: N, tau, targets, loss: totalLoss, kappa, perQuantile },
    };
    step += 1;

    for (let i = 0; i < N; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(perQuantile, i, "loss"),
            edges: [],
            description: `Quantile ${i} at level ${tau[i]!.toFixed(3)} contributes ${perQuantile[i]!.toFixed(4)} to the loss.`,
            codeLineNumber: i === N - 1 ? 5 : 4,
            layout: "array",
            meta: { N, rows: 1, cols: N, tau, targets, loss: totalLoss, kappa, perQuantile, active: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(perQuantile, -1, "loss"),
        edges: [],
        description: `Done: mean quantile Huber loss across all atom pairs is ${totalLoss.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { N, rows: 1, cols: N, tau, targets, loss: totalLoss, kappa, perQuantile, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two states can have the same average return but very different risk. QR-DQN predicts several quantiles of the return distribution instead of one mean. Each quantile has a fixed probability level, and the quantile Huber loss nudges it toward sampled Bellman targets, weighting overestimation and underestimation differently according to that level.",
        invariants: [
            "The quantile levels are the midpoints of N equal probability bins and lie strictly between zero and one.",
            "A Bellman target is the immediate reward plus the discounted next quantile, or just the reward at a terminal state.",
            "The quantile Huber loss is nonnegative for every predicted and target pair.",
        ],
        correctness:
            "For a level tau, the quantile regression check loss is weighted by tau when the residual is nonnegative and by one minus tau otherwise; combining this with the Huber ramp gives the quantile Huber function used in each term. The QR-DQN objective averages that term over all pairs of target atoms and predicted atoms, and the gradient with respect to a prediction is the average of the corresponding subgradients, which the Bellman quantile theorem shows is unbiased for the target quantile function. The test recomputes the full double sum independently, checks the level spacing, and confirms that perfect predictions have zero loss.",
        complexityRationale:
            "There are N predicted quantiles and N target atoms, and every pair contributes one loss term, so the objective costs O(N squared) time. The level vector, target vector, and per-quantile losses use O(N) space.",
        uses: [
            "Risk-sensitive reinforcement learning with distributional value functions",
            "Atari benchmark agents that need more than mean returns",
            "Downstream uncertainty estimates for planning and exploration",
        ],
        references: [
            "Dabney et al., Distributional Reinforcement Learning with Quantile Regression, AAAI, 2018",
            "Dabney et al., Implicit Quantile Networks, ICML, 2018",
        ],
        workedExample:
            "With eight atoms targeting returns near 3.8 through 9.4 and predictions 0.4 through 8, the lowest quantile sits well below its targets and receives a strong upward pull weighted by its small level. The highest quantile sits near the top target and receives a smaller correction. Averaging all atom pairs gives the scalar training loss reported in the final frame.",
    },
    id: "qr-dqn",
    name: "QR-DQN (Quantile Regression DQN)",
    category: "ml-ai",
    complexity: { time: "O(N^2)", space: "O(N)" },
    defaultInput: {
        reward: 2,
        gamma: 0.9,
        done: false,
        nextQuantiles: [0.5, 1.0, 1.6, 2.4, 3.3, 4.7, 6.2, 8.2],
        currentQuantiles: [0.4, 0.9, 1.5, 2.2, 3.1, 4.5, 6.0, 8.0],
        kappa: 1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set the N quantile levels to the midpoints of equal probability bins",
        "form Bellman targets from the reward and discounted next quantiles",
        "for each predicted quantile compare it with every target atom",
        "compute the Huber magnitude of the residual with the kappa threshold",
        "weight the magnitude by the level for positive residuals and its complement otherwise",
        "average all pairwise losses to obtain the quantile regression loss",
        "done: report the loss and the per-quantile contributions",
    ],
};

export default module;
