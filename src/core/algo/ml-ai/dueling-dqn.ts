/**
 * dueling-dqn.ts - Dueling Network Architecture for Q-Learning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A dueling network splits the Q-function into two streams: one estimates the
 * value of the state, the other estimates the advantage of each action. The
 * streams are combined with a centered advantage so that the value stream
 * learns the state value while the advantage stream learns only the relative
 * ranking of actions. The mean of the reconstructed Q-values equals the state
 * value, which removes an identifiability ambiguity in the raw streams.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(a) for a actions after the two network streams are computed
 *   Space: O(a) for the action advantages and combined Q-values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows show the state value, raw advantages, centered advantages, and Q.
 *   - The row currently being combined is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    value?: number;
    advantages?: number[];
}

function makeCells(rows: number[][], states: Map<number, EntityState>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r] ?? [];
        for (let c = 0; c < row.length; c += 1) {
            const value = row[c] ?? 0;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: states.get(r) ?? "idle",
                x: c,
                y: r,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, action: c, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const value = typeof task.value === "number" ? task.value : 5;
    const advantages = (task.advantages ?? [1, -2, 3, 0.5, -0.5]).slice();
    const n = advantages.length;
    const meanAdvantage = n > 0 ? advantages.reduce((a, v) => a + v, 0) / n : 0;
    const centered = advantages.map((a) => a - meanAdvantage);
    const qValues = centered.map((a) => value + a);
    const meanQ = n > 0 ? qValues.reduce((a, v) => a + v, 0) / n : 0;

    const valueRow = new Array<number>(n).fill(value);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells([valueRow, advantages, centered, qValues], new Map()),
        edges: [],
        description: `Combine a state value stream with ${n} action advantage estimates.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 4, cols: n, value, actions: n, meanAdvantage: Number(meanAdvantage.toFixed(6)) },
    };
    step += 1;

    const afterMean = new Map<number, EntityState>([[1, "comparing"]]);
    yield {
        stepNumber: step,
        entities: makeCells([valueRow, advantages, centered, qValues], afterMean),
        edges: [],
        description: `Compute the mean advantage ${meanAdvantage.toFixed(3)} across all actions.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 4, cols: n, meanAdvantage: Number(meanAdvantage.toFixed(6)), value },
    };
    step += 1;

    const afterCenter = new Map<number, EntityState>([[1, "sorted"], [2, "active"]]);
    yield {
        stepNumber: step,
        entities: makeCells([valueRow, advantages, centered, qValues], afterCenter),
        edges: [],
        description: `Subtract the mean so the centered advantages sum to zero.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 4, cols: n, centered, meanCentered: Number(centered.reduce((a, v) => a + v, 0).toFixed(6)) },
    };
    step += 1;

    const afterCombine = new Map<number, EntityState>([[1, "sorted"], [2, "sorted"], [3, "active"]]);
    yield {
        stepNumber: step,
        entities: makeCells([valueRow, advantages, centered, qValues], afterCombine),
        edges: [],
        description: `Add the state value to each centered advantage to form the action Q-values.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: 4, cols: n, qValues, meanQ: Number(meanQ.toFixed(6)) },
    };
    step += 1;

    const done = new Map<number, EntityState>([[0, "sorted"], [1, "sorted"], [2, "sorted"], [3, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeCells([valueRow, advantages, centered, qValues], done),
        edges: [],
        description: `Done: Q-values are ${qValues.map((q) => q.toFixed(2)).join(", ")}; their mean equals the state value ${value}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 4, cols: n, value, meanQ: Number(meanQ.toFixed(6)), qValues, actions: n },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In many states every action is roughly equally good, so learning a full Q-value per action wastes effort. A dueling network learns how good the state is and, separately, how much better each action is than the average. Subtracting the average advantage before adding the value makes the two streams identifiable and keeps the learned value meaningful.",
        invariants: [
            "The centered advantages sum to zero.",
            "Each Q-value is the state value plus that action's centered advantage.",
            "The mean of the reconstructed Q-values equals the state value.",
        ],
        correctness:
            "Let A be the raw advantages with mean m. Centering gives A_i - m, whose sum is sum(A_i) - n*m = 0 by definition of m. Then Q_i = V + (A_i - m), so the mean Q is V plus the mean of the centered advantages, which is V. Thus the value stream is forced to represent the true state value and the advantage stream only the relative action ordering.",
        complexityRationale:
            "After the shared network produces V and the a advantages, centering needs one pass for the mean and one pass to subtract it and form Q, so the combination is O(a) time and O(a) extra space.",
        uses: [
            "Deep Q-network agents with many similar actions",
            "Atari game-playing agents",
            "Robotic control with dense action spaces",
        ],
        references: [
            "Wang et al., Dueling Network Architectures for Deep Reinforcement Learning, ICML 2016",
            "Sutton & Barto, Reinforcement Learning: An Introduction, Chapter 11",
        ],
        workedExample:
            "With state value 5 and advantages [1, -2, 3, 0.5, -0.5], the mean advantage is 0.4. Centering gives [0.6, -2.4, 2.6, 0.1, -0.9], which sums to zero. Adding 5 gives Q-values [5.6, 2.6, 7.6, 5.1, 4.1], whose average is exactly 5.",
    },
    id: "dueling-dqn",
    name: "Dueling DQN",
    category: "ml-ai",
    complexity: { time: "O(a)", space: "O(a)" },
    defaultInput: { value: 5, advantages: [1, -2, 3, 0.5, -0.5] },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the state value V from the value stream",
        "compute raw advantages A_i from the advantage stream",
        "compute the mean advantage over all actions",
        "center each advantage as A_i minus the mean",
        "set Q_i to V plus the centered advantage",
        "done: return Q-values whose mean is V",
    ],
};

export default module;
