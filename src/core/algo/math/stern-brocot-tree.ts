import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function B(i: number, label: string, value: number, state: EntityState = "idle"): VisualEntity {
    return {
        id: `bar-${i}`,
        type: "bar" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    };
}
/**
 * stern-brocot-tree – Stern-Brocot Search.
 * Narrows [lo, hi] by mediants until the target appears.
 * Default 3/5 found via path L,R,L. Time O(a+b), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number } | null) ?? {};
    const ta = typeof t.a === "number" ? Math.trunc(t.a) : 3;
    const tb = typeof t.b === "number" ? Math.trunc(t.b) : 5;
    let step = 0;
    const bars = (
        nums: number[],
        hot: number,
        desc: string,
        line: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nums.map((v, i) =>
            B(i, `${v}`, v, i === hot ? "comparing" : i < hot ? "sorted" : "idle"),
        ),
        edges: [],
        description: desc,
        codeLineNumber: line,
        layout: "array",
        meta,
    });
    if (!(tb > 0) || !(ta >= 0) || ta > tb) {
        yield {
            stepNumber: 0,
            entities: [B(0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate target – need 0 <= a <= b, b > 0.`,
            codeLineNumber: 0,
            layout: "array",
            meta: {},
        };
        return;
    }
    let lo: [number, number] = [0, 1];
    let hi: [number, number] = [1, 0];
    const nums: number[] = [];
    yield bars([1], -1, `Searching ${ta}/${tb} between 0/1 and 1/0.`, 0);
    step += 1;
    let path = "";
    for (let guard = 0; guard < 12; guard += 1) {
        const m: [number, number] = [lo[0] + hi[0], lo[1] + hi[1]];
        nums.push(m[0]);
        const cmp = ta * m[1] - m[0] * tb;
        if (cmp === 0) {
            yield bars(
                nums,
                nums.length - 1,
                `Mediant ${m[0]}/${m[1]} equals target – path ${path || "(root)"}.`,
                2,
                { path },
            );
            step += 1;
            yield bars(nums, -1, `Found ${ta}/${tb} after ${nums.length} mediant(s).`, 3, {
                found: true,
            });
            return;
        }
        if (cmp > 0) {
            lo = m;
            path += "R";
        } else {
            hi = m;
            path += "L";
        }
        yield bars(
            nums,
            nums.length - 1,
            `Mediant ${m[0]}/${m[1]} too ${cmp > 0 ? "small – go R" : "big – go L"} (path ${path}).`,
            1,
            { path },
        );
        step += 1;
    }
    yield bars(nums, -1, `Cap reached – stopping honestly (path ${path}).`, 3, { found: false });
}
const module: AlgorithmModule = {
    id: "stern-brocot-tree",
    name: "Stern-Brocot Tree Search",
    category: "math",
    complexity: { time: "O(a + b)", space: "O(1)" },
    defaultInput: { a: 3, b: 5 },
    visualType: "array",
    run,
};
export default module;
