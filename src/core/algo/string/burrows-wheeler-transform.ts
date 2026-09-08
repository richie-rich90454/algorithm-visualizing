/**
 * burrows-wheeler-transform.ts – Burrows-Wheeler.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n log n)", space: "O(n²)"
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
    const t = (input as { text?: string } | null) ?? {};
    const raw = t.text ?? "banana";
    const s = raw.endsWith("$") ? raw : raw + "$";
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
    const rots = Array.from({ length: s.length }, (_, i) => s.slice(i) + s.slice(0, i));
    yield F(
        rots.map((r, i) => cell(i, 0, r, "idle")),
        `All ${s.length} rotations of "${s}".`,
        0,
    );
    step += 1;
    const order = rots
        .map((r, i) => i)
        .sort((x, y) => ((rots[x] as string) < (rots[y] as string) ? -1 : 1));
    yield F(
        order.slice(0, 4).map((o, i) => cell(i, 0, rots[o] as string, "comparing")),
        "Sorting rotations lexicographically.",
        1,
    );
    step += 1;
    const sorted = order.map((o) => rots[o] as string);
    const bwt = sorted.map((r) => r[r.length - 1]).join("");
    const primary = order.indexOf(0);
    yield F(
        sorted.map((r, i) => cell(i, 0, r, "sorted")),
        `Sorted matrix; last column = BWT.`,
        2,
        { bwt },
    );
    step += 1;
    yield F(
        bwt.split("").map((c, i) => cell(3, i, c, "path")),
        `BWT("${raw}") = "${bwt}" (primary ${primary}).`,
        3,
        { bwt, primary },
    );
    step += 1;
    yield F(
        bwt.split("").map((c, i) => cell(3, i, c, "sorted")),
        "Done.",
        4,
        { bwt, primary },
    );
}

const module: AlgorithmModule = {
    id: "burrows-wheeler-transform",
    name: "Burrows-Wheeler",
    category: "string",
    complexity: { time: "O(n log n)", space: "O(n²)" },
    defaultInput: { text: "banana" },
    visualType: "grid",
    run,
};

export default module;
