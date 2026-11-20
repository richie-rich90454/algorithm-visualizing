/**
 * hirschberg-alignment.ts – Hirschberg.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(nm)", space: "O(min(n,m))"
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

function nwScore(a: string, b: string): number[] {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j * -2);
    for (let i = 1; i <= a.length; i += 1) {
        const cur = [i * -2];
        for (let j = 1; j <= b.length; j += 1)
            cur.push(
                Math.max(
                    (prev[j] as number) - 2,
                    (cur[j - 1] as number) - 2,
                    (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 1 : -1),
                ),
            );
        prev = cur;
    }
    return prev;
}
function hirsch(a: string, b: string): [string, string] {
    if (a.length === 0) return ["-".repeat(b.length), b];
    if (b.length === 0) return [a, "-".repeat(a.length)];
    if (a.length === 1 || b.length === 1) {
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
                    ((dp[i - 1] as number[])[j - 1] as number) +
                        (a[i - 1] === b[j - 1] ? MATCH : MIS),
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
                    ((dp[i - 1] as number[])[j - 1] as number) +
                        (a[i - 1] === b[j - 1] ? MATCH : MIS)
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
        return [x, y];
    }
    const mid = a.length >> 1;
    const L = nwScore(a.slice(0, mid), b);
    const R = nwScore(a.slice(mid).split("").reverse().join(""), b.split("").reverse().join(""));
    let bj = 0,
        bs = -Infinity;
    for (let j = 0; j <= b.length; j += 1) {
        const s = (L[j] as number) + (R[b.length - j] as number);
        if (s > bs) {
            bs = s;
            bj = j;
        }
    }
    const [l1, l2] = hirsch(a.slice(0, mid), b.slice(0, bj));
    const [r1, r2] = hirsch(a.slice(mid), b.slice(bj));
    return [l1 + r1, l2 + r2];
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
        meta: { comparisons: 0, matches: [], ...meta },
    });
    const mid = a.length >> 1;
    const L = nwScore(a.slice(0, mid), b);
    const R = nwScore(a.slice(mid).split("").reverse().join(""), b.split("").reverse().join(""));
    yield F([cell(0, 0, "H", "idle")], `Hirschberg linear-space align "${a}" vs "${b}".`, 0);
    step += 1;
    yield F(
        L.map((v, j) => cell(0, j, String(v), "sorted")),
        `Forward scores to mid=${mid}: [${L.join(", ")}].`,
        1,
        { L },
    );
    step += 1;
    yield F(
        R.map((v, j) => cell(1, j, String(v), "sorted")),
        `Backward scores: [${R.join(", ")}].`,
        2,
        { R },
    );
    step += 1;
    let bj = 0,
        bs = -Infinity;
    for (let j = 0; j <= b.length; j += 1) {
        const s = (L[j] as number) + (R[b.length - j] as number);
        if (s > bs) {
            bs = s;
            bj = j;
        }
    }
    yield F([cell(0, bj, String(bs), "comparing")], `Midpoint: b split at ${bj} (sum ${bs}).`, 3, {
        bj,
    });
    step += 1;
    const [x, y] = hirsch(a, b);
    yield F(
        [cell(0, 0, x, "path"), cell(1, 0, y, "path")],
        `Recurse both halves: "${x}" / "${y}".`,
        4,
        { x, y },
    );
    step += 1;
    yield F(
        [cell(0, 0, x, "sorted"), cell(1, 0, y, "sorted")],
        `Optimal alignment "${x}" / "${y}" (linear space).`,
        5,
        { x, y },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Hirschberg computes an optimal global alignment with only linear space. It splits the first string at the midpoint, computes forward scores to that row and backward scores from the end, and finds the column where their sum is largest; that column is where the optimal alignment crosses the middle.",
        "invariants": [
            "The forward row gives the best score from the start to each column of the midpoint.",
            "The backward row gives the best score from each column to the end; their sum at column j is the best score of any alignment crossing the middle at j."
        ],
        "correctness": "Any global alignment crosses the middle row at exactly one column, and the optimal sub-alignments on either side are independent given that crossing point. Choosing the maximizing column and recursing on the two halves reconstructs an optimal alignment while linear-space score passes replace a quadratic table.",
        "complexityRationale": "Each recursion level does two linear-space passes over the remaining strings and halves the first string, so total work is O(nm) with O(min(n,m)) space for the score rows and recursion stack.",
        "uses": [
            "Aligning long DNA or protein sequences when memory is limited",
            "Global alignment in genome assemblers",
            "Needleman-Wunsch tasks on inputs too large for a quadratic table"
        ],
        "references": [
            "Hirschberg, A Linear Space Algorithm for Computing Maximal Common Subsequences, 1975",
            "Durbin et al., Biological Sequence Analysis, Chapter 2"
        ],
        "workedExample": "For a=\"GATT\", b=\"GCAT\" with match +1, mismatch -1, gap -2, the midpoint split falls after \"GA\". Forward and backward scores are added column by column, the best crossing column is chosen, and each half is aligned recursively to produce the optimal alignment and score."
    },
    id: "hirschberg-alignment",
    name: "Hirschberg",
    category: "string",
    complexity: { time: "O(nm)", space: "O(min(n,m))" },
    defaultInput: { a: "GATT", b: "GCAT" },
    visualType: "grid",
    run,
    pseudocode: [
        "split first string at middle row for divide step",
        "compute forward scores to middle with linear space",
        "compute backward scores from end to middle",
        "find split point maximizing combined scores",
        "recurse on left and right halves independently",
        "concatenate alignments from both halves",
        "report optimal alignment and score",
    ],
};

export default module;
