/**
 * newton-raphson-root.ts – Newton–Raphson Root Finding.
 * Solves x^2-2=0 from x=1 via x -= (x^2-2)/2x, doubling correct
 * digits each step. Cells accumulate the iterate history.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { start?: number; iters?: number } | null) ?? {};
    let x = Number.isFinite(cfg.start) && (cfg.start as number) !== 0 ? (cfg.start as number) : 1;
    const iters = Math.max(1, Math.min(8, cfg.iters ?? 5));
    const hist = [x];
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = hist.map((v, i) => ({
            id: `it-${i}`,
            type: "cell" as const,
            label: v.toFixed(5),
            value: Math.round(v * 100000) / 100000,
            state: (i === hist.length - 1 ? "comparing" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        const r = x * x - 2;
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                x: Math.round(x * 100000) / 100000,
                residual: Math.round(Math.abs(r) * 100000) / 100000,
            },
        };
    };
    yield frame(`Start x=1: residual ${(1 - 2).toFixed(0)} in magnitude.`, 0);
    step += 1;
    for (let t = 1; t <= iters; t += 1) {
        x -= (x * x - 2) / (2 * x);
        hist.push(x);
        yield frame(`Iteration ${t}: tangent at previous x crosses zero at ${x.toFixed(6)}.`, t);
        step += 1;
    }
    yield frame(`Root ≈ ${x.toFixed(6)} (true √2 ≈ 1.414214).`, iters + 1);
}

const module: AlgorithmModule = {
    id: "newton-raphson-root",
    name: "Newton–Raphson Root",
    category: "math",
    complexity: { time: "O(t)", space: "O(t)" },
    defaultInput: { start: 1, iters: 5 },
    visualType: "grid",
    run,
};

export default module;
