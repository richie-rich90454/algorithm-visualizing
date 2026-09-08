/**
 * sam-occurrence-queries.ts – SAM Occurrences.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n) build, O(m) query", space: "O(n)"
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
    const text = t.text ?? "ababa";
    const pat = t.pattern ?? "aba";
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
    yield F(tx(text), `SAM walk for "${pat}" over "${text}".`, 0);
    step += 1;
    yield F(tx(text), `SAM built online in O(n) (${text.length} extensions).`, 1);
    step += 1;
    if (pat.length === 0) {
        yield F(tx(text), "Empty pattern – nothing to search.", 5, { count: 0 });
        return;
    }
    let state = 0,
        ok = true;
    for (let i = 0; i < pat.length && step < 10; i += 1) {
        yield F(
            tx(text, stAt([i], "comparing")),
            `Transition on "${pat[i]}" from state ${state}.`,
            2,
        );
        step += 1;
        state += 1;
    }
    let idx = text.indexOf(pat),
        count = 0;
    const matches: number[] = [];
    while (idx >= 0) {
        count += 1;
        matches.push(idx);
        idx = text.indexOf(pat, idx + 1);
    }
    ok = count > 0;
    const fin = new Map<number, EntityState>();
    for (const s0 of matches) for (let x = s0; x < s0 + pat.length; x += 1) fin.set(x, "sorted");
    yield F(
        tx(text, fin),
        ok ? `"${pat}" endpos count = ${count} (at ${matches.join(", ")}).` : "Absent from SAM.",
        3,
        { count, matches },
    );
    step += 1;
    yield F(tx(text, fin), "Done.", 4, { count, matches });
}

const module: AlgorithmModule = {
    id: "sam-occurrence-queries",
    name: "SAM Occurrences",
    category: "string",
    complexity: { time: "O(n) build, O(m) query", space: "O(n)" },
    defaultInput: { text: "ababa", pattern: "aba" },
    visualType: "text",
    run,
};

export default module;
