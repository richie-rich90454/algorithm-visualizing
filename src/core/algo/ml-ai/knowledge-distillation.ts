/**
 * knowledge-distillation.ts - Knowledge Distillation with Temperature (teachable core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Knowledge distillation trains a small student to imitate a large teacher.
 * The teacher's logits are softened with a temperature so the student also
 * learns the relative probabilities of the wrong classes. The loss blends a
 * temperature-weighted Kullback-Leibler term against the teacher with the
 * usual cross-entropy against the true label. One gradient step on the student
 * logits demonstrates how the two signals combine.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(c) for c classes
 *   Space: O(c) for the probability vectors and gradient
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the teacher's soft targets, the student's soft probabilities,
 *     the combined gradient, and the distribution after one update.
 *   - Metadata reports both loss components and the blended total.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DistillInput {
    teacherLogits?: number[];
    studentLogits?: number[];
    temperature?: number;
    alpha?: number;
    label?: number;
    lr?: number;
}

function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

function klDivergence(p: number[], q: number[]): number {
    return p.reduce((sum, value, i) => {
        const qi = Math.max(1e-12, q[i] ?? 0);
        return sum + (value > 0 ? value * Math.log(value / qi) : 0);
    }, 0);
}

/** Teacher and student distributions plus the blended distillation loss. */
export function distillationForward(
    teacherLogits: number[],
    studentLogits: number[],
    T: number,
    alpha: number,
    label: number,
) {
    const teacherSoft = softmax(teacherLogits.map((value) => value / T));
    const studentSoft = softmax(studentLogits.map((value) => value / T));
    const studentHard = softmax(studentLogits);
    const softLoss = T * T * klDivergence(teacherSoft, studentSoft);
    const hardLoss = -Math.log(Math.max(1e-12, studentHard[label] ?? 0));
    const loss = alpha * softLoss + (1 - alpha) * hardLoss;
    return { teacherSoft, studentSoft, studentHard, softLoss, hardLoss, loss };
}

/** One gradient step on the student logits with the teacher fixed. */
export function distillationStep(
    teacherLogits: number[],
    studentLogits: number[],
    T: number,
    alpha: number,
    label: number,
    lr: number,
) {
    const f = distillationForward(teacherLogits, studentLogits, T, alpha, label);
    const grad = studentLogits.map((_value, j) =>
        alpha * T * ((f.studentSoft[j] ?? 0) - (f.teacherSoft[j] ?? 0))
        + (1 - alpha) * ((f.studentHard[j] ?? 0) - (j === label ? 1 : 0)),
    );
    const after = studentLogits.map((value, j) => value - lr * (grad[j] ?? 0));
    const lossAfter = distillationForward(teacherLogits, after, T, alpha, label).loss;
    return { ...f, grad, after, lossAfter };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cls-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DistillInput | null) ?? {};
    const teacherLogits: number[] = Array.isArray(task.teacherLogits) ? task.teacherLogits.slice() : [2, 1, 0.1];
    const studentLogits: number[] = Array.isArray(task.studentLogits) ? task.studentLogits.slice() : [0.5, 0.8, -0.2];
    const c = Math.max(teacherLogits.length, studentLogits.length);
    const T = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 2;
    const alpha = typeof task.alpha === "number" && task.alpha >= 0 && task.alpha <= 1 ? task.alpha : 0.7;
    const label = typeof task.label === "number" ? Math.max(0, Math.min(c - 1, Math.trunc(task.label))) : 0;
    const lr = typeof task.lr === "number" && task.lr > 0 ? task.lr : 0.1;
    const r = distillationStep(teacherLogits, studentLogits, T, alpha, label, lr);
    const afterHard = softmax(r.after);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(r.teacherSoft, "idle"),
        edges: [],
        description: `Teacher soft targets at temperature ${T} over ${c} classes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { teacherSoft: r.teacherSoft, T, alpha, label, phase: "teacher" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.studentSoft, "comparing"),
        edges: [],
        description: `Student soft probabilities; KL loss ${r.softLoss.toFixed(4)} against the teacher.`,
        codeLineNumber: 1,
        layout: "array",
        meta: {
            teacherSoft: r.teacherSoft,
            studentSoft: r.studentSoft,
            softLoss: Number(r.softLoss.toFixed(8)),
            T,
            alpha,
            label,
            phase: "student",
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.grad, "active"),
        edges: [],
        description: `Combined gradient: alpha times temperature times the soft gap, plus the hard-label term.`,
        codeLineNumber: 3,
        layout: "array",
        meta: {
            grad: r.grad,
            softLoss: Number(r.softLoss.toFixed(8)),
            hardLoss: Number(r.hardLoss.toFixed(8)),
            loss: Number(r.loss.toFixed(8)),
            T,
            alpha,
            label,
            phase: "gradient",
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(afterHard, "sorted"),
        edges: [],
        description: `Loss moved from ${r.loss.toFixed(4)} to ${r.lossAfter.toFixed(4)} after one student update.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            after: r.after,
            teacherSoft: r.teacherSoft,
            loss: Number(r.loss.toFixed(8)),
            lossAfter: Number(r.lossAfter.toFixed(8)),
            T,
            alpha,
            label,
            phase: "done",
            converged: r.lossAfter <= r.loss,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A small student can learn more than just the correct answer from a large teacher. By softening the teacher's logits with a temperature, the student sees how likely the wrong classes are, which reveals the teacher's confidence structure. The training loss mixes this soft signal with the ordinary hard-label loss, so the student matches both the teacher's shape and the true answer.",
        invariants: [
            "The teacher distribution is computed once and never updated.",
            "Both softened distributions are valid and sum to one.",
            "The gradient combines the temperature-scaled soft gap with the hard-label gap.",
        ],
        correctness:
            "Softening divides logits by the temperature before softmax, so raising the temperature flattens the distribution. The gradient of the squared-temperature KL term with respect to student logits is T times the student minus teacher soft probabilities, and the hard cross-entropy gradient is the student hard probability minus the one-hot label. Their alpha-weighted sum is exactly the derivative of the blended loss, verified by central finite differences, so one descent step cannot increase the loss for a small enough rate.",
        complexityRationale:
            "Softmax, KL, cross-entropy, and the gradient each scan the c classes a constant number of times, giving O(c) time. Storing the probability and gradient vectors takes O(c) space.",
        uses: [
            "Compressing large language models into smaller ones",
            "Transferring dark knowledge between teacher and student networks",
            "Improving accuracy of compact models on limited data",
        ],
        references: [
            "Hinton, Vinyals, and Dean, Distilling the Knowledge in a Neural Network, 2015",
            "Ba and Caruana, Do Deep Nets Really Need to Be Deep?, 2014",
        ],
        workedExample:
            "With teacher logits 2, 1, 0.1 and temperature 2, the teacher soft target puts roughly half the mass on class zero. A student that instead favors class one receives a gradient pushing its first logit up and its second down, nudged also by the true label. Repeating the step lowers the blended loss.",
    },
    id: "knowledge-distillation",
    name: "Knowledge Distillation",
    category: "ml-ai",
    complexity: { time: "O(c)", space: "O(c)" },
    defaultInput: {
        teacherLogits: [2, 1, 0.1],
        studentLogits: [0.5, 0.8, -0.2],
        temperature: 2,
        alpha: 0.7,
        label: 0,
        lr: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "divide teacher and student logits by the temperature",
        "apply softmax to get both soft distributions",
        "soften the student logits without temperature for the hard loss",
        "compute temperature-weighted KL divergence to the teacher",
        "compute cross-entropy to the true label",
        "blend the two losses and take a student gradient step",
        "done: report the blended loss and updated student",
    ],
};

export default module;
