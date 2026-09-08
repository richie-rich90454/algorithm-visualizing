/**
 * needleman-wunsch-alignment.ts – Needleman-Wunsch.
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

function nw(a: string, b: string): { dp: number[][]; x: string; y: string; score: number } {
    const MATCH = 1,
        MIS = -1,
        GAP = -2;
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
        new Array(b.length + 1).fill(0),
    );
    for (let i = 1; i <= a.length; i += 1) (dp[i] as number[])[0] = i * GAP;
    for (let j = 1; j <= b.length; j += 1) (dp[0] as number[])[j] = j * GAP;
    for (let i = 1; i <= a.length; i += 1)
        for (let j = 1; j <= b.length; j += 1)
            (dp[i] as number[])[j] = Math.max(
                ((dp[i - 1] as number[])[j] as number) + GAP,
                ((dp[i] as number[])[j - 1] as number) + GAP,
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? MATCH : MIS),
            );
    let x = "",
        y = "",
        i = a.length,
        j = b.length;
    while (i > 0 || j > 0) {
        if (
            i > 0 &&
            j > 0 &&
            (dp[i] as number[])[j] ===
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? MATCH : MIS)
        ) {
            x = (a[i - 1] as string) + x;
            y = (b[j - 1] as string) + y;
            i -= 1;
            j -= 1;
        } else if (
            i > 0 &&
            (dp[i] as number[])[j] === ((dp[i - 1] as number[])[j] as number) + GAP
        ) {
            x = (a[i - 1] as string) + x;
            y = "-" + y;
            i -= 1;
        } else {
            x = "-" + x;
            y = (b[j - 1] as string) + y;
            j -= 1;
        }
    }
    return { dp, x, y, score: (dp[a.length] as number[])[b.length] as number };
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
    const { dp, x, y, score } = nw(a, b);
    yield F(grid(dp, -1), `Global align "${a}" vs "${b}" (match+1/mis-1/gap-2).`, 0);
    step += 1;
    yield F(grid(dp, 1), "First row/col initialized with gap penalties.", 1);
    step += 1;
    const rows = Math.min(dp.length - 1, 3);
    for (let r = 1; r <= rows; r += 1) {
        yield F(grid(dp, r + 1), `Row ${r} filled: [${(dp[r] as number[]).join(", ")}].`, 2);
        step += 1;
    }
    const path: Array<[number, number]> = [];
    let i = a.length,
        j = b.length;
    while (i > 0 || j > 0) {
        path.push([i, j]);
        if (
            i > 0 &&
            j > 0 &&
            (dp[i] as number[])[j] ===
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? 1 : -1)
        ) {
            i -= 1;
            j -= 1;
        } else if (i > 0 && (dp[i] as number[])[j] === ((dp[i - 1] as number[])[j] as number) - 2)
            i -= 1;
        else j -= 1;
    }
    path.push([0, 0]);
    yield F(grid(dp, 999, path), `Traceback: ${x} / ${y} (score ${score}).`, 3, { x, y, score });
    step += 1;
    yield F(grid(dp, 999, path), `Optimal global alignment, score ${score}.`, 4, { x, y, score });
}

const module: AlgorithmModule = {
    id: "needleman-wunsch-alignment",
    name: "Needleman-Wunsch",
    category: "string",
    complexity: { time: "O(nm)", space: "O(nm)" },
    defaultInput: { a: "GATT", b: "GCAT" },
    visualType: "grid",
    run,
};

export default module;
