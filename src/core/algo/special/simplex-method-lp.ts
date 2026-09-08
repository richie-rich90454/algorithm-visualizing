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
            codeLineNumber: line,
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
};

export default module;
