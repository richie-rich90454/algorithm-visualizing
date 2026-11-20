/** gist-index.test.ts - No-false-negative, brute-force, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./gist-index";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], pages: number, recordIds: Set<string>): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(pages);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(recordIds.has(edge.id)).toBe(false);
        }
    });
}

describe("GiST-Style Signature Index", () => {
    it("finds exactly the matching records on the default index", () => {
        const input = mod.defaultInput as { records: string[][]; groupSize: number; query: string[] };
        const pages = Math.ceil(input.records.length / input.groupSize);
        const frames = [...mod.run(input)];
        checkFrames(frames, pages, new Set());
        const meta = frames[frames.length - 1]?.meta;
        const brute = input.records
            .map((tags, i) => (input.query.every((tag) => tags.includes(tag)) ? i : -1))
            .filter((i) => i >= 0);
        expect(meta?.["matches"]).toEqual(brute);
    });

    it("never has a false negative across many random queries", () => {
        const records = [
            ["red", "round", "big"],
            ["blue", "square", "small"],
            ["red", "sweet", "small"],
            ["green", "round", "big"],
            ["blue", "sweet", "big"],
            ["red", "square", "small"],
            ["green", "sweet", "round"],
            ["blue", "round", "small"],
        ];
        const queries = [["red"], ["blue", "sweet"], ["green", "round"], ["big", "round"], ["missing"], []];
        for (const query of queries) {
            const input = { records, groupSize: 3, query };
            const frames = [...mod.run(input)];
            const meta = frames[frames.length - 1]?.meta;
            const matches = meta?.["matches"] as number[];
            const brute = records
                .map((tags, i) => (query.every((tag) => tags.includes(tag)) ? i : -1))
                .filter((i) => i >= 0);
            expect(matches).toEqual(brute);
            for (const match of brute) {
                const page = Math.floor(match / 3);
                expect(meta?.["candidates"] as number[]).toContain(page);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
