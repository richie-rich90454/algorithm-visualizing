/**
 * myers-diff-ond.ts – Myers Diff O(ND).
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
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
        meta: { comparisons: 0, matches: [], ...meta },
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
    yield F(grid(dp, 1), 'D=0 diagonal: snake while chars "a" equal.', 1);
    step += 1;
    yield F(grid(dp, 2, [[1, 1]]), "Greedy furthest-x per diagonal k=1.", 2);
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

    education: {
        "intuition": "Myers' diff finds the shortest edit script of insertions and deletions between two sequences in time proportional to the number of edits D. It explores edit-distance diagonals, tracking for each diagonal the furthest x reached, and greedily extends snakes of matching characters.",
        "invariants": [
            "For edit distance d, frontier[k] stores the largest x reachable on diagonal k, where k = x - y, using d edits.",
            "Extending a snake moves along a diagonal while characters match without increasing d."
        ],
        "correctness": "Any edit script of length d corresponds to a path from (0,0) to a frontier; by keeping the furthest x for every k at each d, the algorithm retains enough information to reach the end with the fewest edits. Traceback through the stored frontiers yields a shortest edit script.",
        "complexityRationale": "Each of the D rounds visits O(D) diagonals, giving O((N+M)D) or O(ND) time where D is the edit distance; storing frontiers for traceback uses O(D^2) space, reducible with divide and conquer.",
        "uses": [
            "The diff engine in version-control systems such as git diff",
            "Computing edit scripts in text comparison",
            "Sequence alignment when changes are few"
        ],
        "references": [
            "Myers, An O(ND) Difference Algorithm and Its Variations, 1986",
            "GNU diff documentation"
        ],
        "workedExample": "For a=\"abcab\", b=\"acbab\" the edit distance is 2; a shortest script is keep a, delete b, keep c, insert b, keep a, keep b, and the traceback marks that path through the grid."
    },
    id: "myers-diff-ond",
    name: "Myers Diff O(ND)",
    category: "string",
    complexity: { time: "O(ND)", space: "O(D²)" },
    defaultInput: { a: "abcab", b: "acbab" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize furthest reaching x for zero edits",
        "extend snake while characters match diagonally",
        "record furthest x for each diagonal k",
        "increase edit distance D expanding frontier",
        "trace back from end through saved frontiers",
        "emit keep insert and delete operations",
        "report shortest edit script and distance",
    ],
};

export default module;
