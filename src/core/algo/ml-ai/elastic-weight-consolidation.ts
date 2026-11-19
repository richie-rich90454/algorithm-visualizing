/**
 * elastic-weight-consolidation.ts - Elastic Weight Consolidation (EWC)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * EWC protects parameters that were important to an earlier task. It records
 * an optimal parameter vector from the old task and a diagonal Fisher
 * information matrix estimating how sensitive that task's loss was to each
 * parameter. While learning a new task it adds a quadratic penalty that pulls
 * important parameters back toward their old values.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n parameters
 *   Space: O(n) for the penalty vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per parameter showing the squared distance, Fisher weight, and
 *     finally the consolidation penalty contributed by that parameter.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    params?: number[];
    optimum?: number[];
    fisher?: number[];
    lambda?: number;
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: labels?.[i] ?? v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value: v },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const params = (task.params ?? [1.5, 2.2, 2.7]).slice();
    const optimum = (task.optimum ?? [1, 2, 3]).slice();
    const fisher = (task.fisher ?? [0.5, 1, 2]).slice();
    const lambda = typeof task.lambda === "number" ? task.lambda : 100;
    const n = Math.max(params.length, optimum.length, fisher.length);
    const at = (a: number[], i: number): number => a[i] ?? 0;

    const squared: number[] = [];
    const penalties: number[] = [];
    let total = 0;
    for (let i = 0; i < n; i += 1) {
        const diff = at(params, i) - at(optimum, i);
        const sq = diff * diff;
        const penalty = 0.5 * lambda * at(fisher, i) * sq;
        squared.push(sq);
        penalties.push(penalty);
        total += penalty;
    }
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(params, state("idle")),
        edges: [],
        description: `EWC: ${n} parameters with a saved optimum, a Fisher diagonal, and lambda ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, lambda, fisher },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(squared, state("comparing"), squared.map((v) => v.toFixed(3))),
        edges: [],
        description: "Square the distance of each parameter from the old-task optimum.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, lambda, squared },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(penalties, state("active"), penalties.map((v) => v.toFixed(3))),
        edges: [],
        description: "Weight each squared distance by its Fisher value and scale by one half times lambda.",
        codeLineNumber: 3,
        layout: "array",
        meta: { n, lambda, penalties, totalPenalty: total },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(penalties, state("sorted"), penalties.map((v) => v.toFixed(3))),
        edges: [],
        description: `Consolidation loss ${total.toFixed(4)} is added to the new-task loss so important weights barely move.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, lambda, penalties, totalPenalty: total, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Not all weights matter equally to a task you have already learned. EWC measures how important each weight was using the Fisher information, then penalizes moving the important ones far from their old values. The new task can still change weights that the old task barely used.",
        invariants: [
            "The saved optimum and Fisher diagonal are frozen after the old task finishes.",
            "Every parameter contributes a nonnegative quadratic penalty.",
            "A parameter with zero Fisher information can move without any penalty.",
        ],
        correctness:
            "The penalty is a quadratic approximation of the increase in the old task's loss: a second-order Taylor expansion around the optimum has zero linear term because the gradient vanishes there, leaving one half times the Fisher curvature times the squared displacement. Summing that expansion over parameters therefore approximates exactly how much old-task knowledge would be lost by moving to the new parameters.",
        complexityRationale:
            "Computing a displacement, a square, and a weighted penalty for each of the n parameters is constant work per parameter, so the pass is O(n). Storing the squared distances and penalties uses O(n) additional space.",
        uses: [
            "Continual learning in vision classifiers that see tasks in sequence",
            "Rehearsal-free fine-tuning of language models on new domains",
            "Robotics policies that must retain older skills while acquiring new ones",
        ],
        references: [
            "Kirkpatrick et al., Overcoming Catastrophic Forgetting in Neural Networks, PNAS 2017",
            "Fisher, On the Mathematical Foundations of Theoretical Statistics, 1922",
        ],
        workedExample:
            "With optimum 1, fisher 2, lambda 100, and a current value of 1.3, the displacement is 0.3 and its square is 0.09. The penalty is one half times 100 times 2 times 0.09, which equals 9. A weight with fisher 0 contributes nothing no matter how far it moves.",
    },
    id: "elastic-weight-consolidation",
    name: "Elastic Weight Consolidation",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { params: [1.5, 2.2, 2.7], optimum: [1, 2, 3], fisher: [0.5, 1, 2], lambda: 100 },
    visualType: "array",
    run,
    pseudocode: [
        "read current parameters, saved optimum, Fisher diagonal, and lambda",
        "for each parameter compute the squared distance from the saved optimum",
        "look up the Fisher importance for that parameter",
        "multiply by one half times lambda to get the quadratic penalty",
        "sum all parameter penalties into the consolidation loss",
        "add the consolidation loss to the new task loss during training",
        "done: report per-parameter penalties and the total penalty",
    ],
};

export default module;
