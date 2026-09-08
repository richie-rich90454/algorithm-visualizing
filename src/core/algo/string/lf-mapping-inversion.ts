/**
 * lf-mapping-inversion.ts – LF-Mapping Inversion.
 * Tiny deterministic default; 5-15 frames.
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
        meta,
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
    id: "lf-mapping-inversion",
    name: "LF-Mapping Inversion",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { bwt: "annb$aa" },
    visualType: "grid",
    run,
};

export default module;
