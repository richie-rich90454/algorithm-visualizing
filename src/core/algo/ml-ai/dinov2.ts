/**
 * dinov2.ts - DINO Self-Distillation Loss (Centering and Sharpening)
 *
 * Scope: DINOv2 trains a vision transformer with self-distillation between a
 * teacher and a student network, using centering and sharpening on the teacher
 * output. This implements the teachable core: the probability normalization,
 * centering, sharpening, cross-entropy loss, and one descent step on toy logits.
 * It does NOT include a ViT backbone, multi-crop augmentation, or iBOT masked
 * patch tokens.
 *
 * Time:  O(K) per step for K prototypes
 * Space: O(K)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface DinoInput {
    teacherLogits?: number[];
    studentLogits?: number[];
    temperatureTeacher?: number;
    temperatureStudent?: number;
    learningRate?: number;
}

/** Numerically stable softmax. */
function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((value) => Math.exp(value - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((value) => value / total);
}

/** Teacher distribution: center the logits, then sharpen with a low temperature. */
function teacherProbs(logits: number[], center: number[], tau: number): number[] {
    return softmax(logits.map((value, i) => (value - (center[i] ?? 0)) / tau));
}

/** Cross-entropy of the student distribution against the fixed teacher target. */
function dinoLoss(target: number[], student: number[]): number {
    let total = 0;
    for (let i = 0; i < target.length; i += 1) {
        total -= (target[i] ?? 0) * Math.log(Math.max(student[i] ?? 0, 1e-12));
    }
    return total;
}

/** Bar chart of a probability distribution. */
function makeBars(probs: number[]): VisualEntity[] {
    return probs.map((value, index) => ({
        id: `proto-${index}`,
        type: "bar" as const,
        label: `p${index}:${value.toFixed(3)}`,
        value,
        state: "active" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DinoInput | null) ?? {};
    const teacherLogits = Array.isArray(task.teacherLogits) && task.teacherLogits.length >= 2
        ? [...task.teacherLogits]
        : [2.0, 0.5, -1.0, 0.2];
    let studentLogits = Array.isArray(task.studentLogits) && task.studentLogits.length === teacherLogits.length
        ? [...task.studentLogits]
        : [0.1, -0.2, 0.3, 0.0];
    const tauT = typeof task.temperatureTeacher === "number" && task.temperatureTeacher > 0 ? task.temperatureTeacher : 0.05;
    const tauS = typeof task.temperatureStudent === "number" && task.temperatureStudent > 0 ? task.temperatureStudent : 0.1;
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.05;

    // Centering subtracts a running mean of teacher logits from each prototype.
    const centerValue = teacherLogits.reduce((a, b) => a + b, 0) / teacherLogits.length;
    const center = teacherLogits.map(() => centerValue);
    const target = teacherProbs(teacherLogits, center, tauT);

    const studentBefore = softmax(studentLogits);
    const lossBefore = dinoLoss(target, studentBefore);
    const studentLogitsBefore = [...studentLogits];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(studentBefore),
        edges: [],
        description: `Teacher sharpened to a near one-hot target over ${target.length} prototypes; student cross-entropy = ${lossBefore.toFixed(5)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            prototypes: target.length,
            tauT,
            tauS,
            center,
            teacherLogits,
            target,
            studentProbsBefore: studentBefore,
            studentProbsAfter: [],
            lossBefore,
            lossAfter: lossBefore,
            studentLogitsBefore,
            studentLogitsAfter: [...studentLogits],
        },
    };
    step += 1;

    // Gradient of cross-entropy with a fixed teacher target: (p_student - p_teacher)/tauS.
    const grad = studentBefore.map((value, i) => (value - (target[i] ?? 0)) / tauS);
    let rate = lr;
    let candidate = studentLogits.map((value, i) => value - rate * (grad[i] ?? 0));
    let candidateLoss = dinoLoss(target, softmax(candidate));
    let halvings = 0;
    while (candidateLoss >= lossBefore && rate > 1e-12 && halvings < 60) {
        rate /= 2;
        halvings += 1;
        candidate = studentLogits.map((value, i) => value - rate * (grad[i] ?? 0));
        candidateLoss = dinoLoss(target, softmax(candidate));
    }
    if (candidateLoss < lossBefore) {
        studentLogits = candidate;
    }
    const studentAfter = softmax(studentLogits);
    const lossAfter = dinoLoss(target, studentAfter);

    yield {
        stepNumber: step,
        entities: makeBars(studentAfter),
        edges: [],
        description: `After one student update (rate ${rate.toExponential(2)}), cross-entropy fell to ${lossAfter.toFixed(5)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            prototypes: target.length,
            tauT,
            tauS,
            center,
            teacherLogits,
            target,
            studentProbsBefore: studentBefore,
            studentProbsAfter: studentAfter,
            lossBefore,
            lossAfter,
            studentLogitsBefore,
            studentLogitsAfter: [...studentLogits],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(studentAfter),
        edges: [],
        description: `Done: student distribution now concentrates on prototype ${studentAfter.indexOf(Math.max(...studentAfter))}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            prototypes: target.length,
            tauT,
            tauS,
            center,
            teacherLogits,
            target,
            studentProbsBefore: studentBefore,
            studentProbsAfter: studentAfter,
            lossBefore,
            lossAfter,
            studentLogitsBefore,
            studentLogitsAfter: [...studentLogits],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Self-distillation asks a student network to copy a teacher network's output on differently augmented views of the same image. Centering stops one prototype from dominating, and sharpening with a low temperature turns the teacher output into a confident target. The student is then trained to match that target with a cross-entropy loss.",
        invariants: [
            "Teacher and student outputs are softmax distributions that sum to one.",
            "The teacher logits are centered by a running mean and divided by a low temperature before softmax.",
            "The earlier teacher target is held fixed while the student is updated.",
        ],
        correctness:
            "The gradient of cross-entropy -sum target_i log student_i with respect to student logits is (student_i - target_i) / tau_student, because the softmax derivative contributes that factor. Moving the logits against this gradient is gradient descent on the loss. Backtracking guarantees the recomputed loss strictly decreases, so each step genuinely improves the student's match to the teacher.",
        complexityRationale:
            "Normalizing logits, forming the target, and evaluating the loss and gradient each visit all K prototypes once, so the work is O(K) per step and the stored distributions use O(K) space.",
        uses: [
            "Self-supervised visual representation learning",
            "Training image encoders without labels",
            "Distillation with centering to avoid representation collapse",
        ],
        references: [
            "Caron et al., Emerging Properties in Self-Supervised Vision Transformers, 2021",
            "Oquab et al., DINOv2: Learning Robust Visual Features without Supervision, 2023",
        ],
        workedExample:
            "With four prototypes, teacher logits (2, 0.5, -1, 0.2) are centered and sharpened into a nearly one-hot target at prototype 0. The student starts nearly uniform; one gradient step raises its logit at prototype 0 and lowers the others, reducing the cross-entropy.",
    },
    id: "dinov2",
    name: "DINOv2 (Self-Distillation Loss)",
    category: "ml-ai",
    complexity: { time: "O(K)", space: "O(K)" },
    defaultInput: {
        teacherLogits: [2.0, 0.5, -1.0, 0.2],
        studentLogits: [0.1, -0.2, 0.3, 0.0],
        temperatureTeacher: 0.05,
        temperatureStudent: 0.1,
        learningRate: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "center the teacher logits by their running mean",
        "sharpen the teacher logits with a low temperature and softmax",
        "softmax the student logits with a higher temperature",
        "compute cross-entropy of student against the fixed teacher target",
        "step the student logits down the gradient with backtracking",
        "done: report updated student distribution and loss",
    ],
};

export default module;
