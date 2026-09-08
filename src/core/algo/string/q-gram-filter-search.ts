/**
 * q-gram-filter-search.ts – Q-Gram Filter.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n·q)", space: "O(n)"
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
    const t = (input as { text?: string; pattern?: string; q?: number } | null) ?? {};
    const text = t.text ?? "ababcab";
    const pat = t.pattern ?? "abc";
    const q = t.q ?? 2;
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
    yield F(tx(text), `Q-gram filter (q=${q}) for "${pat}" in "${text}".`, 0);
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { matches: [] });
        return;
    }
    const grams = (s: string): string[] =>
        Array.from({ length: Math.max(0, s.length - q + 1) }, (_, i) => s.slice(i, i + q));
    const pg = grams(pat);
    yield F(tx(pat, stAt([0], "comparing")), `Pattern grams: [${pg.join(", ")}].`, 1, { pg });
    step += 1;
    const matches: number[] = [];
    for (let i = 0; i + pat.length <= text.length && step < 10; i += 1) {
        const w = text.slice(i, i + pat.length);
        const wg = new Set(grams(w));
        const common = pg.filter((g) => wg.has(g)).length;
        const need = Math.max(0, pg.length - q + 1 - 1);
        if (common >= need && w === pat) {
            matches.push(i);
            yield F(
                tx(
                    text,
                    stAt(
                        Array.from({ length: pat.length }, (_, x) => i + x),
                        "path",
                    ),
                ),
                `Window ${i}: ${common} shared grams, verified.`,
                2,
                { matches: [...matches] },
            );
            step += 1;
        } else if (i < 3) {
            yield F(tx(text, stAt([i], "comparing")), `Window ${i}: ${common} shared grams.`, 3, {
                matches: [...matches],
            });
            step += 1;
        }
    }
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        matches.length ? `Found at ${matches.join(", ")}.` : "No occurrence.",
        4,
        { matches },
    );
}

const module: AlgorithmModule = {
    id: "q-gram-filter-search",
    name: "Q-Gram Filter",
    category: "string",
    complexity: { time: "O(n·q)", space: "O(n)" },
    defaultInput: { text: "ababcab", pattern: "abc", q: 2 },
    visualType: "text",
    run,
};

export default module;
