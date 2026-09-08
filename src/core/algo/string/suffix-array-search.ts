/**
 * suffix-array-search.ts – Suffix Array Search.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(m log n)", space: "O(n)"
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
        meta,
    });
    yield F(tx(text), `Binary-search "${pat}" over suffix array of "${text}".`, 0);
    step += 1;
    const sa = Array.from({ length: text.length }, (_, i) => i).sort((a, b) =>
        text.slice(a) < text.slice(b) ? -1 : 1,
    );
    yield F(tx(text), `SA = [${sa.join(", ")}].`, 1, { sa });
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    let lo = 0,
        hi = sa.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const suf = text.slice(sa[mid] as number);
        yield F(
            tx(text, stAt([sa[mid] as number], "comparing")),
            `Compare "${pat}" vs suffix "${suf}".`,
            2,
            { sa },
        );
        step += 1;
        if (suf < pat) lo = mid + 1;
        else hi = mid;
        if (step > 10) break;
    }
    const matches = sa.filter((s) => text.startsWith(pat, s)).sort((a, b) => a - b);
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        matches.length ? `"${pat}" at ${matches.join(", ")}.` : "No occurrence.",
        3,
        { matches, sa },
    );
}

const module: AlgorithmModule = {
    id: "suffix-array-search",
    name: "Suffix Array Search",
    category: "string",
    complexity: { time: "O(m log n)", space: "O(n)" },
    defaultInput: { text: "banana", pattern: "ana" },
    visualType: "text",
    run,
};

export default module;
