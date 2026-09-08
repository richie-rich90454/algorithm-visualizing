/**
 * distinct-substrings-count.ts – Distinct Substrings Count.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n²)", space: "O(n²)"
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
    const t = (input as { text?: string } | null) ?? {};
    const text = t.text ?? "aba";
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
    yield F(tx(text), `Counting distinct substrings of "${text}".`, 0);
    step += 1;
    const seen = new Set<string>();
    const byLen: number[] = [];
    for (let len = 1; len <= text.length; len += 1) {
        for (let i = 0; i + len <= text.length; i += 1) seen.add(text.slice(i, i + len));
        byLen.push(seen.size);
        if (len <= 3) {
            yield F(
                tx(text, stAt([len - 1], "comparing")),
                `Length ${len}: ${seen.size} so far.`,
                1,
                { count: seen.size },
            );
            step += 1;
        }
    }
    yield F(
        tx(
            text,
            stAt(
                text.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `${seen.size} distinct substrings.`,
        2,
        { count: seen.size },
    );
    step += 1;
    yield F(
        tx(text),
        `Done: n(n+1)/2=${(text.length * (text.length + 1)) / 2} total, ${seen.size} distinct.`,
        3,
        { count: seen.size },
    );
}

const module: AlgorithmModule = {
    id: "distinct-substrings-count",
    name: "Distinct Substrings Count",
    category: "string",
    complexity: { time: "O(n²)", space: "O(n²)" },
    defaultInput: { text: "aba" },
    visualType: "text",
    run,
};

export default module;
