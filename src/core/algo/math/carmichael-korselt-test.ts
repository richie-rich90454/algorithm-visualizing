import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * carmichael-korselt-test – Korselt's Carmichael Check.
 * Squarefree with every p-1 dividing n-1 means Carmichael.
 * Default 561 = 3x11x17, all divide 560. Time O(sqrt n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 561;
    let step = 0;
    if (!(n >= 3) || n % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs odd n >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle")],
        edges: [],
        description: `Korselt test on ${n}: factor it.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const fac: Array<[number, number]> = [];
    let tmp = n;
    for (let d = 2; d * d <= tmp; d += 1) {
        if (tmp - Math.trunc(tmp / d) * d === 0) {
            let e = 0;
            while (tmp - Math.trunc(tmp / d) * d === 0) {
                tmp = Math.trunc(tmp / d);
                e += 1;
            }
            fac.push([d, e]);
        }
    }
    if (tmp > 1) fac.push([tmp, 1]);
    for (const [p, e] of fac) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `${p}^${e}`, p, e > 1 ? "swapped" : "comparing")],
            edges: [],
            description: `Factor ${p}^${e}${e > 1 ? " – repeated, fails squarefree" : ""}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    if (fac.some(([, e]) => e > 1)) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `${n}`, n, "swapped")],
            edges: [],
            description: `Not squarefree – not Carmichael.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { carmichael: false },
        };
        return;
    }
    let ok = true;
    for (const [p] of fac) {
        const div = n - 1 - Math.trunc((n - 1) / (p - 1)) * (p - 1) === 0;
        if (!div) ok = false;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `p=${p}`, p, div ? "comparing" : "swapped")],
            edges: [],
            description: `${p}-1 = ${p - 1} ${div ? "divides" : "does NOT divide"} ${n - 1}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;
        if (step > 12) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${n}`, n, ok ? "sorted" : "swapped")],
        edges: [],
        description: ok
            ? `${n} is CARMICHAEL (squarefree, all p-1 | n-1).`
            : `${n} is not Carmichael.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { carmichael: ok },
    };
}
const module: AlgorithmModule = {
    id: "carmichael-korselt-test",
    name: "Carmichael Korselt Test",
    category: "math",
    complexity: { time: "O(sqrt(n))", space: "O(1)" },
    defaultInput: { n: 561 },
    visualType: "grid",
    run,
};
export default module;
