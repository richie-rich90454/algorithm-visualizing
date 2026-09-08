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
 * trial-division-factorization – Trial Division Factoring.
 * Tests divisors d = 2,3,5... while d*d <= n; first hit splits n.
 * Default 91 = 7 x 13. Time O(sqrt n), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 91;
    let step = 0;
    const show = (
        tried: number[],
        hot: number,
        desc: string,
        line: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: [
            C(0, 0, `n=${n}`, n, "idle"),
            ...tried.map((p, i) =>
                C(
                    1,
                    i,
                    `d=${p}`,
                    p,
                    p === hot ? "sorted" : i === tried.length - 1 ? "comparing" : "idle",
                ),
            ),
        ],
        edges: [],
        description: desc,
        codeLineNumber: line,
        layout: "grid",
        meta,
    });
    if (!(n >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `n=${n}?`, n, "highlight")],
            edges: [],
            description: `${n} is degenerate – nothing to factor.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: {},
        };
        return;
    }
    yield show([], -1, `Factoring ${n}: try divisors d with d*d <= n.`, 0);
    step += 1;
    const tried: number[] = [];
    let f = -1;
    const ds: number[] = [2];
    for (let d = 3; d * d <= n; d += 2) ds.push(d);
    for (const d of ds) {
        tried.push(d);
        const r = n - Math.trunc(n / d) * d;
        if (r !== 0) {
            yield show(tried, -1, `${n} mod ${d} = ${r} – not a divisor.`, 1, { d, r });
            step += 1;
        } else {
            f = d;
            yield show(
                tried,
                d,
                `${n} mod ${d} = 0 – factor ${d}, cofactor ${Math.trunc(n / d)}.`,
                2,
                { factor: d },
            );
            step += 1;
            break;
        }
    }
    if (f < 0) {
        yield show(tried, -1, `No divisor found – ${n} is prime.`, 3, { prime: true });
        step += 1;
    } else {
        const g = Math.trunc(n / f);
        yield show(tried, f, `Done: ${n} = ${f} x ${g}.`, 3, { factors: [f, g] });
    }
}
const module: AlgorithmModule = {
    id: "trial-division-factorization",
    name: "Trial Division Factorization",
    category: "math",
    complexity: { time: "O(sqrt(n))", space: "O(1)" },
    defaultInput: { n: 91 },
    visualType: "grid",
    run,
};
export default module;
