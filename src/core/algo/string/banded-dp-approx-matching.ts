/**
 * banded-dp-approx-matching.ts – Banded DP Approx.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(nk)", space: "O(nk)"
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
    const t = (input as { text?: string; pattern?: string; k?: number } | null) ?? {};
    const text = t.text ?? "ababcab",
        pat = t.pattern ?? "abc",
        k = t.k ?? 1;
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
    const m = pat.length,
        n = text.length;
    const W = 2 * k + 1;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(Infinity));
    for (let i = 0; i <= m && i <= k; i += 1) (dp[i] as number[])[0] = i;
    for (let j = 0; j <= n && j <= k; j += 1) (dp[0] as number[])[j] = j;
    for (let i = 1; i <= m; i += 1)
        for (let j = Math.max(1, i - k); j <= Math.min(n, i + k); j += 1)
            (dp[i] as number[])[j] = Math.min(
                ((dp[i - 1] as number[])[j] as number) + 1,
                ((dp[i] as number[])[j - 1] as number) + 1,
                ((dp[i - 1] as number[])[j - 1] as number) + (pat[i - 1] === text[j - 1] ? 0 : 1),
            );
    yield F(
        grid(
            dp.map((r) => r.map((v) => (v === Infinity ? -1 : v))),
            -1,
        ),
        `Banded DP (k=${k}, width ${W}) for "${pat}" in "${text}".`,
        0,
        { k },
    );
    step += 1;
    if (m === 0) {
        yield F(grid([[0]], 9), "Empty pattern.", 5, { matches: [] });
        return;
    }
    yield F(
        grid(
            dp.map((r) => r.map((v) => (v === Infinity ? -1 : v))),
            1,
        ),
        "Band initialized around diagonal.",
        1,
    );
    step += 1;
    const matches: number[] = [];
    for (let j = 1; j <= n; j += 1)
        if (((dp[m] as number[])[j] as number) <= k) matches.push(j - m);
    yield F(
        grid(
            dp.map((r) => r.map((v) => (v === Infinity ? -1 : v))),
            3,
            [[m, Math.min(n, m)]],
        ),
        `Last row: [${(dp[m] as number[]).map((v) => (v === Infinity ? "∞" : v)).join(", ")}].`,
        2,
        { matches },
    );
    step += 1;
    const path = matches.slice(0, 2).map((s) => [m, s + m] as [number, number]);
    yield F(
        grid(
            dp.map((r) => r.map((v) => (v === Infinity ? -1 : v))),
            999,
            path,
        ),
        matches.length
            ? `Hits ending where dist≤${k}: starts ${matches.join(", ")}.`
            : "No hit within band.",
        3,
        { matches, k },
    );
    step += 1;
    yield F(
        grid(
            dp.map((r) => r.map((v) => (v === Infinity ? -1 : v))),
            999,
            path,
        ),
        "Done.",
        4,
        { matches, k },
    );
}

const module: AlgorithmModule = {
    id: "banded-dp-approx-matching",
    name: "Banded DP Approx",
    category: "string",
    complexity: { time: "O(nk)", space: "O(nk)" },
    defaultInput: { text: "ababcab", pattern: "abc", k: 1 },
    visualType: "grid",
    run,
};

export default module;
