/**
 * nysiis.ts - NYSIIS Phonetic Encoding.
 *
 * NYSIIS (New York State Identification and Intelligence System) maps a name
 * to a phonetic key so names that sound alike share a code. It normalizes the
 * name with a handful of leading and trailing rewrites, then scans the rest of
 * the letters applying character substitutions, collapsing repeats, and
 * finally trimming the code. It is a distinct algorithm from Soundex and
 * Metaphone, with its own rule set and six-character output.
 *
 * Time O(n), space O(n) for the normalized string and emitted code.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface ScanStep {
    position: number;
    char: string;
    replacement: string;
    code: string;
}

interface EncodeResult {
    normalized: string;
    steps: ScanStep[];
    code: string;
}

function isVowel(c: string | undefined): boolean {
    return c !== undefined && "AEIOU".includes(c);
}

function encode(word: string): EncodeResult {
    let s = word.toUpperCase().replace(/[^A-Z]/g, "");
    if (s.length === 0) {
        return { normalized: "", steps: [], code: "" };
    }

    if (s.startsWith("MAC")) {
        s = `MCC${s.slice(3)}`;
    } else if (s.startsWith("KN")) {
        s = `NN${s.slice(2)}`;
    } else if (s.startsWith("PH")) {
        s = `FF${s.slice(2)}`;
    } else if (s.startsWith("PF")) {
        s = `FF${s.slice(2)}`;
    } else if (s.startsWith("SCH")) {
        s = `SSS${s.slice(3)}`;
    } else if (s.startsWith("EV")) {
        s = `AF${s.slice(2)}`;
    } else if (s.startsWith("K")) {
        s = `C${s.slice(1)}`;
    }

    if (s.endsWith("EE") || s.endsWith("IE")) {
        s = `${s.slice(0, -2)}Y`;
    } else if (/(DT|RT|RD|NT|ND)$/.test(s)) {
        s = `${s.slice(0, -2)}D`;
    }

    let code = s[0] as string;
    const steps: ScanStep[] = [];
    let i = 1;
    while (i < s.length) {
        const cur = s[i] as string;
        const next = s[i + 1];
        const prev = s[i - 1];
        let replacement = cur;
        let advance = 1;

        if (isVowel(cur)) {
            if (cur === "E" && next === "V") {
                replacement = "AF";
                advance = 2;
            } else {
                replacement = "A";
            }
        } else if (cur === "Q") {
            replacement = "G";
        } else if (cur === "Z") {
            replacement = "S";
        } else if (cur === "M") {
            replacement = "N";
        } else if (cur === "K") {
            replacement = next === "N" ? "N" : "C";
        } else if (s.startsWith("SCH", i)) {
            replacement = "SSS";
            advance = 3;
        } else if (s.startsWith("PH", i)) {
            replacement = "FF";
            advance = 2;
        } else if (cur === "H" && (!isVowel(prev) || !isVowel(next))) {
            replacement = prev as string;
        } else if (cur === "W" && isVowel(prev)) {
            replacement = prev as string;
        }

        for (const ch of replacement) {
            if (ch !== code[code.length - 1]) {
                code += ch;
            }
        }
        steps.push({ position: i, char: cur, replacement, code });
        i += advance;
    }

    if (code.endsWith("S")) {
        code = code.slice(0, -1);
    }
    if (code.endsWith("AY")) {
        code = `${code.slice(0, -2)}Y`;
    }
    if (code.endsWith("A")) {
        code = code.slice(0, -1);
    }

    return { normalized: s, steps, code };
}

function makeWord(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((entity) => {
        const index = Number(entity.metadata["index"]);
        return { ...entity, state: states.get(index) ?? "idle" };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { word?: string } | null) ?? {};
    const word = task.word ?? "Schmidt";
    const result = encode(word);

    let step = 0;
    const frame = (
        text: string,
        states: Map<number, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, string | number | null> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeWord(text, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: { code: result.code, normalized: result.normalized, ...extra },
    });

    yield frame(word, new Map(), `Encode "${word}" with the NYSIIS phonetic rules.`, 0);
    step += 1;

    if (result.normalized.length === 0) {
        yield frame("", new Map(), "Empty or non-letter input: the NYSIIS code is empty.", 7, {
            code: "",
        });
        return;
    }

    yield frame(
        result.normalized,
        new Map(),
        `After leading and trailing rewrites the name is "${result.normalized}".`,
        1,
    );
    step += 1;

    const shownSteps = result.steps.slice(0, 8);
    for (const scan of shownSteps) {
        const states = new Map<number, EntityState>();
        for (let k = 1; k < scan.position; k += 1) {
            states.set(k, "sorted");
        }
        states.set(scan.position, "comparing");
        yield frame(
            result.normalized,
            states,
            `Position ${scan.position} "${scan.char}" becomes "${scan.replacement}"; code "${scan.code}".`,
            3,
            { position: scan.position },
        );
        step += 1;
    }

    const doneStates = new Map<number, EntityState>();
    for (let k = 0; k < result.normalized.length; k += 1) {
        doneStates.set(k, "sorted");
    }
    yield frame(
        result.normalized,
        doneStates,
        `Done: "${word}" encodes to NYSIIS code "${result.code}".`,
        7,
        { code: result.code },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "NYSIIS turns a name into a short key that groups similar-sounding spellings. It first applies a few leading and trailing rewrites (for example MAC to MCC), then walks the remaining letters replacing them with canonical sounds, discarding repeated codes, and trimming the result. The output uses only letters and can be up to six characters long.",
        invariants: [
            "The first character of the code is taken from the normalized name.",
            "Repeated identical code characters are collapsed into one.",
            "Only uppercase letters A through Z appear in the final key.",
        ],
        correctness:
            "Each rewrite rule is applied at a well-defined position: prefix rules before the scan, suffix rules after them, and substitution rules during the scan at the current pointer. Because a character is appended only when it differs from the last code character, repeats cannot appear. The final trimming rules remove only trailing markers, so the resulting key is deterministic for a given normalized name and equal keys arise from inputs the rules map together.",
        complexityRationale:
            "The name is uppercased and filtered once, prefix and suffix checks are constant time, and the scan advances over each character at most once while consuming at most a few characters per rewrite. Time is therefore O(n) and the normalized string plus code use O(n) space.",
        uses: [
            "Record linkage and deduplication of names with spelling variations",
            "Census and genealogy surname indexing",
            "Fuzzy name lookup where Soundex is too coarse",
        ],
        references: [
            "Taft, Name Search Techniques, New York State Identification and Intelligence System, 1970",
            "Wikipedia, New York State Identification and Intelligence System (NYSIIS)",
        ],
        workedExample:
            'For "Schmidt", the leading SCH rewrite gives "SSMIDT", the scan collapses the repeated S, maps the vowel I to A, and keeps D and T, while the trailing DT rewrite at the earlier stage can turn names ending in DT into D. The exact key follows the published rewrite sequence.',
    },
    id: "nysiis",
    name: "NYSIIS",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { word: "Schmidt" },
    visualType: "text",
    run,
    pseudocode: [
        "uppercase the name and remove non-letter characters",
        "apply leading rewrites such as MAC to MCC and KN to NN",
        "apply trailing rewrites such as EE to Y and DT to D",
        "start the code with the normalized name's first character",
        "scan from the second character substituting by vowel and consonant rules",
        "collapse a substitution equal to the last code character",
        "trim trailing S, replace trailing AY with Y, drop trailing A",
        "done: report the NYSIIS key",
    ],
};

export default module;
