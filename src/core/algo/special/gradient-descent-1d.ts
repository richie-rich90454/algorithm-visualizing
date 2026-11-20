/**
 * gradient-descent-1d.ts – Gradient Descent (1-D).
 * Minimizes (x-3)^2 from x=0 with learning rate 0.4: each step moves
 * downhill, x -= lr·2(x-3). Bars show f over integer points -1..7.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const f = (x: number): number => (x - 3) * (x - 3);
const XS = [-1, 0, 1, 2, 3, 4, 5, 6, 7];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { start?: number; lr?: number; steps?: number } | null) ?? {};
    let x = Number.isFinite(cfg.start) ? (cfg.start as number) : 0;
    const lr =
        Number.isFinite(cfg.lr) && (cfg.lr as number) > 0 && (cfg.lr as number) < 1
            ? (cfg.lr as number)
            : 0.4;
    const steps = Math.max(1, Math.min(10, cfg.steps ?? 8));
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const near = XS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a), XS[0] ?? 0);
        const entities: VisualEntity[] = XS.map((v) => ({
            id: `x-${v}`,
            type: "bar" as const,
            label: String(f(v)),
            value: f(v),
            state: (v === near ? "comparing" : v === 3 ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: v },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "array",
            meta: { x: Math.round(x * 10000) / 10000, fx: Math.round(f(x) * 10000) / 10000 },
        };
    };
    yield frame(`Start x=${x}: gradient f'=${2 * (x - 3)}.`, 0);
    step += 1;
    for (let t = 1; t <= steps; t += 1) {
        x -= lr * 2 * (x - 3);
        yield frame(`Step ${t}: x=${x.toFixed(4)} (f=${f(x).toFixed(6)}).`, t);
        step += 1;
    }
    yield frame(`Converged to x=${x.toFixed(4)} (optimum x=3).`, steps + 1);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Gradient descent minimizes a function by stepping repeatedly in the direction of steepest decrease, the negative gradient. In one dimension the gradient is the derivative f'(x)=2(x-3), so each update moves x to x minus the learning rate times that derivative. The learning rate sets the step size: too large overshoots, too small converges slowly.",
        "invariants": [
            "For f(x)=(x-3)^2 with 0 < lr < 1, each step moves x toward 3 without overshooting.",
            "The objective value f(x) never increases from one step to the next.",
            "The iterate stays between the starting point and the optimum."
        ],
        "correctness": "The error e_t = x_t - 3 evolves as e_(t+1) = (1 - 2·lr)·e_t. When 0 < lr < 1, the factor |1 - 2·lr| is less than 1, so the error shrinks geometrically to zero and x_t converges to the minimizer 3. Overshooting occurs only when lr exceeds 1.",
        "complexityRationale": "Each step evaluates the derivative and updates x in constant time, so t steps cost O(t). Only the current position is needed for the computation, O(1) space. Convergence is linear in t because the error decays by a fixed factor per step.",
        "uses": [
            "Training regression and neural-network models via backpropagation",
            "Fitting parameters in statistics",
            "Optimization in signal processing",
            "Iterative solvers and control-system tuning"
        ],
        "references": [
            "Rumelhart, Hinton and Williams, Learning Representations by Back-propagating Errors, Nature, 1986",
            "Nocedal and Wright, Numerical Optimization, Chapter 3"
        ],
        "workedExample": "Minimize f(x)=(x-3)^2 from x=0 with lr=0.4. The gradient at 0 is 2(0-3)=-6, so the update gives x=0-0.4(-6)=2.4 and f=0.36. The next gradient is 2(2.4-3)=-1.2, giving x=2.88 and f≈0.014, and the iterates keep approaching 3."
    },
    id: "gradient-descent-1d",
    name: "Gradient Descent (1-D)",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { start: 0, lr: 0.4, steps: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize position x at start with learning rate lr",
        "for step t <- 1 to steps",
        "compute gradient f-prime <- 2(x-3)",
        "move downhill x <- x - lr times gradient",
        "evaluate objective f(x) <- (x-3)^2",
        "approach optimum x=3 as steps continue",
        "done: x converged near optimum 3",
    ],
};

export default module;
