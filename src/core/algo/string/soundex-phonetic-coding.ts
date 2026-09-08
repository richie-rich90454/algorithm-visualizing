/**
 * soundex-phonetic-coding.ts – Soundex.
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

function soundex(w: string): string {
    const up = w.toUpperCase().replace(/[^A-Z]/g, "");
    if (!up) return "0000";
    const map: Record<string, string> = {
        B: "1",
        F: "1",
        P: "1",
        V: "1",
        C: "2",
        G: "2",
        J: "2",
        K: "2",
        Q: "2",
        S: "2",
        X: "2",
        Z: "2",
        D: "3",
        T: "3",
        L: "4",
        M: "5",
        N: "5",
        R: "6",
    };
    const first = up[0] as string;
    let out = first,
        prev = map[first] ?? "0";
    for (let i = 1; i < up.length && out.length < 4; i += 1) {
        const c = up[i] as string;
        if (c === "H" || c === "W") continue;
        const d = map[c] ?? "0";
        if (d === "0") {
            prev = "0";
            continue;
        }
        if (d !== prev) out += d;
        prev = d;
    }
    return (out + "000").slice(0, 4);
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { word?: string } | null) ?? {};
    const word = t.word ?? "Euler";
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
    yield F(tx(word), `Soundex("${word}").`, 0);
    step += 1;
    yield F(tx(word, stAt([0], "comparing")), `Keep first letter "${word[0]}".`, 1);
    step += 1;
    const code = soundex(word);
    yield F(tx(word, stAt([1, 2], "comparing")), "Map consonants, drop vowels/H/W.", 2, { code });
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
    id: "soundex-phonetic-coding",
    name: "Soundex",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { word: "Euler" },
    visualType: "text",
    run,
};

export default module;
