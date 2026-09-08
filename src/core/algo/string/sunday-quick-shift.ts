/**
 * sunday-quick-shift.ts – Sunday Quick Search.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n/m) avg, O(nm) worst", space: "O(σ)"
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
    yield F(tx(text), `Sunday search for "${pat}" in "${text}".`, 0);
    step += 1;
    const m = pat.length;
    if (m === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    const shift = new Map<string, number>();
    for (let i = 0; i < m; i += 1) shift.set(pat[i] as string, m - i);
    yield F(tx(text), `Shift table built over ${shift.size} distinct chars.`, 1);
    step += 1;
    const matches: number[] = [];
    let i = 0;
    while (i <= text.length - m) {
        let j = 0;
        while (j < m && text[i + j] === pat[j]) j += 1;
        const cur = Array.from({ length: m }, (_, k) => i + k);
        if (j === m) {
            matches.push(i);
            yield F(tx(text, stAt(cur, "path")), `Match at ${i}.`, 2, { matches: [...matches] });
            step += 1;
        } else {
            const s = new Map<number, EntityState>(
                cur.map((p) => [p, "comparing"] as [number, EntityState]),
            );
            s.set(i + j, "swapped");
            yield F(tx(text, s), `Mismatch at text[${i + j}] – align text[${i + m}] next.`, 3, {
                matches: [...matches],
            });
            step += 1;
        }
        if (step > 11) {
            i = text.length;
            break;
        }
        const nxt = text[i + m] ?? "";
        i += shift.get(nxt) ?? m + 1;
        if (matches.length > 0 && i > text.length - m) break;
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
    id: "sunday-quick-shift",
    name: "Sunday Quick Search",
    category: "string",
    complexity: { time: "O(n/m) avg, O(nm) worst", space: "O(σ)" },
    defaultInput: { text: "ababcabcab", pattern: "abc" },
    visualType: "text",
    run,
};

export default module;
