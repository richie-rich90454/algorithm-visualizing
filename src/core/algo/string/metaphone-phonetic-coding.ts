/**
 * metaphone-phonetic-coding.ts – Metaphone.
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

function metaphone(w: string): string {
    let s = w.toUpperCase().replace(/[^A-Z]/g, "");
    if (s.startsWith("KN") || s.startsWith("GN") || s.startsWith("PN")) s = s.slice(1);
    if (s.startsWith("X")) s = "S" + s.slice(1);
    if (s.startsWith("WH")) s = "W" + s.slice(2);
    let out = "";
    for (let i = 0; i < s.length; i += 1) {
        const c = s[i] as string,
            nx = s[i + 1] ?? "";
        if ("AEIOU".includes(c)) {
            if (i === 0) out += c;
            continue;
        }
        if (c === "T" && nx === "H") {
            out += "0";
            i += 1;
            continue;
        }
        if (c === "S" && nx === "H") {
            out += "X";
            i += 1;
            continue;
        }
        if (c === "C" && nx === "H") {
            out += "X";
            i += 1;
            continue;
        }
        if (c === "P" && nx === "H") {
            out += "F";
            i += 1;
            continue;
        }
        if (c === "D" && nx === "G") {
            out += "J";
            i += 1;
            continue;
        }
        if ("FPJNRSTVXZ0".includes(c)) out += c;
        else if (c === "B" && nx !== "") out += c;
        else if (c === "C") out += "K";
        else if (c === "D") out += "T";
        else if (c === "G") out += "K";
        else if (c === "K" && (s[i - 1] ?? "") !== "C") out += c;
        else if (c === "M" || c === "N" || c === "L" || c === "R") out += c;
    }
    return out;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { word?: string } | null) ?? {};
    const word = t.word ?? "Thompson";
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
    yield F(tx(word), `Metaphone("${word}").`, 0);
    step += 1;
    yield F(tx(word, stAt([0, 1], "comparing")), "TH→0, drop initial vowels' kin.", 1);
    step += 1;
    const code = metaphone(word);
    yield F(tx(word, stAt([2, 3], "comparing")), "Consonant skeleton rules.", 2, { code });
    step += 1;
    yield F(
        tx(
            word,
            stAt(
                word.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `Code "${code}".`,
        3,
        { code },
    );
    step += 1;
    yield F(tx(word), "Done.", 4, { code });
}

const module: AlgorithmModule = {
    id: "metaphone-phonetic-coding",
    name: "Metaphone",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { word: "Thompson" },
    visualType: "text",
    run,
};

export default module;
