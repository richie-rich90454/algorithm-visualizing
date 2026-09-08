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
 * lucas-sequences-lehmer – Lucas Sequence U_n(P,Q).
 * U_0 = 0, U_1 = 1, U_n = P*U_{n-1} - Q*U_{n-2}.
 * Default P=3, Q=1 to n=4: [0,1,3,8,21]. Time O(n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { P?: number; Q?: number; n?: number } | null) ?? {};
    const P = typeof t.P === "number" ? Math.trunc(t.P) : 3;
    const Q = typeof t.Q === "number" ? Math.trunc(t.Q) : 1;
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 4;
    let step = 0;
    if (!(n >= 0) || n > 12) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 0 <= n <= 12).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `P=${P}`, P, "idle"), C(0, 1, `Q=${Q}`, Q, "idle")],
        edges: [],
        description: `U_n(${P},${Q}): seeds U_0 = 0, U_1 = 1.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const U = [0, 1];
    for (let k = 0; k <= Math.min(n, 1); k += 1) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `U${k}=${U[k]}`, U[k] as number, "sorted")],
            edges: [],
            description: `Seed U_${k} = ${U[k]}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    for (let k = 2; k <= n; k += 1) {
        U.push(P * (U[k - 1] as number) - Q * (U[k - 2] as number));
        yield {
            stepNumber: step,
            entities: (U as number[]).map((v, i) =>
                C(0, i, `U${i}=${v}`, v, i === U.length - 1 ? "comparing" : "sorted"),
            ),
            edges: [],
            description: `U_${k} = ${P}x${U[k - 1]} - ${Q}x${U[k - 2]} = ${U[k]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: (U as number[]).map((v, i) => C(0, i, `${v}`, v, "sorted")),
        edges: [],
        description: `U(${P},${Q}) to ${n}: [${U}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { U },
    };
}
const module: AlgorithmModule = {
    id: "lucas-sequences-lehmer",
    name: "Lucas Sequences",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { P: 3, Q: 1, n: 4 },
    visualType: "grid",
    run,
};
export default module;
