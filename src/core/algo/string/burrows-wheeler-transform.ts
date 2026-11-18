/**
 * burrows-wheeler-transform.ts – Burrows-Wheeler.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
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
        meta: { comparisons: 0, matches: [], ...meta },
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
        'Sorting rotations lexicographically by first character "a".',
        1,
    );
    step += 1;
    const sorted = order.map((o) => rots[o] as string);
    const bwt = sorted.map((r) => r[r.length - 1]).join("");
    const primary = order.indexOf(0);
    yield F(
        sorted.map((r, i) => cell(i, 0, r, "sorted")),
        `Sorted matrix of "${s}"; last column = BWT "${bwt}".`,
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
        `BWT complete: "${bwt}" (primary index ${primary}).`,
        4,
        { bwt, primary },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The Burrows-Wheeler transform rearranges a string's characters to group equal letters together, making it far more compressible. It forms all rotations of the string with a unique end marker, sorts them lexicographically, and records the last column of the sorted matrix plus the row index of the original rotation.",
        "invariants": [
            "The sorted rotation matrix contains the circular shifts of the input in lexicographic order.",
            "The last column holds the character preceding each rotation in the original circular string, so equal characters cluster."
        ],
        "correctness": "Sorting rotations groups them by prefix, so characters following the same context tend to be identical, which gives the transform its compression-friendly locality. It is reversible: the primary index together with the last column and the sorted first column allow reconstruction through the LF-mapping.",
        "complexityRationale": "Forming n rotations uses O(n^2) characters of space and sorting them with a comparison sort costs O(n^2 log n) in the worst case (O(n log n) comparisons). The visualization uses a straightforward sort; production implementations build the same matrix from a suffix array in O(n).",
        "uses": [
            "Lossless data compression, notably bzip2",
            "Full-text indexes and the FM-index",
            "Bioinformatics read alignment"
        ],
        "references": [
            "Burrows and Wheeler, A Block-Sorting Lossless Data Compression Algorithm, 1994",
            "Knuth, The Art of Computer Programming, Vol. 3"
        ],
        "workedExample": "For \"banana$\" the sorted rotations begin \"$banana\", \"a$banan\", \"ana$ban\", and so on; taking the last column yields \"annb$aa\", and the original rotation \"banana$\" sits at primary index 4."
    },
    id: "burrows-wheeler-transform",
    name: "Burrows-Wheeler",
    category: "string",
    complexity: { time: "O(n log n)", space: "O(n²)" },
    defaultInput: { text: "banana" },
    visualType: "grid",
    run,
    pseudocode: [
        "list all rotations of input string with indices",
        "sort rotations lexicographically to build matrix",
        "take last column as transformed string",
        "record primary index of original rotation",
        "output transformed string and primary index",
        "verify inversion restores original input",
        "report BWT string and primary row",
    ],
};

export default module;
