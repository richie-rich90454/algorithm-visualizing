/**
 * mirror-descent.ts - Entropic Mirror Descent on the Probability Simplex
 *
 * Mirror descent replaces the Euclidean projection of gradient descent with a
 * projection measured by a mirror map. With negative entropy as the mirror map,
 * the update becomes exponentiated gradient: multiply each coordinate by an
 * exponential of its gradient and renormalize. The iterates stay on the
 * probability simplex and are biased toward sparse solutions.
 *
 * The demo minimizes a linear loss c dot x. Starting from the uniform
 * distribution, T steps of size eta produce the distribution proportional to
 * exp(-T eta c), which is verified exactly by the companion test.
 *
 * Limits of the demo: the loss vector and step count are supplied explicitly;
 * the loss is constant, which makes the closed-form comparison exact.
 *
 * Time: O(T d) for T steps and d coordinates. Space: O(d).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(x: number[], active: number): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `x${index}=${value.toFixed(4)}`,
        value,
        state: index === active ? ("active" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { loss?: number[]; eta?: number; steps?: number; initial?: number[] } | null
    ) ?? {};
    const loss: number[] = task.loss ?? [1, 2, 0.5, 3];
    const eta = Math.max(0, Number(task.eta ?? 0.2));
    const steps = Math.max(0, Math.floor(Number(task.steps ?? 25)));
    const d = loss.length;
    if (d === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "An empty loss vector has no distribution over which to optimize.",
            codeLineNumber: 0,
            layout: "array",
            meta: { valid: false },
        };
        return;
    }

    let x: number[] = task.initial && task.initial.length === d
        ? task.initial.slice()
        : new Array<number>(d).fill(1 / d);
    const total = x.reduce((sum, v) => sum + v, 0);
    x = total > 0 ? x.map((v) => v / total) : new Array<number>(d).fill(1 / d);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(x, -1),
        edges: [],
        description: `Initialize a uniform distribution over ${d} coordinates with loss [${loss.join(", ")}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, loss, eta, iteration: 0, objective: loss.reduce((s, c, i) => s + c * (x[i] as number), 0) },
    };
    step += 1;

    for (let k = 0; k < steps; k += 1) {
        const weighted = x.map((value, i) => value * Math.exp(-eta * (loss[i] as number)));
        const sum = weighted.reduce((acc, v) => acc + v, 0);
        const next = weighted.map((v) => (sum > 0 ? v / sum : 1 / d));
        const objective = loss.reduce((s, c, i) => s + c * (next[i] as number), 0);
        let largest = 0;
        for (let i = 1; i < d; i += 1) {
            if ((next[i] as number) > (next[largest] as number)) {
                largest = i;
            }
        }
        x = next;
        yield {
            stepNumber: step,
            entities: makeBars(x, largest),
            edges: [],
            description: `Step ${k + 1}: objective ${objective.toFixed(6)}; largest mass on coordinate ${largest}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: {
                x: x.slice(),
                loss,
                eta,
                iteration: k + 1,
                objective,
                largestCoordinate: largest,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, -1),
        edges: [],
        description: `Finished ${steps} entropic mirror steps; final distribution [${x.map((v) => v.toFixed(5)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            x: x.slice(),
            loss,
            eta,
            steps,
            objective: loss.reduce((s, c, i) => s + c * (x[i] as number), 0),
            minimumLoss: Math.min(...loss),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Gradient descent measures distance with straight lines, which is unnatural when the variables are probabilities. Mirror descent first maps probabilities into a space where a multiplicative step is natural, takes that step, then maps back. The result is exponentiated gradient: every coordinate is scaled by a factor that depends on its own gradient and the whole vector is renormalized.",
        invariants: [
            "Every iterate is nonnegative and its coordinates sum to one.",
            "The update is multiplicative in the primal variables because the mirror map is negative entropy.",
            "A coordinate with a larger loss is multiplied by a smaller exponential factor.",
        ],
        correctness:
            "The negative-entropy mirror map on the simplex has a Bregman divergence that is the Kullback-Leibler divergence. The mirror-descent optimality condition then gives x next proportional to x times exp of minus the step size times the gradient, followed by normalization. For a constant linear loss the gradient never changes, so the closed-form solution after T steps is the softmax of minus T eta c; the iteration reproduces it exactly and drives the expected loss toward the smallest coordinate of c.",
        complexityRationale:
            "Each step forms d exponentials and one normalization scan, so T steps cost O(T d) time; storing the distribution and loss takes O(d) space.",
        uses: [
            "Online learning with expert advice and multiplicative weights",
            "Training models over probability distributions and simplex constraints",
            "Sparse optimization where entropic regularization favors low-support solutions",
        ],
        references: [
            "Nemirovski and Yudin, Problem Complexity and Method Efficiency in Optimization, 1983",
            "Shalev-Shwartz, Online Learning and Online Convex Optimization, Foundations and Trends 2012",
        ],
        workedExample:
            "With loss [1, 2] and step size 0.1, two steps from the uniform start multiply coordinate weights by exp(-0.2) and exp(-0.4) each round. After T steps the ratio of the two masses is exp(0.1 T), so the distribution concentrates on the first coordinate, the one with the smaller loss.",
    },
    id: "mirror-descent",
    name: "Mirror Descent (Entropic)",
    category: "numerical-optimization",
    complexity: { time: "O(T d)", space: "O(d)" },
    defaultInput: { loss: [1, 2, 0.5, 3], eta: 0.2, steps: 25 },
    visualType: "array",
    run,
    pseudocode: [
        "read loss vector, step size and number of steps",
        "initialize the distribution uniformly over all coordinates",
        "for each step",
        "multiply each mass by exp of minus step size times its loss",
        "normalize the masses so they sum to one",
        "record the expected loss and the heaviest coordinate",
        "after the final step report the distribution and minimum loss",
    ],
};

export default module;
