/**
 * golden-section-search.ts – Golden-Section Search.
 * Minimizes (x-2)^2 on [0,5]: each step places interior points at the
 * golden ratio, discards the outer third, and reuses one evaluation.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const PHI = (1 + Math.sqrt(5)) / 2;
const f = (x: number): number => (x - 2) * (x - 2);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { a?: number; b?: number; iters?: number } | null) ?? {};
    let a = Number.isFinite(cfg.a) ? (cfg.a as number) : 0;
    let b = Number.isFinite(cfg.b) ? (cfg.b as number) : 5;
    if (a >= b) {
        const t = a;
        a = b;
        b = t;
        if (a === b) b = a + 1;
    }
    const iters = Math.max(1, Math.min(10, cfg.iters ?? 7));
    let c = b - (b - a) / PHI;
    let d = a + (b - a) / PHI;
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const vals = [a, c, d, b];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `pt-${i}`,
            type: "bar" as const,
            label: v.toFixed(3),
            value: Math.round(v * 1000) / 1000,
            state: (i === 1 || i === 2 ? "comparing" : "idle") as EntityState,
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
                a: Math.round(a * 1000) / 1000,
                b: Math.round(b * 1000) / 1000,
                width: Math.round((b - a) * 1000) / 1000,
            },
        };
    };
    yield frame(
        `Bracket [${a},${b}] with interior points c=${c.toFixed(3)}, d=${d.toFixed(3)}.`,
        0,
    );
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        if (f(c) < f(d)) {
            b = d;
            d = c;
            c = b - (b - a) / PHI;
        } else {
            a = c;
            c = d;
            d = a + (b - a) / PHI;
        }
        yield frame(
            `Step ${t}: f(c)=${f(c).toFixed(4)} vs f(d)=${f(d).toFixed(4)} → [${a.toFixed(3)},${b.toFixed(3)}].`,
            t,
        );
        step += 1;
    }
    const best = (a + b) / 2;
    yield frame(`Minimum ≈ ${best.toFixed(4)} (true minimum x=2).`, iters + 1);
}

const module: AlgorithmModule = {
    id: "golden-section-search",
    name: "Golden-Section Search",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { a: 0, b: 5, iters: 7 },
    visualType: "array",
    run,
};

export default module;
