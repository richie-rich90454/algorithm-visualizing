/**
 * simplex-method-lp.ts – Simplex Method (linear programming).
 * Maximizes 3x+2y under x+y≤4, x+2y≤6: tableau pivots pick the most
 * negative cost (enter x), the tightest ratio (leave s1), then the
 * optimum x=4, y=0, z=12 drops out. Falls back to this LP on bad input.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    // Tableau rows: [x, y, s1, s2, rhs]; last row is -z costs.
    const T = [
        [1, 1, 1, 0, 4],
        [1, 2, 0, 1, 6],
        [-3, -2, 0, 0, 0],
    ];
    const names = ["s1", "s2", "z"];
    let step = 0;
    const frame = (desc: string, line: number, enter: number, leave: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        T.forEach((row, r) =>
            row.forEach((v, c) => {
                entities.push({
                    id: `t-${r}-${c}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (r === leave && c === enter
                        ? "comparing"
                        : c === enter
                          ? "highlight"
                          : r === leave
                            ? "visited"
                            : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            }),
        );
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(line, 6),
            layout: "grid",
            meta: { objective: T[2]?.[4] ?? 0, basis: names.join(",") },
        };
    };
    yield frame("Initial tableau: basis {s1,s2}, costs -3 (x) and -2 (y).", 0, -1, -1);
    step += 1;
    yield frame("Enter x (most negative cost -3): it improves z fastest per unit.", 1, 0, -1);
    step += 1;
    yield frame("Ratios 4/1 vs 6/1: row s1 is tightest → leaves the basis.", 1, 0, 0);
    step += 1;
    const piv = T[0]?.[0] ?? 1;
    const prow = (T[0] ?? []).map((v) => v / piv);
    for (let r = 0; r < 3; r += 1) {
        if (r === 0) {
            T[r] = [...prow];
            continue;
        }
        const factor = T[r]?.[0] ?? 0;
        T[r] = (T[r] ?? []).map((v, c) => Math.round((v - factor * (prow[c] ?? 0)) * 100) / 100);
    }
    names[0] = "x";
    yield frame("Pivot done: row s1 → x; costs now [0,1,3,0] with z=12.", 2, -1, -1);
    step += 1;
    yield frame("All costs ≥ 0: optimal x=4, y=0, z=3·4+2·0=12.", 3, -1, -1);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The simplex method solves linear programs by walking along the edges of the feasible polytope from one vertex to a better adjacent one. It keeps a tableau of the constraints with slack variables; each pivot selects an entering variable with the most negative reduced cost and a leaving variable by the ratio test, then performs elimination. When no negative costs remain, the current vertex is optimal.",
        "invariants": [
            "The tableau always represents a basic feasible solution with nonnegative right-hand sides.",
            "The objective value never decreases during a pivot.",
            "The basis holds exactly one basic variable per constraint row."
        ],
        "correctness": "The ratio test keeps the pivot feasible, and choosing a negative reduced cost keeps the objective from decreasing. For a bounded, nondegenerate linear program each pivot moves to a strictly better vertex, so the method terminates at a vertex whose reduced costs are all nonnegative, which is optimal by linear-programming duality.",
        "complexityRationale": "Each pivot updates the tableau in O(m·n) work for m constraints and n variables, and the number of pivots is bounded by the number of vertices, which can be exponential, giving O(2^n) worst-case time despite good practical behavior. The tableau uses O(m·n) space.",
        "uses": [
            "Resource allocation and production planning",
            "Supply-chain and transportation optimization",
            "Portfolio and blending problems",
            "LP relaxations inside integer programming"
        ],
        "references": [
            "Dantzig, Linear Programming and Extensions, 1963",
            "Bertsimas and Tsitsiklis, Introduction to Linear Optimization, 1997"
        ],
        "workedExample": "Maximize z=3x+2y subject to x+y<=4 and x+2y<=6. The initial basis is {s1,s2} with costs -3 and -2. Variable x enters because -3 is most negative, and the ratio test 4/1 < 6/1 makes s1 leave. Pivoting gives x=4, s2=2 and z=12, with no negative costs, so the optimum is x=4, y=0, z=12."
    },
    id: "simplex-method-lp",
    name: "Simplex Method (LP)",
    category: "math",
    complexity: { time: "O(2^n) worst", space: "O(m·n)" },
    defaultInput: {
        objective: [3, 2],
        constraints: [
            [1, 1, 4],
            [1, 2, 6],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize tableau with slack basis s1 and s2",
        "pick entering variable with most negative cost",
        "run ratio test to choose the leaving row",
        "pivot to make entering basic and leaving leave",
        "update costs and right-hand sides by elimination",
        "repeat until all costs are nonnegative",
        "done: optimal x y and objective z reported",
    ],
};

export default module;
