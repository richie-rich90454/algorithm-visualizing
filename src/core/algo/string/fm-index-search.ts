/**
 * fm-index-search.ts – FM-Index Search.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(m)", space: "O(n)"
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

function bwtOf(s: string): string {
    const t = s.endsWith("$") ? s : s + "$";
    const rots = Array.from({ length: t.length }, (_, i) => t.slice(i) + t.slice(0, i));
    rots.sort();
    return rots.map((r) => r[r.length - 1]).join("");
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = t.text ?? "banana";
    const pat = t.pattern ?? "ana";
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
        meta: { comparisons: 0, matches: [], ...meta },
    });
    yield F(tx(text), `FM-index backward search "${pat}" in "${text}".`, 0, {
        comparisons: 0,
        count: 0,
    });
    step += 1;
    const bwt = bwtOf(text);
    yield F(tx(text), `BWT = "${bwt}".`, 1, { comparisons: 0, bwt });
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), `Empty pattern "" - nothing to search for.`, 5, {
            comparisons: 0,
            count: 0,
        });
        return;
    }
    const Fcol = bwt.split("").sort().join("");
    const first = new Map<string, number>();
    Fcol.split("").forEach((c, i) => {
        if (!first.has(c)) first.set(c, i);
    });
    const occ = (c: string, k: number): number => {
        let n = 0;
        for (let i = 0; i < k; i += 1) if (bwt[i] === c) n += 1;
        return n;
    };
    let comparisons = 0;
    let lo = 0,
        hi = bwt.length;
    for (let k = pat.length - 1; k >= 0; k -= 1) {
        const c = pat[k] as string;
        comparisons += 1;
        lo = (first.get(c) ?? 0) + occ(c, lo);
        hi = (first.get(c) ?? 0) + occ(c, hi);
        if (step < 10) {
            yield F(tx(text, stAt([k], "comparing")), `Char "${c}": interval [${lo},${hi}).`, 2, {
                comparisons,
                lo,
                hi,
            });
            step += 1;
        }
        if (lo >= hi) break;
    }
    const count = hi - lo;
    const matches: number[] = [];
    let idx = text.indexOf(pat);
    while (idx >= 0) {
        matches.push(idx);
        idx = text.indexOf(pat, idx + 1);
    }
    comparisons += Math.max(0, text.length - pat.length + 1);
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        count > 0
            ? `"${pat}" occurs ${count}x at ${matches.join(", ")}.`
            : `${pat}" does not occur in the text."`,
        3,
        { comparisons, count, matches },
    );
    step += 1;
    yield F(tx(text, fin), `FM-index complete: "${pat}" occurs ${count}x.`, 4, {
        comparisons,
        count,
        matches,
    });
}

const module: AlgorithmModule = {
    id: "fm-index-search",
    name: "FM-Index Search",
    category: "string",
    complexity: { time: "O(m)", space: "O(n)" },
    defaultInput: { text: "banana", pattern: "ana" },
    visualType: "text",
    run,
    pseudocode: [
        "build Burrows-Wheeler transform and first column",
        "compute occurrence counts for each character",
        "initialize search interval to full BWT range",
        "update interval backward with LF-mapping counts",
        "narrow range using first occurrence plus rank",
        "repeat for each pattern character right to left",
        "report interval size as match count",
    ],
};

export default module;
