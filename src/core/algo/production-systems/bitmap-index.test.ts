/**
 * bitmap-index.test.ts - Set-based brute-force check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bitmap-index";
import type { VisualFrame } from "@/types";

interface Input {
    numRows: number;
    columns: Record<string, number[]>;
    and: string[];
    or: string[];
}

function reference(input: Input): number[] {
    const answer: number[] = [];
    for (let row = 0; row < input.numRows; row += 1) {
        const andOk = input.and.every((term) => (input.columns[term] ?? []).includes(row));
        const orOk = input.or.length === 0 || input.or.some((term) => (input.columns[term] ?? []).includes(row));
        if (andOk && orOk) {
            answer.push(row);
        }
    }
    return answer;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(rows);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BitmapIndex", () => {
    it("matches a set-based query on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.numRows);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["selectedRows"]).toEqual(reference(input));
        const terms = final?.["bitmapTerms"] as string[];
        const bits = final?.["bitmapBits"] as string[];
        const bitmaps: Record<string, string> = {};
        terms.forEach((term, index) => {
            bitmaps[term] = bits[index] ?? "";
        });
        expect(bitmaps["active"]).toBe("10110011");
        expect(bitmaps["premium"]).toBe("01010101");
    });

    it("matches brute force across randomized queries", () => {
        let seed = 23;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const numRows = 4 + Math.floor(rand() * 10);
            const columns: Record<string, number[]> = {};
            for (const term of ["a", "b", "c"]) {
                columns[term] = [];
                for (let row = 0; row < numRows; row += 1) {
                    if (rand() < 0.5) {
                        columns[term].push(row);
                    }
                }
            }
            const and = rand() < 0.7 ? ["a"] : [];
            const or = rand() < 0.7 ? ["b", "c"] : [];
            const input: Input = { numRows, columns, and, or };
            const frames = [...mod.run(input)];
            checkFrames(frames, numRows);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["selectedRows"]).toEqual(reference(input));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
