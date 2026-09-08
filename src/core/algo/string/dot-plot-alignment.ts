/**
 * dot-plot-alignment.ts – Dot Plot.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(nm)", space: "O(nm)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cell(r: number, c: number, label: string, state: EntityState = "idle"): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell",
        label,
        value: 0,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    } as unknown as VisualEntity;
}
function grid(dp: number[][], done: number, hi: Array<[number, number]> = []): VisualEntity[] {
    const out: VisualEntity[] = [];
    const hs = new Map(hi.map(([r, c]) => [`${r},${c}`, true]));
    for (let r = 0; r < dp.length; r += 1)
        for (let c = 0; c < (dp[r] as number[]).length; c += 1)
            out.push(
                cell(
                    r,
                    c,
                    String((dp[r] as number[])[c]),
                    hs.has(`${r},${c}`) ? "comparing" : r + c <= done ? "sorted" : "idle",
                ),
            );
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: string; b?: string } | null) ?? {};
    const a = t.a ?? "GATT",
        b = t.b ?? "GCAT";
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta,
    });
    const dot = (r: number, c: number): VisualEntity =>
        cell(r, c, a[r] === b[c] ? "•" : "·", a[r] === b[c] ? "comparing" : "idle");
    const all: VisualEntity[] = [];
    for (let r = 0; r < a.length; r += 1)
        for (let c = 0; c < b.length; c += 1) all.push(cell(r, c, "·", "idle"));
    yield F(all, `Dot plot "${a}" vs "${b}": dot where chars equal.`, 0);
    step += 1;
    const dots: Array<[number, number]> = [];
    for (let r = 0; r < a.length; r += 1)
        for (let c = 0; c < b.length; c += 1) if (a[r] === b[c]) dots.push([r, c]);
    const part = dots.filter(([r, c]) => r < 2);
    yield F(
        all.map((e) => e),
        `Row 0-1 dots placed (${part.length}).`,
        1,
        { dots: dots.length },
    );
    step += 1;
    yield F(
        dots.map(([r, c]) => dot(r, c)),
        `${dots.length} dots total; diagonals = similarity.`,
        2,
        { dots: dots.length },
    );
    step += 1;
    const diag = dots.filter(([r, c]) => r === c).length;
    yield F(
        dots.map(([r, c]) => cell(r, c, r === c ? "•" : "·", r === c ? "path" : "comparing")),
        `Main diagonal holds ${diag} dots.`,
        3,
        { dots: dots.length },
    );
    step += 1;
    yield F(
        dots.map(([r, c]) => dot(r, c)),
        "Done.",
        4,
        { dots: dots.length },
    );
}

const module: AlgorithmModule = {
    id: "dot-plot-alignment",
    name: "Dot Plot",
    category: "string",
    complexity: { time: "O(nm)", space: "O(nm)" },
    defaultInput: { a: "GATT", b: "GCAT" },
    visualType: "grid",
    run,
};

export default module;
