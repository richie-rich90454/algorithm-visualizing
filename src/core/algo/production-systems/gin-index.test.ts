/**
 * gin-index.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gin-index";
import type { VisualFrame } from "@/types";

interface Document { id: string; tokens: string[] }
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("GIN generalized inverted index", () => {
    it("returns exactly the brute-force matching documents", () => {
        const documents: Document[] = [
            { id: "d1", tokens: ["cat", "dog"] },
            { id: "d2", tokens: ["dog", "bird"] },
            { id: "d3", tokens: ["cat", "fish"] },
            { id: "d4", tokens: ["bird", "fish"] },
            { id: "d5", tokens: ["cat", "dog", "bird"] },
            { id: "d6", tokens: [] },
        ];
        const queries = ["cat", "dog", "bird", "fish", "missing"];
        for (const query of queries) {
            const frames = [...mod.run({ documents, query })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const expected = documents.filter((doc) => doc.tokens.includes(query)).map((doc) => doc.id);
            expect(meta?.["results"]).toEqual(expected);
            const candidates = meta?.["candidates"] as string[];
            for (const id of expected) { expect(candidates).toContain(id); }
        }
    });

    it("keeps every true match as a candidate (no false negatives)", () => {
        const documents: Document[] = Array.from({ length: 30 }, (_, i) => ({
            id: `doc${i}`,
            tokens: Array.from({ length: (i % 4) + 1 }, (_, j) => `t${(i * 3 + j * 7) % 11}`),
        }));
        for (let q = 0; q < 11; q += 1) {
            const query = `t${q}`;
            const frames = [...mod.run({ documents, query })];
            const final = frames[frames.length - 1]?.meta;
            const filter = frames[1]?.meta;
            const trueMatches = documents.filter((doc) => doc.tokens.includes(query)).map((doc) => doc.id);
            const candidates = filter?.["candidates"] as string[];
            for (const id of trueMatches) { expect(candidates).toContain(id); }
            expect(final?.["results"]).toEqual(trueMatches);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
