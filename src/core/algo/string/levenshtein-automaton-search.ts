/**
 * levenshtein-automaton-search.ts – Levenshtein Automaton.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n·m)", space: "O(m)"
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

function lev(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j += 1) (dp[0] as number[])[j] = j;
    for (let i = 1; i <= a.length; i += 1)
        for (let j = 1; j <= b.length; j += 1)
            (dp[i] as number[])[j] = Math.min(
                ((dp[i - 1] as number[])[j] as number) + 1,
                ((dp[i] as number[])[j - 1] as number) + 1,
                ((dp[i - 1] as number[])[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
    return (dp[a.length] as number[])[b.length] as number;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { pattern?: string; words?: string[]; k?: number } | null) ?? {};
    const pat = t.pattern ?? "apple";
    const words = t.words ?? ["apple", "apply", "ape"];
    const k = t.k ?? 1;
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
    yield F(tx(pat), `Levenshtein automaton for "${pat}" (k=${k}) over ${words.length} words.`, 0);
    step += 1;
    yield F(tx(pat), "Trie of dictionary + parametric vectors.", 1);
    step += 1;
    const hits: Array<{ w: string; d: number }> = [];
    for (const w of words) {
        const d = lev(pat, w);
        if (d <= k) hits.push({ w, d });
        if (step < 10) {
            yield F(
                tx(w, stAt([0], d <= k ? "path" : "swapped")),
                `"${w}": d=${d} ${d <= k ? "ACCEPT" : "reject"}.`,
                2,
                { hits: hits.map((h) => `${h.w}:${h.d}`) },
            );
            step += 1;
        }
    }
    yield F(
        tx(pat),
        hits.length ? `Accepted: ${hits.map((h) => h.w).join(", ")}.` : "Nothing within k.",
        3,
        { hits: hits.map((h) => `${h.w}:${h.d}`) },
    );
    step += 1;
    yield F(tx(pat), "Done.", 4, { hits: hits.map((h) => `${h.w}:${h.d}`) });
}

const module: AlgorithmModule = {
    id: "levenshtein-automaton-search",
    name: "Levenshtein Automaton",
    category: "string",
    complexity: { time: "O(n·m)", space: "O(m)" },
    defaultInput: { pattern: "apple", words: ["apple", "apply", "ape"], k: 1 },
    visualType: "text",
    run,
};

export default module;
