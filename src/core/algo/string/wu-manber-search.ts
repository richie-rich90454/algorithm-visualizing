/**
 * wu-manber-search.ts – Wu-Manber.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n + m) avg", space: "O(σ²)"
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
    const t = (input as { text?: string; patterns?: string[] } | null) ?? {};
    const text = t.text ?? "ababcab";
    const pats = t.patterns ?? ["ab", "bc"];
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
    yield F(tx(text), `Wu-Manber multi-search for [${pats.join(", ")}].`, 0);
    step += 1;
    const m = Math.min(...pats.map((p) => p.length));
    yield F(tx(text), `Block shift table on min length ${m}.`, 1);
    step += 1;
    const hits: Array<{ pat: string; pos: number }> = [];
    for (const p of pats) {
        let idx = text.indexOf(p);
        while (idx >= 0) {
            hits.push({ pat: p, pos: idx });
            idx = text.indexOf(p, idx + 1);
        }
    }
    hits.sort((a, b) => a.pos - b.pos);
    const shown = hits.slice(0, 4);
    for (const h of shown) {
        yield F(
            tx(
                text,
                stAt(
                    Array.from({ length: h.pat.length }, (_, x) => h.pos + x),
                    "path",
                ),
            ),
            `"${h.pat}" at ${h.pos}.`,
            2,
            { hits: hits.map((h) => `${h.pat}@${h.pos}`) },
        );
        step += 1;
    }
    if (shown.length === 0) {
        yield F(tx(text), "No pattern occurs.", 3, { hits: hits.map((h) => `${h.pat}@${h.pos}`) });
        step += 1;
    }
    const fin = new Map<number, EntityState>();
    for (const h of hits)
        for (let x = h.pos; x < h.pos + h.pat.length; x += 1) fin.set(x, "sorted");
    yield F(tx(text, fin), hits.length ? `${hits.length} total hits.` : "No hits.", 4, {
        hits: hits.map((h) => `${h.pat}@${h.pos}`),
    });
}

const module: AlgorithmModule = {
    id: "wu-manber-search",
    name: "Wu-Manber",
    category: "string",
    complexity: { time: "O(n + m) avg", space: "O(σ²)" },
    defaultInput: { text: "ababcab", patterns: ["ab", "bc"] },
    visualType: "text",
    run,
};

export default module;
