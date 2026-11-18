/**
 * inverted-index.test.ts - Brute-force index and query check, frame shape, and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./inverted-index";
import type { VisualFrame } from "@/types";

function tokens(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Brute force: for each term, scan every document and collect matches. */
function bruteIndex(documents: string[], term: string): number[] {
    const matches: number[] = [];
    documents.forEach((doc, i) => {
        if (tokens(doc).includes(term)) matches.push(i);
    });
    return matches;
}

function checkFrames(frames: VisualFrame[], terms: number, docs: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(terms * docs);
        expect(frame.entities.every((e) => e.type === "cell" && e.metadata["row"] !== undefined)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Inverted Index", () => {
    it("matches a brute-force index and query result for AND and OR", () => {
        const input = mod.defaultInput as { documents: string[]; query: string; operator: "AND" | "OR" };
        const allTerms = [...new Set(input.documents.flatMap(tokens))].sort();
        for (const operator of ["AND", "OR"] as const) {
            const frames = [...mod.run({ ...input, operator })];
            checkFrames(frames, allTerms.length, input.documents.length);
            const meta = frames[0]?.meta;
            const postings = meta?.["postings"] as string[];
            expect(postings.length).toBe(allTerms.length);
            for (const entry of postings) {
                const separator = entry.indexOf(":");
                const term = entry.slice(0, separator);
                const ids = (entry.slice(separator + 1).match(/\d+/g) ?? []).map(Number);
                expect(ids).toEqual(bruteIndex(input.documents, term));
            }

            const queryTerms = tokens(input.query);
            const lists = queryTerms.map((t) => bruteIndex(input.documents, t));
            let expected = lists[0] ?? [];
            for (let i = 1; i < lists.length; i += 1) {
                const next = lists[i] ?? [];
                expected =
                    operator === "AND"
                        ? expected.filter((id) => next.includes(id))
                        : [...new Set([...expected, ...next])].sort((a, b) => a - b);
            }
            const final = frames[frames.length - 1]?.meta["matches"] as number[];
            expect(final).toEqual(expected);
        }
    });

    it("handles a missing term and an empty query", () => {
        const documents = ["alpha beta", "beta gamma"];
        const missing = [...mod.run({ documents, query: "delta", operator: "AND" })];
        expect(missing[missing.length - 1]?.meta["matches"]).toEqual([]);
        const empty = [...mod.run({ documents, query: "   ", operator: "OR" })];
        expect(empty[empty.length - 1]?.meta["matches"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
