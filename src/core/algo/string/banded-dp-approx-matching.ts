/**
 * banded-dp-approx-matching.ts – Banded DP Approx.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
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
        meta: { comparisons: 0, matches: [], ...meta },
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
        yield F(grid([[0]], 9), 'Empty pattern "" - nothing to search for.', 5, { matches: [] });
        return;
    }
    yield F(
        grid(
            dp.map((r) => r.map((v) => (v === Infinity ? -1 : v))),
            1,
        ),
        'Band initialized around diagonal for current pattern "p" in text "t".',
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
            : "No hit within band for current pattern.",
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
        `Complete: ${matches.length} hit(s) with distance at most k=${k}.`,
        4,
        { matches, k },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Approximate matching finds where a pattern occurs with a few edits. A full edit-distance table is quadratic, but if we only allow k edits the optimal alignment never strays more than k cells from the main diagonal. So we fill only a band of width 2k+1 around the diagonal and treat everything outside as unreachable.",
        "invariants": [
            "Every cell inside the band holds the edit distance between a pattern prefix and a text prefix ending there.",
            "Cells outside the band are effectively infinite because reaching them would already require more than k edits.",
            "The last row of the band gives the distance for each possible alignment end position."
        ],
        "correctness": "Any alignment with at most k edits uses at most k gaps in each direction, so its path stays within distance k of the diagonal and lies inside the band. Running the standard edit-distance recurrence inside the band therefore finds the true minimum for every reachable window. A hit is reported exactly when the last-row value is at most k, so no valid approximate occurrence is missed.",
        "complexityRationale": "The band has width 2k+1 and there are m+1 rows, so about O(mk) cells are computed in O(1) each; for text length n the work is O(nk). Only the banded table is stored, giving the same order of space.",
        "uses": [
            "Approximate search in spell checkers and fuzzy find tools",
            "Searching DNA or protein sequences with tolerated mutations",
            "Scoring candidate alignments before a full dynamic-programming pass"
        ],
        "references": [
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 12",
            "CLRS, Introduction to Algorithms, Chapter 32"
        ],
        "workedExample": "Text \"ababcab\", pattern \"abc\", k=1. The band of width 3 around the diagonal is filled; the window at index 0 (\"aba\") has distance 1 and the window at index 2 (\"abc\") has distance 0, so hits at starts 0 and 2 are reported."
    },
    id: "banded-dp-approx-matching",
    name: "Banded DP Approx",
    category: "string",
    complexity: { time: "O(nk)", space: "O(nk)" },
    defaultInput: { text: "ababcab", pattern: "abc", k: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize banded table with gap penalties near diagonal",
        "set band width W equal to 2k+1 around main diagonal",
        "fill cells inside band with substitution cost",
        "skip cells outside band as infinite distance",
        "scan last row for distances at most k",
        "trace matching windows with distance within bound",
        "report match starts and edit distances",
    ],
};

export default module;
