/**
 * dot-plot-alignment.ts – Dot Plot.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
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
        meta: { comparisons: 0, matches: [], ...meta },
    });
    const dot = (r: number, c: number): VisualEntity =>
        cell(r, c, a[r] === b[c] ? "•" : "·", a[r] === b[c] ? "comparing" : "idle");
    const all: VisualEntity[] = [];
    for (let r = 0; r < a.length; r += 1)
        for (let c = 0; c < b.length; c += 1) all.push(cell(r, c, "·", "idle"));
    yield F(all, `Dot plot "${a}" vs "${b}": dot where chars equal.`, 0);
    step += 1;
    const dots: Array<[number, number]> = [];
    for (let r = 0; r < a.length; r += 1)
        for (let c = 0; c < b.length; c += 1) if (a[r] === b[c]) dots.push([r, c]);
    const part = dots.filter(([r, c]) => r < 2);
    yield F(
        all.map((e) => e),
        `Row 0-1 dots placed (${part.length}).`,
        1,
        { dots: dots.length },
    );
    step += 1;
    yield F(
        dots.map(([r, c]) => dot(r, c)),
        `${dots.length} dots total; diagonals = similarity.`,
        2,
        { dots: dots.length },
    );
    step += 1;
    const diag = dots.filter(([r, c]) => r === c).length;
    yield F(
        dots.map(([r, c]) => cell(r, c, r === c ? "•" : "·", r === c ? "path" : "comparing")),
        `Main diagonal holds ${diag} dots.`,
        3,
        { dots: dots.length },
    );
    step += 1;
    yield F(
        dots.map(([r, c]) => dot(r, c)),
        `Dot plot complete: ${dots.length} dots mark every match.`,
        4,
        { dots: dots.length },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A dot plot is a simple visual comparison of two sequences: write one across the top and one down the side, then place a dot wherever the row and column characters match. Stretches of dots along a diagonal reveal aligned or repeated regions.",
        "invariants": [
            "A dot at (i,j) exists exactly when a[i] equals b[j].",
            "The main diagonal represents positions matched against themselves, and other diagonals correspond to constant shifts between the sequences."
        ],
        "correctness": "The grid is defined directly by the equality test, so it is exact by construction. Consecutive dots on a diagonal mean consecutive matching characters, which is precisely a common substring, so counting dots per diagonal surfaces repeats.",
        "complexityRationale": "Every pair (i,j) is tested once, so both time and space are O(nm) for lengths n and m. That quadratic cost is acceptable for short sequences and gives an immediately readable picture.",
        "uses": [
            "Visualizing sequence similarity in bioinformatics",
            "Spotting repeats and inversions in DNA",
            "A pedagogical first step before dynamic-programming alignment"
        ],
        "references": [
            "Lipman and Pearson, Rapid and Sensitive Protein Similarity Searches, 1985",
            "Mount, Bioinformatics: Sequence and Genome Analysis"
        ],
        "workedExample": "For a=\"GATT\" and b=\"GCAT\", dots appear where characters match: G with G, A with A on the diagonal, and T with T. The resulting diagonal of shared letters shows that the two sequences are similar."
    },
    id: "dot-plot-alignment",
    name: "Dot Plot",
    category: "string",
    complexity: { time: "O(nm)", space: "O(nm)" },
    defaultInput: { a: "GATT", b: "GCAT" },
    visualType: "grid",
    run,
    pseudocode: [
        "create grid with text axes for both strings",
        "place dot where row and column characters match",
        "highlight main diagonal for self similarity",
        "count dots per diagonal to find repeats",
        "trace continuous diagonals as aligned regions",
        "filter short diagonals below threshold",
        "report dot positions and longest diagonal",
    ],
};

export default module;
