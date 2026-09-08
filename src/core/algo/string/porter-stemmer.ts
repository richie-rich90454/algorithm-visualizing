/**
 * porter-stemmer.ts – Porter Stemmer.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n)", space: "O(1)"
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

function stem(w: string): string {
    let s = w.toLowerCase();
    if (s.endsWith("sses")) s = s.slice(0, -2);
    else if (s.endsWith("ies")) s = s.slice(0, -2);
    else if (s.endsWith("ss")) s = s;
    else if (s.endsWith("s") && s.length > 2) s = s.slice(0, -1);
    if (s.endsWith("eed") && s.length > 4) s = s.slice(0, -1);
    else if (s.endsWith("ed") && /[aeiou]/.test(s.slice(0, -2))) s = s.slice(0, -2);
    else if (s.endsWith("ing") && /[aeiou]/.test(s.slice(0, -3))) s = s.slice(0, -3);
    return s;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { word?: string } | null) ?? {};
    const word = t.word ?? "caresses";
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
    yield F(tx(word), `Porter stem("${word}").`, 0);
    step += 1;
    yield F(tx(word, stAt([word.length - 1], "comparing")), "Step 1a: plurals (sses→ss).", 1);
    step += 1;
    const s1 = stem(word);
    yield F(tx(word, stAt([0], "comparing")), `After 1a/1b: "${s1}".`, 2, { stem: s1 });
    step += 1;
    yield F(
        tx(
            s1,
            stAt(
                s1.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `Stem "${s1}".`,
        3,
        { stem: s1 },
    );
    step += 1;
    yield F(tx(s1), "Done.", 4, { stem: s1 });
}

const module: AlgorithmModule = {
    id: "porter-stemmer",
    name: "Porter Stemmer",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { word: "caresses" },
    visualType: "text",
    run,
};

export default module;
