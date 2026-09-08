/**
 * bisection-method.ts – Bisection Method.
 * Roots x^3-x-2=0 on [1,2] (sign change): each step halves the
 * interval, keeping the half whose endpoints still straddle zero.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const f = (x: number): number => x * x * x - x - 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { a?: number; b?: number; iters?: number } | null) ?? {};
    let a = Number.isFinite(cfg.a) ? (cfg.a as number) : 1;
    let b = Number.isFinite(cfg.b) ? (cfg.b as number) : 2;
    if (a >= b) {
        const t = a;
        a = b;
        b = t;
        if (a === b) b = a + 1;
    }
    if (f(a) * f(b) > 0) {
        a = 1;
        b = 2;
    }
    const iters = Math.max(1, Math.min(10, cfg.iters ?? 8));
    let step = 0;
    let mid = (a + b) / 2;
    const frame = (desc: string, line: number): VisualFrame => {
        const vals = [a, mid, b];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `pt-${i}`,
            type: "bar" as const,
            label: v.toFixed(4),
            value: Math.round(v * 10000) / 10000,
            state: (i === 1 ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "array",
            meta: {
                a: Math.round(a * 10000) / 10000,
                mid: Math.round(mid * 10000) / 10000,
                b: Math.round(b * 10000) / 10000,
                width: Math.round((b - a) * 10000) / 10000,
            },
        };
    };
    yield frame(
        `Interval [${a},${b}]: f(a)=${f(a).toFixed(2)}, f(b)=${f(b).toFixed(2)} straddle zero.`,
        0,
    );
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        mid = (a + b) / 2;
        const side = f(a) * f(mid) <= 0 ? "left" : "right";
        if (side === "left") b = mid;
        else a = mid;
        yield frame(
            `Step ${t}: mid=${mid.toFixed(4)} (f=${f(mid).toFixed(4)}), keeping ${side} half [${a.toFixed(4)},${b.toFixed(4)}].`,
            t,
        );
        step += 1;
    }
    yield frame(`Root ≈ ${mid.toFixed(4)} (true root ≈ 1.5214).`, iters + 1);
}

const module: AlgorithmModule = {
    id: "bisection-method",
    name: "Bisection Method",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { a: 1, b: 2, iters: 8 },
    visualType: "array",
    run,
};

export default module;
