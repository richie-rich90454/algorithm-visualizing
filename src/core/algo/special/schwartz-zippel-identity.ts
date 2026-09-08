/**
 * schwartz-zippel-identity.ts – Schwartz–Zippel Identity Test.
 * Tests P(x)=(x+1)(x+2) against Q(x)=x^2+3x+2 at random points: equal
 * polynomials agree everywhere, distinct ones agree with probability
 * ≤ degree/field-size per trial. Fixed-seed LCG keeps it deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

const P = (x: number): number => (x + 1) * (x + 2);
const Q = (x: number): number => x * x + 3 * x + 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { trials?: number; seed?: number } | null) ?? {};
    const trials = Math.max(1, Math.min(8, cfg.trials ?? 5));
    const rnd = lcg(cfg.seed ?? 9);
    const pts: number[] = [];
    let step = 0;
    const frame = (desc: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = pts.map((x, i) => ({
            id: `pt-${i}`,
            type: "cell" as const,
            label: `x=${x} Δ=${P(x) - Q(x)}`,
            value: P(x) - Q(x),
            state: (P(x) === Q(x) ? "sorted" : "error") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        if (entities.length === 0) {
            entities.push({
                id: "pt-empty",
                type: "cell" as const,
                label: "∅",
                value: "∅",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: { trials: pts.length, allEqual: pts.every((x) => P(x) === Q(x)) },
        };
    };
    yield frame("Claim: (x+1)(x+2) ≡ x²+3x+2; sampling random points in 1..20.", 0);
    step += 1;
    for (let t = 1; t <= trials; t += 1) {
        const x = 1 + Math.floor(rnd() * 20);
        pts.push(x);
        yield frame(`Trial ${t}: x=${x} → P=${P(x)}, Q=${Q(x)} (Δ=${P(x) - Q(x)}).`, t);
        step += 1;
    }
    const ok = pts.every((x) => P(x) === Q(x));
    yield frame(
        ok
            ? `Verdict: identical (agreed on all ${trials} points).`
            : "Verdict: distinct polynomials (mismatch found).",
        trials + 1,
    );
}

const module: AlgorithmModule = {
    id: "schwartz-zippel-identity",
    name: "Schwartz–Zippel Identity",
    category: "math",
    complexity: { time: "O(k·d)", space: "O(k)" },
    defaultInput: { trials: 5, seed: 9 },
    visualType: "grid",
    run,
};

export default module;
