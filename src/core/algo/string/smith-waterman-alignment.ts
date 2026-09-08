/**
 * smith-waterman-alignment.ts – Smith-Waterman.
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
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        new Array(b.length + 1).fill(0),
    );
    let bi = 0,
        bj = 0,
        best = 0;
    for (let i = 1; i <= a.length; i += 1)
        for (let j = 1; j <= b.length; j += 1) {
            (dp[i] as number[])[j] = Math.max(
                0,
                ((dp[i - 1] as number[])[j] as number) - 2,
                ((dp[i] as number[])[j - 1] as number) - 2,
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? 2 : -1),
            );
            if (((dp[i] as number[])[j] as number) > best) {
                best = (dp[i] as number[])[j] as number;
                bi = i;
                bj = j;
            }
        }
    yield F(grid(dp, -1), `Local align "${a}" vs "${b}" (match+2/mis-1/gap-2, floor 0).`, 0);
    step += 1;
    yield F(grid(dp, 1), "First row/col are zeros (local alignment).", 1);
    step += 1;
    for (let r = 1; r <= Math.min(3, a.length); r += 1) {
        yield F(grid(dp, r + 1), `Row ${r}: [${(dp[r] as number[]).join(", ")}].`, 2);
        step += 1;
    }
    let x = "",
        y = "",
        i = bi,
        j = bj;
    const path: Array<[number, number]> = [[i, j]];
    while (i > 0 && j > 0 && ((dp[i] as number[])[j] as number) > 0) {
        const d = (dp[i] as number[])[j] as number,
            dg = (dp[i - 1] as number[])[j - 1] as number;
        if (d === dg + (a[i - 1] === b[j - 1] ? 2 : -1)) {
            x = (a[i - 1] as string) + x;
            y = (b[j - 1] as string) + y;
            i -= 1;
            j -= 1;
        } else if (d === ((dp[i - 1] as number[])[j] as number) - 2) {
            x = (a[i - 1] as string) + x;
            y = "-" + y;
            i -= 1;
        } else {
            x = "-" + x;
            y = (b[j - 1] as string) + y;
            j -= 1;
        }
        path.push([i, j]);
    }
    yield F(grid(dp, 999, path), `Traceback from max (${bi},${bj})=${best}: ${x}/${y}.`, 3, {
        x,
        y,
        score: best,
    });
    step += 1;
    yield F(grid(dp, 999, path), `Optimal local alignment, score ${best}.`, 4, {
        x,
        y,
        score: best,
    });
}

const module: AlgorithmModule = {
    id: "smith-waterman-alignment",
    name: "Smith-Waterman",
    category: "string",
    complexity: { time: "O(nm)", space: "O(nm)" },
    defaultInput: { a: "GATT", b: "GCAT" },
    visualType: "grid",
    run,
};

export default module;
