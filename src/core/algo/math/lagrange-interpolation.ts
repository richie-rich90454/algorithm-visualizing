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
            meta: { step },
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
        meta: { step },
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

    education: {
        "intuition": "Lagrange interpolation builds the unique polynomial of degree at most n-1 passing through n given points. For each point it forms a basis polynomial that is 1 at that point and 0 at all the others, then weights the bases by the observed y-values. Summing them gives a polynomial that matches every point exactly.",
        "invariants": [
            "Each basis polynomial L_i vanishes at every node except x_i.",
            "L_i evaluated at x_i equals 1.",
            "The weighted sum P(x_i) equals y_i for every data point."
        ],
        "correctness": "The basis polynomial is a product of ratios (x - x_j)/(x_i - x_j) over j not equal to i, which is 1 at x_i and 0 at other nodes. Therefore the sum of y_i times L_i takes value y_k at x_k because only the k-th basis is nonzero there. A nonzero polynomial of degree less than n cannot have n roots, so this interpolant is unique.",
        "complexityRationale": "Evaluating each of the n basis products takes O(n) multiplications, giving O(n^2) time. The construction uses O(1) extra space beyond the input points when only one value is evaluated.",
        "uses": [
            "Fitting a polynomial through known data points",
            "Secret reconstruction in Shamir sharing",
            "Finite-field interpolation in erasure coding"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 1, Section 1.2.5",
            "Burden and Faires, Numerical Analysis, Chapter 3"
        ],
        "workedExample": "Through points (0,1), (1,3), (2,7) the polynomial is P(x) = x^2 + x + 1. Evaluating at x = 3 gives 9 + 3 + 1 = 13, and the weighted Lagrange bases produce the same value."
    },
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
    pseudocode: [
        "load the points and the target x",
        "build each basis L_i(x) vanishing at other nodes",
        "done: P(at) = total",
        "weight each basis by its y_i and accumulate",
        "done: unique interpolant through every point",
    ],
};
export default module;
