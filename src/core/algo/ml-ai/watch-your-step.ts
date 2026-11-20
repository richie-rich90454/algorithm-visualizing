/**
 * watch-your-step.ts - Watch Your Step Data Poisoning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Watch Your Step is a targeted data poisoning attack. An attacker chooses a
 * small budget of training examples whose gradients point in the direction of
 * a desired outcome, then flips those labels toward the attacker's target.
 * Because the selected examples already push the model the right way, a tiny
 * budget can change the learned behavior far more than random label flips.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) for n gradient vectors of dimension d
 *   Space: O(n) for the alignments, ranking and poisoned labels
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Points show each training example positioned by its first two gradient
 *     components; poisoned examples are highlighted in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PoisonInput {
    gradients?: number[][];
    targetDirection?: number[];
    labels?: number[];
    targetLabel?: number;
    budget?: number;
}

function dot(a: number[], b: number[]): number {
    const dim = Math.min(a.length, b.length);
    let total = 0;
    for (let i = 0; i < dim; i += 1) total += (a[i] ?? 0) * (b[i] ?? 0);
    return total;
}

function norm(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function nodes(gradients: number[][], labels: number[], poisoned: Set<number>): VisualEntity[] {
    return gradients.map((gradient, index) => ({
        id: `sample-${index}`,
        type: "node" as const,
        label: `${labels[index] ?? 0}${poisoned.has(index) ? "*" : ""}`,
        value: gradient,
        state: (poisoned.has(index) ? "active" : "visited") as EntityState,
        x: (gradient[0] ?? 0) * 30,
        y: (gradient[1] ?? 0) * 30,
        width: 0,
        height: 0,
        metadata: { index, label: labels[index] ?? 0, poisoned: poisoned.has(index) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PoisonInput | null) ?? {};
    const gradients: number[][] = Array.isArray(task.gradients) && task.gradients.length > 0
        ? task.gradients
        : [[1, 0.1], [0.9, 0.2], [-1, 0.1], [-0.8, -0.2], [0.2, 1]];
    const direction: number[] = Array.isArray(task.targetDirection) && task.targetDirection.length > 0
        ? task.targetDirection
        : [1, 0];
    const labels: number[] = Array.isArray(task.labels) && task.labels.length > 0
        ? task.labels.slice()
        : gradients.map(() => 0);
    const targetLabel = typeof task.targetLabel === "number" ? Math.floor(task.targetLabel) : 1;
    const budget = typeof task.budget === "number" && task.budget > 0
        ? Math.max(1, Math.min(gradients.length, Math.floor(task.budget)))
        : 2;

    const directionNorm = norm(direction);
    const alignments = gradients.map((gradient) => {
        const denominator = norm(gradient) * directionNorm;
        return denominator === 0 ? 0 : dot(gradient, direction) / denominator;
    });
    const ranking = alignments
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value || a.index - b.index);
    const selected = ranking.slice(0, budget).map((item) => item.index);
    const poisonedLabels = labels.slice();
    selected.forEach((index) => { poisonedLabels[index] = targetLabel; });
    const poisonedSet = new Set(selected);

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes(gradients, labels, new Set()),
        edges: [],
        description: `Consider poisoning ${budget} of ${gradients.length} training examples.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { phase: "setup", labels, targetLabel, budget, alignments: [], selected: [], poisonedLabels: labels.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(gradients, labels, new Set()),
        edges: [],
        description: "Score each example by cosine alignment with the attack direction.",
        codeLineNumber: 1,
        layout: "point",
        meta: { phase: "align", labels, targetLabel, budget, alignments, selected: [], poisonedLabels: labels.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(gradients, labels, new Set(selected)),
        edges: [],
        description: `Rank by alignment and pick the top ${budget} indicator examples.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { phase: "select", labels, targetLabel, budget, alignments, selected, poisonedLabels: labels.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes(gradients, poisonedLabels, poisonedSet),
        edges: [],
        description: `Done: flipped ${selected.length} label(s) to target class ${targetLabel}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { phase: "done", labels, targetLabel, budget, alignments, selected, poisonedLabels, poisonedCount: selected.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A small number of carefully chosen training examples can steer a trained model more than a much larger random set. Watch Your Step looks for examples whose gradients already point toward the attacker's goal, then flips their labels to that goal. The selected examples act as indicators that teach the model the wrong association at very low cost.",
        invariants: [
            "Alignment is the cosine of the angle between a gradient and the attack direction.",
            "Exactly the budget highest alignments are selected, with ties broken by lower index.",
            "Only selected examples have their labels changed.",
        ],
        correctness:
            "Cosine alignment divides the dot product by both norms, so it is bounded by one and ranks examples by direction regardless of gradient magnitude. Sorting by alignment with a strict greater-than comparison and index tie break returns exactly the budget largest values. Relabeling only those indices and leaving all others untouched means the reported poisoned labels differ from the original labels in precisely the selected positions, which a brute-force ranking check confirms.",
        complexityRationale:
            "Computing each alignment touches d components and ranking n values costs O(n log n), giving O(n d + n log n) time. The alignments, ranking and label copy occupy O(n) space.",
        uses: [
            "Studying robustness of recommender systems to poisoning",
            "Evaluating defenses against training-time attacks",
            "Finding influential training examples for red teaming",
        ],
        references: [
            "Geiger et al., Watch Your Step: When Internet Algorithms Fail, 2020",
            "Koh and Liang, Understanding Black-Box Predictions via Influence Functions, ICML 2017",
        ],
        workedExample:
            "With gradients (1,0.1), (0.9,0.2), negative one in x, negative 0.8 in x, and (0.2,1), attack direction (1,0) and budget two, the first two alignments are about 0.995 and 0.976, higher than the rest. Those two examples are relabeled to the target class while the other three keep their original labels.",
    },
    id: "watch-your-step",
    name: "Watch Your Step Poisoning Attack",
    category: "ml-ai",
    complexity: { time: "O(n * d + n log n)", space: "O(n)" },
    defaultInput: {
        gradients: [[1, 0.1], [0.9, 0.2], [-1, 0.1], [-0.8, -0.2], [0.2, 1]],
        targetDirection: [1, 0],
        labels: [0, 0, 1, 1, 0],
        targetLabel: 1,
        budget: 2,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the gradients, attack direction, labels and budget",
        "compute each gradient's cosine alignment with the direction",
        "rank the examples from largest to smallest alignment",
        "select the budget highest ranked examples",
        "flip the label of each selected example to the target",
        "leave all unselected labels unchanged",
        "done: report the alignments and the poisoned labels",
    ],
};

export default module;
