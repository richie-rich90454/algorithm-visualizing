/**
 * minimal-absent-word.ts - Shortest Absent Word (Minimal Absent Word)
 *
 * Given a text and an alphabet, the shortest absent word is the lexicographically
 * smallest string over the alphabet that does not occur as a substring of the
 * text and has minimum possible length. A word longer than the text cannot
 * occur, so the search is bounded by the text length plus one. The module
 * enumerates every candidate word by increasing length and tests membership in
 * the set of the text's substrings.
 *
 *  Time:  O(|alphabet|^(L+1) * L) for an answer of length L
 *  Space: O(n^2) for the substring set of a text of length n
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** All substrings of text, grouped implicitly as a set. */
function substringSet(text: string): Set<string> {
    const set = new Set<string>();
    for (let i = 0; i < text.length; i += 1) {
        for (let j = i + 1; j <= text.length; j += 1) {
            set.add(text.slice(i, j));
        }
    }
    return set;
}

/** Enumerate all words of a fixed length over an alphabet in lexicographic order. */
function wordsOfLength(alphabet: string[], length: number): string[] {
    let words: string[] = [""];
    for (let k = 0; k < length; k += 1) {
        const next: string[] = [];
        for (const word of words) {
            for (const ch of alphabet) {
                next.push(word + ch);
            }
        }
        words = next;
    }
    return words;
}

function textEntities(text: string, focus: string): VisualEntity[] {
    const entities: VisualEntity[] = [...text].map((ch, index) => ({
        id: `ch-${index}`,
        type: "character" as const,
        label: ch,
        value: ch,
        state: "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, char: ch },
    }));
    [...focus].forEach((ch, index) => {
        entities.push({
            id: `cand-${index}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: "comparing" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, char: ch, candidate: true },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { text?: string; alphabet?: string } | null) ?? {};
    const text = typeof cfg.text === "string" && cfg.text.length > 0 ? cfg.text.slice(0, 40) : "abab";
    const alphabet = typeof cfg.alphabet === "string" && cfg.alphabet.length > 0
        ? [...new Set(cfg.alphabet.split(""))].sort()
        : [...new Set(text.split(""))].sort();
    const present = substringSet(text);

    let answer = "";
    let answerLength = 0;
    let tested = 0;
    let found = false;
    const maxLength = text.length + 1;

    let step = 0;
    yield {
        stepNumber: step,
        entities: textEntities(text, ""),
        edges: [],
        description: `Finding the shortest word over [${alphabet.join("")}] absent from "${text}".`,
        codeLineNumber: 0,
        layout: "text",
        meta: { text, alphabet: alphabet.join(""), phase: "setup", answer: "", tested: 0 },
    };
    step += 1;

    for (let length = 1; length <= maxLength && !found; length += 1) {
        const words = wordsOfLength(alphabet, length);
        for (const word of words) {
            tested += 1;
            const absent = !present.has(word);
            yield {
                stepNumber: step,
                entities: textEntities(text, word),
                edges: [],
                description: `Length ${length}, testing "${word}": ${absent ? "absent from the text, so this is the answer" : "already a substring, keep searching"}.`,
                codeLineNumber: absent ? 3 : 2,
                layout: "text",
                meta: { text, alphabet: alphabet.join(""), phase: "test", length, candidate: word, absent, tested },
            };
            step += 1;
            if (absent) {
                answer = word;
                answerLength = length;
                found = true;
                break;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: textEntities(text, answer),
        edges: [],
        description: `Shortest absent word is "${answer}" of length ${answerLength}, found after ${tested} candidate test(s).`,
        codeLineNumber: 4,
        layout: "text",
        meta: { text, alphabet: alphabet.join(""), phase: "done", answer, answerLength, tested },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition: "A text contains only finitely many substrings, so some short strings must be missing. To find the smallest missing one, try every string of length one first, then length two, and so on, in alphabetical order. The first string that is not already a substring is the shortest absent word, and scanning in alphabetical order makes the answer unique.",
        invariants: [
            "Every candidate of a given length has the same length, and lengths increase by one.",
            "A candidate is accepted only when it is not in the text's substring set.",
            "All shorter words over the alphabet were tested and found present before acceptance.",
        ],
        correctness: "The algorithm enumerates all words over the alphabet in order of increasing length, and within a length in lexicographic order. By construction it stops at the first word not present as a substring. Since every shorter word was checked and found present, no shorter absent word exists, and since enumeration is lexicographic, the answer is the smallest among the shortest absent words. The bound of text length plus one is safe because no word longer than the text can occur in it.",
        complexityRationale: "Building the substring set takes O(n^2) time and space. For an answer of length L there are at most |alphabet|^(L+1) candidates, each checked in constant time against the set, giving the stated exponential bound in the answer length, which is small for typical alphabets.",
        uses: [
            "Bioinformatics tasks such as finding missing k-mers in a genome",
            "Testing coverage of generated test strings against an input corpus",
            "A subroutine in algorithms on minimal absent words and substrings",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 2 (substrings and absent words)",
            "Crochemore, Minimal Absent Words, in Stringology survey literature",
        ],
        workedExample: "For the text 'abab' over the alphabet a,b, both single letters occur, so length one has no absent word. Of the length-two candidates in order, 'aa' is not a substring of 'abab', so the shortest absent word is 'aa'.",
    },
    id: "minimal-absent-word",
    name: "Shortest Absent Word",
    category: "string",
    complexity: { time: "O(|alphabet|^(L+1) * L)", space: "O(n^2)" },
    defaultInput: { text: "abab", alphabet: "ab" },
    visualType: "text",
    run,
    pseudocode: [
        "build the set of all substrings of the text",
        "for each length from one up to the text length plus one",
        "enumerate every word of that length in lexicographic order",
        "return the first word that is not in the substring set",
        "report the shortest absent word and its length",
    ],
};

export default module;
