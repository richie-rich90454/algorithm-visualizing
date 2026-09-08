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
 * modular-gaussian-elimination-mod-p – Solve Ax=b over F_p.
 * Forward elimination + back substitution with modular inverses.
 * Default mod 7 solves x=6, y=0. Time O(n^3), space O(n^2).
 */
function modInv(a: number, p: number): number {
    const v = ((a % p) + p) % p;
    for (let x = 1; x < p; x += 1) if ((v * x) % p === 1) return x;
    return 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { mod?: number; rows?: number[][] } | null) ?? {};
    const p = typeof t.mod === "number" ? Math.trunc(t.mod) : 7;
    const M = Array.isArray(t.rows)
        ? (t.rows as number[][]).map((r) => [...r])
        : [
              [2, 1, 5],
              [1, 3, 6],
          ];
    let step = 0;
    const n = M.length;
    if (!(p >= 2) || n === 0 || !M.every((r) => r.length === n + 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs mod >= 2 and n x (n+1) tableau).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const show = (hot: number, desc: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: M.flatMap((row, r) =>
            row.map((v, c) =>
                C(
                    r,
                    c,
                    `${((v % p) + p) % p}`,
                    ((v % p) + p) % p,
                    r === hot ? "comparing" : "idle",
                ),
            ),
        ),
        edges: [],
        description: desc,
        codeLineNumber: line,
        layout: "grid",
        meta: {},
    });
    yield show(-1, `Solve mod ${p}: [${M.map((r) => `[${r}]`).join(", ")}].`, 0);
    step += 1;
    for (let col = 0; col < n; col += 1) {
        let piv = -1;
        for (let r = col; r < n; r += 1) {
            if ((((M[r]![col] as number) % p) + p) % p !== 0) {
                piv = r;
                break;
            }
        }
        if (piv < 0) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, "singular?", 0, "swapped")],
                edges: [],
                description: `Column ${col} all zero – singular, stopping honestly.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: {},
            };
            return;
        }
        if (piv !== col) {
            const tmp = M[col] as number[];
            M[col] = M[piv] as number[];
            M[piv] = tmp;
        }
        const inv = modInv(M[col]![col] as number, p);
        for (let c = col; c <= n; c += 1)
            M[col]![c] = ((((M[col]![c] as number) * inv) % p) + p) % p;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = (((M[r]![col] as number) % p) + p) % p;
            for (let c = col; c <= n; c += 1)
                M[r]![c] = ((((M[r]![c] as number) - f * (M[col]![c] as number)) % p) + p) % p;
        }
        yield show(col, `Column ${col} normalized and cleared.`, 2);
        step += 1;
        if (step > 10) break;
    }
    const sol = M.map((r) => (((r[n] as number) % p) + p) % p);
    yield {
        stepNumber: step,
        entities: sol.map((v, i) => C(0, i, `x${i}=${v}`, v, "sorted")),
        edges: [],
        description: `Solution mod ${p}: [${sol}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { sol },
    };
    step += 1;
    const src = (t.rows as number[][] | undefined) ?? [
        [2, 1, 5],
        [1, 3, 6],
    ];
    const chk = src.map(
        (row) => row.slice(0, n).reduce((s, v, c) => s + v * (sol[c] as number), 0) % p,
    );
    yield {
        stepNumber: step,
        entities: chk.map((v, i) => C(0, i, `${v}`, v, "sorted")),
        edges: [],
        description: `Check A*x = [${chk}] matches b mod ${p}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { chk },
    };
}
const module: AlgorithmModule = {
    id: "modular-gaussian-elimination-mod-p",
    name: "Modular Gaussian Elimination",
    category: "math",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        mod: 7,
        rows: [
            [2, 1, 5],
            [1, 3, 6],
        ],
    },
    visualType: "grid",
    run,
};
export default module;
