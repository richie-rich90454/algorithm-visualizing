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
            codeLineNumber: line,
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
    id: "gradient-descent-1d",
    name: "Gradient Descent (1-D)",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { start: 0, lr: 0.4, steps: 8 },
    visualType: "array",
    run,
};

export default module;
