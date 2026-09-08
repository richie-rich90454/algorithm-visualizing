/**
 * horspool-search.ts – Horspool Search.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(nm) worst, O(n) avg", space: "O(σ)"
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
    const text = t.text ?? "ababcabcab";
    const pat = t.pattern ?? "abc";
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
    yield F(tx(text), `Horspool search for "${pat}".`, 0);
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    const shift = new Map<string, number>();
    for (let i = 0; i < m - 1; i += 1) shift.set(pat[i] as string, m - 1 - i);
    yield F(tx(text), `Bad-char shifts ready (${shift.size} entries).`, 1);
    step += 1;
    const matches: number[] = [];
    let i = 0;
    while (i <= text.length - m) {
        let j = m - 1;
        while (j >= 0 && text[i + j] === pat[j]) j -= 1;
        const cur = Array.from({ length: m }, (_, k) => i + k);
        if (j < 0) {
            matches.push(i);
            yield F(tx(text, stAt(cur, "path")), `Match at ${i}.`, 2, { matches: [...matches] });
            step += 1;
        } else {
            const s = new Map<number, EntityState>(
                cur.map((p) => [p, "comparing"] as [number, EntityState]),
            );
            s.set(i + j, "swapped");
            yield F(tx(text, s), `Mismatch at j=${j}; shift by last-char rule.`, 3, {
                matches: [...matches],
            });
            step += 1;
        }
        if (step > 11) break;
        const c = text[i + m - 1] ?? "";
        i += shift.get(c) ?? m;
        if (matches.length > 1) break;
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let k = s0; k < s0 + m; k += 1) fin.set(k, "sorted");
    yield F(
        tx(text, fin),
        matches.length ? `Found at ${matches.join(", ")}.` : "No occurrence.",
        4,
        { matches },
    );
}

const module: AlgorithmModule = {
    id: "horspool-search",
    name: "Horspool Search",
    category: "string",
    complexity: { time: "O(nm) worst, O(n) avg", space: "O(σ)" },
    defaultInput: { text: "ababcabcab", pattern: "abc" },
    visualType: "text",
    run,
};

export default module;
