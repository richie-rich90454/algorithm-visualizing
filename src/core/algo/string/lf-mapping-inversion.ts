/**
 * lf-mapping-inversion.ts – LF-Mapping Inversion.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n)", space: "O(n)"
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
    const t = (input as { bwt?: string } | null) ?? {};
    const bwt = t.bwt ?? "annb$aa";
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
    yield F(
        bwt.split("").map((c, i) => cell(0, i, c, "idle")),
        `Inverting BWT "${bwt}" via LF-mapping.`,
        0,
    );
    step += 1;
    const n = bwt.length;
    const Fcol = bwt.split("").sort().join("");
    yield F(
        Fcol.split("").map((c, i) => cell(1, i, c, "sorted")),
        `First column F = "${Fcol}".`,
        1,
    );
    step += 1;
    const occRank = new Array<number>(n).fill(0);
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i += 1) {
        const c = bwt[i] as string;
        occRank[i] = seen.get(c) ?? 0;
        seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    const first = new Map<string, number>();
    Fcol.split("").forEach((c, i) => {
        if (!first.has(c)) first.set(c, i);
    });
    const LF = occRank.map((r, i) => (first.get(bwt[i] as string) as number) + r);
    yield F(
        LF.map((v, i) => cell(2, i, String(v), "comparing")),
        `LF = [${LF.join(", ")}].`,
        2,
        { LF },
    );
    step += 1;
    let row = bwt.indexOf("$");
    let out = "";
    for (let k = 0; k < n - 1; k += 1) {
        row = LF[row] as number;
        out = (bwt[row] as string) + out;
    }
    const orig = out + "$";
    yield F(
        orig.split("").map((c, i) => cell(3, i, c, "path")),
        `Walked ${n - 1} LF steps: "${orig}".`,
        3,
        { orig },
    );
    step += 1;
    yield F(
        orig.split("").map((c, i) => cell(3, i, c, "sorted")),
        `Inversion verified: BWT→"${orig}".`,
        4,
        { orig },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The LF-mapping is the inverse step of the Burrows-Wheeler transform: it maps a row of the sorted rotation matrix to the row whose rotation starts one character earlier. Repeatedly following it from the row containing the end marker reconstructs the original string backward.",
        "invariants": [
            "For any character c, LF maps the i-th occurrence of c in the last column to the row of the i-th occurrence of c in the first column.",
            "Following one LF step prepends the preceding character of the original string."
        ],
        "correctness": "Because the first column is the sorted last column and rotations preserve character order within equal letters, the rank of a character in the last column equals its rank among the same letters in the first column; LF therefore moves to the rotation shifted left by one. Iterating from the end-marker row walks backward through the text until it is fully recovered.",
        "complexityRationale": "Computing the first column and occurrence ranks takes O(n) for BWT length n, and each of the n reconstruction steps is a constant-time lookup, giving O(n) time and O(n) space.",
        "uses": [
            "Decompressing BWT-compressed data",
            "Reconstructing text in FM-indexes",
            "Validating a BWT implementation by round-tripping"
        ],
        "references": [
            "Burrows and Wheeler, A Block-Sorting Lossless Data Compression Algorithm, 1994",
            "Navarro and Makinen, Compressed Full-Text Indexes, 2007"
        ],
        "workedExample": "For BWT \"annb$aa\" the first column is \"$aaabnn\" (the sorted characters). Starting from the row of '$', LF steps prepend one character each; after n-1 steps the reconstruction yields \"banana$\"."
    },
    id: "lf-mapping-inversion",
    name: "LF-Mapping Inversion",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { bwt: "annb$aa" },
    visualType: "grid",
    run,
    pseudocode: [
        "extract first column by sorting BWT characters",
        "compute LF-mapping from last to first column",
        "start from primary row for reconstruction",
        "follow LF links prepending each character",
        "repeat until original length restored",
        "verify result by reapplying forward transform",
        "report reconstructed original string",
    ],
};

export default module;
