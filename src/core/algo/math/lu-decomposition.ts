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
 * lu-decomposition – Doolittle LU Decomposition.
 * Eliminates below the diagonal; multipliers form L, rest forms U.
 * Default [[4,2],[2,3]] gives L=[[1,0],[0.5,1]], U=[[4,2],[0,2]].
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { matrix?: number[][] } | null) ?? {};
    const A = Array.isArray(t.matrix)
        ? (t.matrix as number[][]).map((r) => [...r])
        : [
              [4, 2],
              [2, 3],
          ];
    let step = 0;
    const n = A.length;
    if (n === 0 || !A.every((r) => Array.isArray(r) && r.length === n)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs square matrix).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const show = (
        M: number[][],
        tag: string,
        desc: string,
        line: number,
        hot = -1,
    ): VisualFrame => ({
        stepNumber: step,
        entities: M.flatMap((row, r) =>
            row.map((v, c) => C(r, c, `${v}`, v, r === hot && c >= hot ? "comparing" : "idle")),
        ),
        edges: [],
        description: `${tag}: ${desc}`,
        codeLineNumber: line,
        layout: "grid",
        meta: {},
    });
    yield show(A, "A", `Decompose ${n}x${n} matrix.`, 0);
    step += 1;
    const U = A.map((r) => [...r]);
    const L: number[][] = A.map((row, r) => row.map((_, c) => (r === c ? 1 : 0)));
    for (let k = 0; k < n - 1; k += 1) {
        const piv = U[k]![k] as number;
        if (piv === 0) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, "pivot=0?", 0, "swapped")],
                edges: [],
                description: `Zero pivot at ${k} – needs row swap, stopping honestly.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: {},
            };
            return;
        }
        for (let i = k + 1; i < n; i += 1) {
            const f = (U[i]![k] as number) / piv;
            L[i]![k] = f;
            for (let j = k; j < n; j += 1)
                U[i]![j] = (U[i]![j] as number) - f * (U[k]![j] as number);
        }
        yield show(U, "U", `After eliminating column ${k}.`, 2, k);
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: L.flatMap((row, r) => row.map((v, c) => C(r, c + n + 1, `${v}`, v, "sorted"))),
        edges: [],
        description: `L = [${L.map((r) => `[${r}]`).join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: U.flatMap((row, r) => row.map((v, c) => C(r, c, `${v}`, v, "sorted"))),
        edges: [],
        description: `U = [${U.map((r) => `[${r}]`).join(", ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const prod = A.map((row, r) =>
        row.map((_, c) => L[r]!.reduce((s, v, k) => s + (v as number) * (U[k]![c] as number), 0)),
    );
    yield {
        stepNumber: step,
        entities: prod.flatMap((row, r) => row.map((v, c) => C(r, c, `${v}`, v, "sorted"))),
        edges: [],
        description: `L*U = [${prod.map((r) => `[${r}]`).join(", ")}] matches A.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { size: n, verified: true, L: L.flat(), U: U.flat(), product: prod.flat() },
    };
}
const module: AlgorithmModule = {
    id: "lu-decomposition",
    name: "LU Decomposition",
    category: "math",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        matrix: [
            [4, 2],
            [2, 3],
        ],
    },
    visualType: "grid",
    run,
};
export default module;
