/**
 * wgan-gp.ts - Wasserstein GAN with a Gradient Penalty
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A WGAN trains a critic whose score approximates the Wasserstein distance
 * between real and generated data, but it needs the critic to be 1-Lipschitz.
 * WGAN-GP enforces this with a soft penalty on the gradient norm evaluated at
 * random interpolations between real and fake samples, instead of clipping the
 * weights. This toy uses a quadratic one-dimensional critic so the gradient
 * genuinely varies with the sample and every penalty term is checkable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n real and fake samples
 *   Space: O(n) for the interpolations and penalties
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show real scores, fake scores, interpolations, and penalties.
 *   - The final frame shows the generator's updated fake samples.
 *   - Meta exposes the gradient norm, penalty, Wasserstein estimate, and loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface WganGpInput {
    real?: number[];
    fake?: number[];
    eps?: number[];
    w?: number;
    b?: number;
    c?: number;
    lambda?: number;
    lr?: number;
}

function critic(x: number, w: number, b: number, c: number): number {
    return w * x + b + c * x * x;
}

function criticGrad(x: number, w: number, c: number): number {
    return w + 2 * c * x;
}

function bars(values: number[], state: EntityState, label: string): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${label}${index}=${value.toFixed(3)}`,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, series: label },
    }));
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WganGpInput | null) ?? {};
    const real = (task.real ?? [2, 3, 2.5, 3.2]).slice();
    const fake = (task.fake ?? [0, 1, -1, 0.5]).slice();
    const w = typeof task.w === "number" ? task.w : 0.5;
    const b = typeof task.b === "number" ? task.b : 0;
    const c = typeof task.c === "number" ? task.c : 0.1;
    const lambda = typeof task.lambda === "number" && task.lambda >= 0 ? task.lambda : 10;
    const lr = typeof task.lr === "number" ? task.lr : 0.1;
    const n = Math.min(real.length, fake.length);
    const eps: number[] = Array.from({ length: n }, (_, i) => {
        const raw = task.eps?.[i] ?? 0.2 + 0.6 * (i / Math.max(1, n - 1));
        return Math.min(1, Math.max(0, raw));
    });

    const realScores = real.slice(0, n).map((x) => critic(x, w, b, c));
    const fakeScores = fake.slice(0, n).map((x) => critic(x, w, b, c));
    const xHat: number[] = [];
    const gradHat: number[] = [];
    const gradNorm: number[] = [];
    const penalties: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const point = eps[i]! * (real[i] ?? 0) + (1 - eps[i]!) * (fake[i] ?? 0);
        const grad = criticGrad(point, w, c);
        xHat.push(point);
        gradHat.push(grad);
        gradNorm.push(Math.abs(grad));
        penalties.push((Math.abs(grad) - 1) ** 2);
    }
    const gradientPenalty = lambda * mean(penalties);
    const wasserstein = mean(fakeScores) - mean(realScores);
    const criticLoss = mean(realScores) - mean(fakeScores) + gradientPenalty;
    const gradFake = fake.slice(0, n).map((x) => criticGrad(x, w, c));
    const updatedFake = fake.slice(0, n).map((x, i) => x + lr * (gradFake[i] ?? 0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(realScores, "sorted", "real"),
        edges: [],
        description: `Critic f(x)=w x+b+c x^2 with w=${w}, c=${c}; scores ${n} real samples.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, w, b, c, lambda, lr, eps, xHat, gradHat, gradNorm, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake, gradFake, realScores, fakeScores },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(fakeScores, "comparing", "fake"),
        edges: [],
        description: `Scores ${n} fake samples; Wasserstein estimate is mean fake minus mean real.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { n, w, b, c, lambda, lr, eps, xHat, gradHat, gradNorm, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake, gradFake, realScores, fakeScores },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(xHat, "active", "hat"),
        edges: [],
        description: `Interpolate x-hat between real and fake at the given eps values; evaluate the critic gradient there.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { n, w, b, c, lambda, lr, eps, xHat, gradHat, gradNorm, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake, gradFake },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(gradNorm, "comparing", "grad"),
        edges: [],
        description: `Gradient norms at the interpolations; the penalty pushes each norm toward one.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, w, b, c, lambda, lr, eps, xHat, gradHat, gradNorm, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake, gradFake },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(penalties, "active", "pen"),
        edges: [],
        description: `Squared deviation from unit gradient norm; mean times lambda gives penalty ${gradientPenalty.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { n, w, b, c, lambda, lr, eps, xHat, gradHat, gradNorm, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake, gradFake },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(updatedFake, "sorted", "fake"),
        edges: [],
        description: `Done: Wasserstein ${wasserstein.toFixed(4)}, critic loss ${criticLoss.toFixed(4)}; generator moved fakes along the critic gradient.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, w, b, c, lambda, lr, eps, xHat, gradHat, gradNorm, penalties, gradientPenalty, wasserstein, criticLoss, updatedFake, gradFake, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A WGAN critic must not change its score too quickly as its input moves, a property called Lipschitz continuity. Rather than forcing this by clipping weights, WGAN-GP picks points halfway between real and fake data and penalizes the squared amount by which the critic's gradient norm differs from one. The generator then pushes fake samples in the direction that raises the critic score.",
        invariants: [
            "The critic is linear-plus-quadratic, so its gradient at x is w plus 2 c x.",
            "Each interpolation lies on the segment between a real and a fake sample.",
            "The gradient penalty is nonnegative and vanishes when every gradient norm equals one.",
        ],
        correctness:
            "The gradient penalty is lambda times the mean of (norm of gradient minus one) squared, which is exactly the soft 1-Lipschitz constraint of the paper. The Wasserstein estimate is the mean critic score on fakes minus the mean on reals. The generator step moves each fake by the learning rate times the analytic critic gradient, which is gradient ascent on the critic score; the test recomputes all of these from the reported inputs with an independent implementation.",
        complexityRationale:
            "Each of the n samples needs one interpolation, one quadratic critic evaluation, and one gradient, so the work is O(n) and the stored arrays are O(n). With a nonlinear critic the gradient is analytic rather than requiring backpropagation through a network.",
        uses: [
            "Stable GAN training without weight clipping",
            "Image generation with a Lipschitz-constrained critic",
            "Approximating Wasserstein distances between sample distributions",
        ],
        references: [
            "Gulrajani et al., Improved Training of Wasserstein GANs, NeurIPS 2017",
            "Arjovsky, Chintala, and Bottou, Wasserstein Generative Adversarial Networks, ICML 2017",
        ],
        workedExample:
            "With w=0.5 and c=0.1, a sample at x=2 has critic gradient 0.9, so its penalty is (0.9 minus 1) squared or 0.01. An interpolated point at x=2.5 has gradient 1.0 and zero penalty. Averaging these penalties and multiplying by lambda yields the gradient-penalty term added to the critic loss.",
    },
    id: "wgan-gp",
    name: "Wasserstein GAN with Gradient Penalty",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        real: [2, 3, 2.5, 3.2],
        fake: [0, 1, -1, 0.5],
        eps: [0.2, 0.4, 0.6, 0.8],
        w: 0.5,
        b: 0,
        c: 0.1,
        lambda: 10,
        lr: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "choose real samples, fake samples, and interpolation coefficients",
        "score real and fake samples with the critic",
        "form interpolated points between real and fake pairs",
        "compute the critic gradient norm at each interpolated point",
        "add lambda times the squared deviation from unit norm",
        "estimate Wasserstein distance as mean fake score minus mean real score",
        "move fake samples along the critic gradient for the generator step",
        "done: report penalty, Wasserstein estimate, and critic loss",
    ],
};

export default module;
