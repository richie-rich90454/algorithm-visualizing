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
 * lagrange-interpolation – Lagrange Interpolation.
 * P(x) = sum y_i L_i(x) through the given points.
 * Default (0,1),(1,3),(2,7) at x=3 gives 13 (x^2+x+1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { points?: number[][]; at?: number } | null) ?? {};
    const pts = Array.isArray(t.points)
        ? (t.points as number[][])
        : [
              [0, 1],
              [1, 3],
              [2, 7],
          ];
    const at = typeof t.at === "number" ? t.at : 3;
    let step = 0;
    if (pts.length < 1 || !pts.every((q) => Array.isArray(q) && q.length === 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs [x,y] points).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: pts.map(([x, y], i) => C(0, i, `(${x},${y})`, y as number, "idle")),
        edges: [],
        description: `Interpolate through ${pts.map(([x, y]) => `(${x},${y})`).join(", ")} at x=${at}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    let total = 0;
    for (let i = 0; i < pts.length; i += 1) {
        const [xi, yi] = pts[i] as [number, number];
        let num = 1,
            den = 1;
        for (let j = 0; j < pts.length; j += 1) {
            if (j === i) continue;
            const [xj] = pts[j] as [number, number];
            num *= at - xj;
            den *= xi - xj;
        }
        const li = num / den;
        const term = (yi as number) * li;
        total += term;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `L${i}=${li}`, li, "comparing"),
                C(0, 1, `t=${term}`, term, "highlight"),
            ],
            edges: [],
            description: `Basis L_${i}(${at}) = ${li}; term ${yi}x${li} = ${term}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { li, term },
        };
        step += 1;
        if (step > 10) break;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `P=${total}`, total, "sorted")],
        edges: [],
        description: `P(${at}) = ${total}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { total },
    };
}
const module: AlgorithmModule = {
    id: "lagrange-interpolation",
    name: "Lagrange Interpolation",
    category: "math",
    complexity: { time: "O(n^2)", space: "O(1)" },
    defaultInput: {
        points: [
            [0, 1],
            [1, 3],
            [2, 7],
        ],
        at: 3,
    },
    visualType: "grid",
    run,
};
export default module;
