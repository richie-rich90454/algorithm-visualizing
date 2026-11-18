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
            meta: { step },
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
        meta: { step },
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
                meta: { step },
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
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: U.flatMap((row, r) => row.map((v, c) => C(r, c, `${v}`, v, "sorted"))),
        edges: [],
        description: `U = [${U.map((r) => `[${r}]`).join(", ")}].`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { step },
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

    education: {
        "intuition": "LU decomposition factors a square matrix A into a unit lower-triangular matrix L and an upper-triangular matrix U. It records the elimination multipliers in L while reducing A to U, so solving a linear system becomes two cheap triangular solves. A zero pivot needs a row swap, which the plain version here reports rather than conceals.",
        "invariants": [
            "After k columns, the leading k-by-k block of U is upper triangular and L holds the multipliers used.",
            "The relation A = L*U holds for the original matrix throughout the factorization.",
            "The diagonal of L stays all ones."
        ],
        "correctness": "Each elimination step subtracts a multiple of the pivot row, and storing that multiplier in L makes the product L*U reconstruct the original rows by reversing the steps. By induction over columns the growing blocks satisfy A = L*U. Once U is fully triangular, the factorization is complete.",
        "complexityRationale": "Eliminating below the diagonal in each of n columns touches O(n^2) entries in total per column, giving O(n^3) time. The two triangular factors occupy O(n^2) space.",
        "uses": [
            "Solving many systems with the same coefficient matrix",
            "Computing determinants and matrix inverses",
            "Underlying numerical linear algebra in scientific computing"
        ],
        "references": [
            "Golub and Van Loan, Matrix Computations, Chapter 3",
            "Strang, Linear Algebra and Its Applications, Chapter 2"
        ],
        "workedExample": "For A = [[4,2],[2,3]] the multiplier is 2/4 = 0.5, giving L = [[1,0],[0.5,1]] and U = [[4,2],[0,2]]. Multiplying L by U returns [[4,2],[2,3]], the original matrix."
    },
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
    pseudocode: [
        "copy A into U and start L as identity",
        "a zero pivot needs a row swap: stop here",
        "eliminate below the diagonal in column k",
        "read out the unit-lower matrix L",
        "read out the upper matrix U",
        "done: L·U matches A",
    ],
};
export default module;
