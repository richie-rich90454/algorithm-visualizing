/**
 * jaro-winkler-similarity.ts – Jaro-Winkler.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n·m)", space: "O(n+m)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function tx(t: string, st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(t).map((c) => {
        const i = Number((c.metadata as Record<string, unknown>)["index"]);
        return { ...c, state: st.get(i) ?? "idle" };
    });
}
function stAt(pos: number[], s: EntityState): Map<number, EntityState> {
    return new Map(pos.map((p) => [p, s] as [number, EntityState]));
}

function jaro(a: string, b: string): number {
    if (a === b) return 1;
    const la = a.length,
        lb = b.length;
    if (la === 0 || lb === 0) return 0;
    const md = Math.floor(Math.max(la, lb) / 2) - 1;
    const am = new Array(la).fill(false),
        bm = new Array(lb).fill(false);
    let m = 0;
    for (let i = 0; i < la; i += 1)
        for (let j = Math.max(0, i - md); j <= Math.min(lb - 1, i + md); j += 1) {
            if (!(bm[j] as boolean) && a[i] === b[j]) {
                (am[i] as boolean) = true;
                (bm[j] as boolean) = true;
                m += 1;
                break;
            }
        }
    if (m === 0) return 0;
    let tr = 0,
        k = 0;
    for (let i = 0; i < la; i += 1)
        if (am[i] as boolean) {
            while (!(bm[k] as boolean)) k += 1;
            if (a[i] !== b[k]) tr += 1;
            k += 1;
        }
    tr /= 2;
    return (m / la + m / lb + (m - tr) / m) / 3;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: string; b?: string } | null) ?? {};
    const a = t.a ?? "MARTHA",
        b = t.b ?? "MARHTA";
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
        layout: "text",
        meta,
    });
    yield F(tx(a), `Jaro-Winkler("${a}", "${b}").`, 0);
    step += 1;
    const j = jaro(a, b);
    yield F(tx(a, stAt([0, 1, 2], "comparing")), `Matches in window; jaro=${j.toFixed(4)}.`, 1, {
        jaro: j,
    });
    step += 1;
    let pre = 0;
    while (pre < 4 && pre < a.length && pre < b.length && a[pre] === b[pre]) pre += 1;
    yield F(
        tx(
            b,
            stAt(
                Array.from({ length: pre }, (_, i) => i),
                "comparing",
            ),
        ),
        `Common prefix ${pre}.`,
        2,
        { prefix: pre },
    );
    step += 1;
    const w = j + pre * 0.1 * (1 - j);
    yield F(
        tx(
            a,
            stAt(
                a.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `winkler=${w.toFixed(4)}.`,
        3,
        { jaro: j, winkler: w },
    );
    step += 1;
    yield F(tx(b), "Done.", 4, { jaro: j, winkler: w });
}

const module: AlgorithmModule = {
    id: "jaro-winkler-similarity",
    name: "Jaro-Winkler",
    category: "string",
    complexity: { time: "O(n·m)", space: "O(n+m)" },
    defaultInput: { a: "MARTHA", b: "MARHTA" },
    visualType: "text",
    run,
};

export default module;
