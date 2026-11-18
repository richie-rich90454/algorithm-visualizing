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
        meta: VisualFrame["meta"] = { step },
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
            meta: { step },
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

    education: {
        "intuition": "The Stern-Brocot tree enumerates every positive reduced fraction exactly once. Starting from the bounds 0/1 and 1/0, it inserts mediants and recurses. To locate a target fraction, compare it with the current mediant and step left or right, narrowing the bracket until the mediant equals the target.",
        "invariants": [
            "The target always stays strictly between the current lower and upper bounds.",
            "Each bound pair satisfies the determinant condition bc - ad = 1.",
            "Every left or right step halves the denominator interval in the search sense."
        ],
        "correctness": "The mediant of two Farey neighbors is the unique fraction with smallest denominator between them, so repeatedly bracketing the target follows the unique path in the Stern-Brocot tree to that fraction. When the mediant equals the target, the path is exactly the sequence of left and right turns. Because the tree contains every reduced fraction once, the search terminates correctly.",
        "complexityRationale": "The depth of a fraction a/b in the tree is O(a + b), so locating it takes that many mediant comparisons with constant work each. Only the current bounds are stored, giving O(1) space.",
        "uses": [
            "Finding best rational approximations with bounded numerator",
            "Enumerating reduced fractions in order",
            "Ratio approximation in mechanical and musical tuning"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 1, Section 1.2.6",
            "Graham, Knuth and Patashnik, Concrete Mathematics, Chapter 4"
        ],
        "workedExample": "To locate 3/5 start between 0/1 and 1/0 with mediant 1/1. Since 3/5 < 1, go left to mediant 1/2; 3/5 > 1/2 so go right to 2/3; continue until the mediant is 3/5, giving the path of turns."
    },
    id: "stern-brocot-tree",
    name: "Stern-Brocot Tree Search",
    category: "math",
    complexity: { time: "O(a + b)", space: "O(1)" },
    defaultInput: { a: 3, b: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "bracket ta/tb between 0/1 and 1/0",
        "take the mediant and step L or R by comparison",
        "an exact mediant ends the search",
        "done: path found, or cap reached honestly",
        "done: target located by its L/R path",
    ],
};
export default module;
