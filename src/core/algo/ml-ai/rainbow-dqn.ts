/**
 * rainbow-dqn.ts - Rainbow DQN: Double Q action selection and C51 categorical projection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rainbow combines several DQN improvements. Its distributional core, C51,
 * replaces a scalar Q value with a probability distribution over a fixed
 * support of returns. The Bellman target shifts and shrinks each atom, then
 * the resulting mass is projected back onto the support, splitting it between
 * the two nearest atoms. Rainbow also uses Double Q learning: the online
 * network picks the best next action while the target network supplies that
 * action's return distribution. Training minimizes cross-entropy between the
 * projected target and the online prediction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(A N) for A actions and N atoms
 *   Space: O(A N) for the per-action distributions and projections
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the target return distribution, its projection, and the
 *     online prediction over the atom support.
 *   - Meta exposes the selected action, every distribution, and the loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RainbowInput {
    atoms?: number[];
    reward?: number;
    gamma?: number;
    nextProbsByAction?: number[][];
    onlineNextProbsByAction?: number[][];
    predProbs?: number[];
    done?: boolean;
}

function bars(values: number[], state: EntityState, prefix: string): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function expectation(probs: number[], atoms: number[]): number {
    return probs.reduce((sum, p, j) => sum + p * (atoms[j] ?? 0), 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RainbowInput | null) ?? {};
    const atoms = (task.atoms ?? [-10, -5, 0, 5, 10]).slice();
    const N = atoms.length;
    const reward = typeof task.reward === "number" ? task.reward : 2;
    const gamma = typeof task.gamma === "number" ? Math.min(1, Math.max(0, task.gamma)) : 0.9;
    const done = task.done === true;
    const nextProbsByAction: number[][] = Array.isArray(task.nextProbsByAction) && task.nextProbsByAction.length > 0
        ? task.nextProbsByAction.map((row) => [...row])
        : [
              [0.05, 0.1, 0.6, 0.2, 0.05],
              [0.2, 0.3, 0.3, 0.15, 0.05],
          ];
    const onlineNextProbsByAction: number[][] = Array.isArray(task.onlineNextProbsByAction) && task.onlineNextProbsByAction.length > 0
        ? task.onlineNextProbsByAction.map((row) => [...row])
        : nextProbsByAction.map((row) => [...row]);
    const predProbs = (task.predProbs ?? [0.1, 0.15, 0.4, 0.25, 0.1]).slice(0, N);
    const A = nextProbsByAction.length;

    const qOnline = onlineNextProbsByAction.map((row) => expectation(row, atoms));
    let selectedAction = 0;
    for (let a = 1; a < A; a += 1) {
        if ((qOnline[a] ?? -Infinity) > (qOnline[selectedAction] ?? -Infinity)) {
            selectedAction = a;
        }
    }
    const targetDist = done
        ? atoms.map((_, j) => (j === 0 ? 1 : 0))
        : (nextProbsByAction[selectedAction] ?? atoms.map(() => 0)).slice(0, N);

    const zMin = atoms[0] ?? 0;
    const zMax = atoms[N - 1] ?? 0;
    const step = N > 1 ? (zMax - zMin) / (N - 1) : 1;
    const projected = Array(N).fill(0) as number[];
    for (let j = 0; j < N; j += 1) {
        const tz = done ? reward : reward + gamma * (atoms[j] ?? 0);
        const raw = step !== 0 ? (tz - zMin) / step : 0;
        const b = Math.min(N - 1, Math.max(0, raw));
        const lower = Math.floor(b);
        const upper = Math.ceil(b);
        const p = targetDist[j] ?? 0;
        if (lower === upper) {
            projected[lower] = (projected[lower] ?? 0) + p;
        } else {
            projected[lower] = (projected[lower] ?? 0) + p * (upper - b);
            projected[upper] = (projected[upper] ?? 0) + p * (b - lower);
        }
    }
    const loss = -projected.reduce((sum, p, j) => sum + p * Math.log((predProbs[j] ?? 0) + 1e-8), 0);
    const expectedQ = expectation(predProbs, atoms);

    const commonMeta = {
        N,
        A,
        atoms,
        reward,
        gamma,
        done,
        selectedAction,
        qOnline,
        targetDist,
        projected,
        predProbs,
        loss,
        expectedQ,
    };

    let stepNo = 0;
    yield {
        stepNumber: stepNo,
        entities: bars(targetDist, "idle", "target"),
        edges: [],
        description: `Rainbow: ${A} actions, ${N} return atoms; Double Q selects action ${selectedAction}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...commonMeta, t: -1 },
    };
    stepNo += 1;

    yield {
        stepNumber: stepNo,
        entities: bars(projected, "comparing", "proj"),
        edges: [],
        description: done
            ? `Terminal target collapses to reward ${reward} and is projected onto the support.`
            : `Bellman-shifted atoms projected back onto the support with mass splitting.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...commonMeta, t: 0 },
    };
    stepNo += 1;

    yield {
        stepNumber: stepNo,
        entities: bars(predProbs, "active", "pred"),
        edges: [],
        description: `Online prediction over the same support; expected Q value ${expectedQ.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...commonMeta, t: 1 },
    };
    stepNo += 1;

    yield {
        stepNumber: stepNo,
        entities: bars(projected, "sorted", "proj"),
        edges: [],
        description: `Done: cross-entropy between projected target and prediction is ${loss.toFixed(6)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...commonMeta, t: 2, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most Q-learning stores one number per action, an estimate of the total future reward. Rainbow's distributional view stores a whole histogram of possible returns instead. To compute a training target it shifts and shrinks every atom of that histogram, then splits the probability mass between the two nearest atoms because the shifted values rarely land exactly on the support. Double Q learning keeps the action choice and the value estimate from the same network from reinforcing each other's mistakes.",
        invariants: [
            "The selected action maximizes the expected return under the online network's distribution.",
            "The projected distribution is nonnegative and retains the total probability mass.",
            "Every shifted atom is clipped to the support before its mass is deposited.",
        ],
        correctness:
            "The C51 projection maps each shifted atom T z_j to the segment between its floor and ceiling atoms and assigns weights that interpolate linearly, so total probability is preserved and the projected mean matches the Bellman mean up to discretization. Cross-entropy against the online distribution is the distributional loss of the Rainbow paper. The test recomputes the Double Q argmax, the clipped mass splitting, and the cross-entropy independently and checks mass conservation and terminal collapse.",
        complexityRationale:
            "Computing each action's expectation is O(A N), and projecting N atoms deposits mass into at most two bins each for O(N) more work, so the dominant cost is O(A N). The per-action distributions and projection arrays use O(A N) space.",
        uses: [
            "Distributional reinforcement learning for Atari and control",
            "Risk-aware agents that use the full return distribution",
            "Sample-efficient learning with noisy networks and multi-step returns",
        ],
        references: [
            "Bellemare, Dabney, and Munos, A Distributional Perspective on Reinforcement Learning, ICML 2017",
            "Hessel et al., Rainbow: Combining Improvements in Deep Reinforcement Learning, AAAI 2018",
            "Van Hasselt, Guez, and Silver, Deep Reinforcement Learning with Double Q-learning, AAAI 2016",
        ],
        workedExample:
            "With atoms -10, -5, 0, 5, 10, reward 2, gamma 0.9, and selecting the second action, the atom 0 shifts to 2. The support spacing is 5, so 2 lies between atoms 0 and 5 at fraction 0.4; a probability mass of 0.3 on atom 0 deposits 0.18 at atom 0 and 0.12 at atom 5.",
    },
    id: "rainbow-dqn",
    name: "Rainbow DQN: Distributional C51 with Double Q Selection",
    category: "ml-ai",
    complexity: { time: "O(A N)", space: "O(A N)" },
    defaultInput: {
        atoms: [-10, -5, 0, 5, 10],
        reward: 2,
        gamma: 0.9,
        nextProbsByAction: [
            [0.05, 0.1, 0.6, 0.2, 0.05],
            [0.2, 0.3, 0.3, 0.15, 0.05],
        ],
        onlineNextProbsByAction: [
            [0.05, 0.1, 0.6, 0.2, 0.05],
            [0.2, 0.3, 0.3, 0.15, 0.05],
        ],
        predProbs: [0.1, 0.15, 0.4, 0.25, 0.1],
        done: false,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the atom support, reward, and per-action return distributions",
        "select the next action maximizing expected return under the online network",
        "take the target network's distribution for the selected action",
        "for each atom compute the Bellman-shifted target value",
        "clip to the support and split mass between the two nearest atoms",
        "compute cross-entropy of the projection with the online prediction",
        "done: report the projected distribution and distributional loss",
    ],
};

export default module;
