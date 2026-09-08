/**
 * myers-diff-ond.ts – Myers Diff O(ND).
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(ND)", space: "O(D²)"
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
    const a = t.a ?? "abcab",
        b = t.b ?? "acbab";
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
    const N = a.length,
        M = b.length;
    const dp: number[][] = Array.from({ length: N + 1 }, (_, i) => new Array(M + 1).fill(0));
    for (let i = 1; i <= N; i += 1) (dp[i] as number[])[0] = i;
    for (let j = 1; j <= M; j += 1) (dp[0] as number[])[j] = j;
    for (let i = 1; i <= N; i += 1)
        for (let j = 1; j <= M; j += 1)
            (dp[i] as number[])[j] = Math.min(
                ((dp[i - 1] as number[])[j] as number) + 1,
                ((dp[i] as number[])[j - 1] as number) + 1,
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
    const dist = (dp[N] as number[])[M] as number;
    yield F(grid(dp, -1), `Myers O(ND) diff "${a}" → "${b}".`, 0);
    step += 1;
    yield F(grid(dp, 1), "D=0 diagonal: snake while chars equal.", 1);
    step += 1;
    yield F(grid(dp, 2, [[1, 1]]), "Greedy furthest-x per diagonal.", 2);
    step += 1;
    let i = N,
        j = M;
    const path: Array<[number, number]> = [[i, j]];
    const ops: string[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            i -= 1;
            j -= 1;
            ops.unshift(`keep ${a[i]}`);
        } else if (
            j > 0 &&
            (i === 0 ||
                ((dp[i] as number[])[j - 1] as number) <= ((dp[i - 1] as number[])[j] as number))
        ) {
            j -= 1;
            ops.unshift(`+${b[j]}`);
        } else {
            i -= 1;
            ops.unshift(`-${a[i]}`);
        }
        path.push([i, j]);
    }
    yield F(grid(dp, 999, path), `Shortest script (d=${dist}): ${ops.join(" ")}.`, 3, {
        dist,
        ops,
    });
    step += 1;
    yield F(grid(dp, 999, path), `Done, edit distance ${dist}.`, 4, { dist, ops });
}

const module: AlgorithmModule = {
    id: "myers-diff-ond",
    name: "Myers Diff O(ND)",
    category: "string",
    complexity: { time: "O(ND)", space: "O(D²)" },
    defaultInput: { a: "abcab", b: "acbab" },
    visualType: "grid",
    run,
};

export default module;
