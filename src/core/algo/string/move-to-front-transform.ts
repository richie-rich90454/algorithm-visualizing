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

    education: {
        "intuition": "Move-to-front re-encodes a sequence by replacing each symbol with its current position in an ordered list, then moving that symbol to the front. Symbols seen recently get small indices, which compress well after run-length or entropy coding.",
        "invariants": [
            "The list always contains each alphabet symbol exactly once.",
            "The emitted code is the zero-based index of the current symbol, and after emitting it that symbol is at the front."
        ],
        "correctness": "The transform is reversible because reading a code k tells the decoder to output the k-th list element and then move it to the front, exactly mirroring the encoder's list state. The locality property follows because a just-seen symbol sits at index 0.",
        "complexityRationale": "Each character needs a linear search for its index and a move to front on a list of size sigma, giving O(sigma) per character and O(n·sigma) total; the list uses O(sigma) space.",
        "uses": [
            "The symbol-ranking stage of the bzip2 compressor",
            "Cache simulation models",
            "Locality-aware data transformations"
        ],
        "references": [
            "Ryabko, Data Compression by Means of a Book Stack, 1980",
            "Burrows and Wheeler, A Block-Sorting Lossless Data Compression Algorithm, 1994"
        ],
        "workedExample": "For \"banana\" with alphabet [a, b, n], reading 'b' gives index 1 and moves b to front; 'a' then gives index 1, and 'n' gives index 2, producing the code stream [1, 1, 2, 1, 1] of mostly small values."
    },
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
