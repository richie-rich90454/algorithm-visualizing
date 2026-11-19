/**
 * gapped-palindrome.ts - Gapped Palindrome Discovery
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A gapped palindrome has the form X Y reverse(X): two equal-length arms that
 * mirror each other around a gap of arbitrary content. For example "abcxycba"
 * has arms "abc" and "cba" with gap "xy". The module picks each pair of equal
 * characters as the innermost arm positions and extends outward as far as the
 * mirror equality allows, recording every maximal gapped palindrome.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) worst case for a teaching search over all inner pairs
 *   Space: O(n^2) for the reported palindromes in the worst case
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The text is drawn as a row of character boxes.
 *   - The two arms are highlighted while the gap is shown in a different state.
 *   - The final frame marks every position that belongs to some palindrome.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

interface GappedInput {
    text?: string;
    minArm?: number;
}

interface GappedPalindrome {
    leftStart: number;
    leftEnd: number;
    rightStart: number;
    rightEnd: number;
    length: number;
    gap: number;
}

/** Build a text row for one frame. */
function makeText(
    text: string,
    palindrome: GappedPalindrome | null,
    all: GappedPalindrome[],
): VisualEntity[] {
    return makeCharacters(text).map((entity) => {
        const index = Number(entity.metadata["index"]);
        let state: EntityState = "idle";
        for (const item of all) {
            if (
                (index >= item.leftStart && index <= item.leftEnd) ||
                (index >= item.rightStart && index <= item.rightEnd)
            ) {
                state = "sorted";
                break;
            }
        }
        if (palindrome) {
            if (
                (index >= palindrome.leftStart && index <= palindrome.leftEnd) ||
                (index >= palindrome.rightStart && index <= palindrome.rightEnd)
            ) {
                state = "comparing";
            } else if (index > palindrome.leftEnd && index < palindrome.rightStart) {
                state = "highlight";
            }
        }
        return { ...entity, state };
    });
}

/** The gapped palindrome generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GappedInput | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "abcxycba";
    const minArm = typeof task.minArm === "number" ? Math.max(1, Math.floor(task.minArm)) : 1;
    const n = text.length;
    const palindromes: GappedPalindrome[] = [];

    yield {
        stepNumber: 0,
        entities: makeText(text, null, []),
        edges: [],
        description: `Searching "${text}" for gapped palindromes with arms of at least ${minArm}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {
            count: 0,
            palindromes: [] as string[],
            minArm,
            innerLeft: -1,
            innerRight: -1,
            armLength: 0,
        },
    };

    let step = 1;
    for (let innerLeft = 0; innerLeft < n; innerLeft += 1) {
        for (let innerRight = innerLeft + 1; innerRight < n; innerRight += 1) {
            if (text[innerLeft] !== text[innerRight]) {
                continue;
            }
            let length = 1;
            while (
                innerLeft - length >= 0 &&
                innerRight + length < n &&
                text[innerLeft - length] === text[innerRight + length]
            ) {
                length += 1;
            }
            if (length < minArm) {
                continue;
            }
            const item: GappedPalindrome = {
                leftStart: innerLeft - length + 1,
                leftEnd: innerLeft,
                rightStart: innerRight,
                rightEnd: innerRight + length - 1,
                length,
                gap: innerRight - innerLeft - 1,
            };
            const duplicate = palindromes.some(
                (existing) =>
                    existing.leftStart === item.leftStart &&
                    existing.rightEnd === item.rightEnd &&
                    existing.length === item.length,
            );
            if (!duplicate) {
                palindromes.push(item);
            }
            yield {
                stepNumber: step,
                entities: makeText(text, item, []),
                edges: [],
                description:
                  `Inner pair ${innerLeft},${innerRight}: arms of length ${length}, gap ${item.gap}, ` +
                  `spanning ${item.leftStart} to ${item.rightEnd}.`,
                codeLineNumber: 2,
                layout: "text",
                meta: {
                    count: palindromes.length,
                    palindromes: palindromes.map((p) =>
                        `${p.leftStart},${p.leftEnd},${p.rightStart},${p.rightEnd},${p.length},${p.gap}`,
                    ),
                    minArm,
                    innerLeft,
                    innerRight,
                    armLength: length,
                },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeText(text, null, palindromes),
        edges: [],
        description:
            palindromes.length === 0
                ? `No gapped palindrome with arms of length ${minArm} or more in "${text}".`
                : `Found ${palindromes.length} maximal gapped palindrome(s) in "${text}".`,
        codeLineNumber: 5,
        layout: "text",
        meta: {
            count: palindromes.length,
            palindromes: palindromes.map((p) =>
                `${p.leftStart},${p.leftEnd},${p.rightStart},${p.rightEnd},${p.length},${p.gap}`,
            ),
            minArm,
            innerLeft: -1,
            innerRight: -1,
            armLength: 0,
            done: true,
        },
    };
}

/** The gapped palindrome module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A gapped palindrome is two matching arms separated by a gap that may contain anything. Each equal pair of characters can be the innermost characters of such a structure, so the search tries every pair and grows the arms outward while the mirror characters keep agreeing. The longest arms for a gap give the maximal gapped palindrome for that inner pair.",
        invariants: [
            "Arms always have equal length and sit on opposite sides of the gap.",
            "For every offset t, the characters at the mirrored arm positions are equal.",
            "The gap length is the distance between the inner arm positions minus one.",
        ],
        correctness:
            "For a fixed inner pair, the extension loop stops exactly when it can no longer add a matching mirrored pair, so the recorded arms are maximal for that pair. Every gapped palindrome has some equal innermost pair and is therefore found at or before that pair's maximal extension. The equality test verifies the mirror condition directly, so each reported structure is a genuine gapped palindrome and no maximal one is missed.",
        complexityRationale:
            "There are O(n^2) inner pairs and each outward extension can take O(n) steps, so the teaching search runs in O(n^3) worst-case time. Each reported palindrome stores a constant number of indices, so the output uses O(n^2) space in the worst case.",
        uses: [
            "Detecting inverted repeats in DNA and RNA sequences",
            "Finding structural motifs with variable spacers",
            "A teaching bridge from ordinary palindromes to tandem repeats",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, palindrome and repeat chapters",
            "Storer, Data Structures and Algorithm Analysis, palindrome exercises",
        ],
        workedExample:
            'In "abcxycba" the inner pair at positions two and five holds c and c. Extending outward matches b with b, then a with a, giving arms "abc" and "cba" of length three with gap "xy" of length two, which is a gapped palindrome.',
    },
    id: "gapped-palindrome",
    name: "Gapped Palindrome",
    category: "string",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: { text: "abcxycba" },
    visualType: "text",
    run,
    pseudocode: [
        "for each pair of positions i less than j",
        "skip the pair when the two characters differ",
        "extend the two arms outward while mirror characters match",
        "record the maximal arms and the gap between them",
        "discard palindromes with arms shorter than the minimum",
        "remove duplicates that share the same span and arm length",
        "done: report all maximal gapped palindromes",
    ],
};

export default module;
