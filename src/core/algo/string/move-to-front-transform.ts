/**
 * move-to-front-transform.ts – Move-To-Front.
 * Educational visualization with deterministic default input.
 * See run() yields for step-by-step frames with American English descriptions.
 *  time: "O(n·σ)", space: "O(σ)"
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
    const text = t.text ?? "banana";
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
        meta: { comparisons: 0, matches: [], ...meta },
    });
    yield F(tx(text), `Move-to-front encode "${text}".`, 0);
    step += 1;
    const alpha = [...new Set(text.split("").sort())];
    yield F(tx(text), `Alphabet [${alpha.join(", ")}].`, 1, { alpha });
    step += 1;
    const list = [...alpha];
    const codes: number[] = [];
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i] as string;
        const k = list.indexOf(c);
        codes.push(k);
        list.splice(k, 1);
        list.unshift(c);
        if (i < 5) {
            yield F(
                tx(text, stAt([i], "comparing")),
                `"${c}" → ${k}; front=[${list.join("")}].`,
                2,
                { codes: [...codes] },
            );
            step += 1;
        }
        if (step > 11) break;
    }
    yield F(
        tx(
            text,
            stAt(
                text.split("").map((_, i) => i),
                "sorted",
            ),
        ),
        `Codes [${codes.join(", ")}].`,
        3,
        { codes },
    );
    step += 1;
    yield F(tx(text), `Move-to-front complete: codes [${codes.join(", ")}].`, 4, { codes });
}

const module: AlgorithmModule = {
    id: "move-to-front-transform",
    name: "Move-To-Front",
    category: "string",
    complexity: { time: "O(n·σ)", space: "O(σ)" },
    defaultInput: { text: "banana" },
    visualType: "text",
    run,
    pseudocode: [
        "initialize alphabet list in sorted order",
        "read next input character from text",
        "output current index of character in list",
        "move accessed character to front of list",
        "repeat for each character in input",
        "record output codes and evolving alphabet",
        "report encoded index sequence",
    ],
};

export default module;
