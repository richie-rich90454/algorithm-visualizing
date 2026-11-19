/** meet-in-the-middle-search.test.ts - Subset-sum brute-force check. */

import { describe, expect, it } from "vitest";
import mod from "./meet-in-the-middle-search";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Exhaustive reference: does a subset reach target, and with what minimum size? */
function brute(values: number[], target: number): { found: boolean; minSize: number } {
    let found = false;
    let minSize = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 1 << values.length; mask += 1) {
        let sum = 0;
        let size = 0;
        for (let i = 0; i < values.length; i += 1) {
            if ((mask & (1 << i)) !== 0) {
                sum += values[i] as number;
                size += 1;
            }
        }
        if (sum === target) {
            found = true;
            minSize = Math.min(minSize, size);
        }
    }
    return { found, minSize };
}

describe("MeetInTheMiddleSearch", () => {
    it("matches exhaustive subset enumeration on fixed and random cases", () => {
        const cases: Array<{ values: number[]; target: number }> = [
            { values: [], target: 0 },
            { values: [5], target: 5 },
            { values: [8, 7, 6, 5, 4, 3], target: 14 },
            { values: [1, 2, 3, 4], target: 99 },
            { values: [-3, 5, -2, 7, 1], target: 4 },
        ];
        let state = 99;
        const random = (): number => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        };
        for (let t = 0; t < 20; t += 1) {
            const values = Array.from({ length: 8 }, () => Math.floor(random() * 15) - 5);
            cases.push({ values, target: Math.floor(random() * 20) - 5 });
        }
        for (const input of cases) {
            const before = [...input.values];
            const frames = [...mod.run(input)];
            checkFrames(frames, input.values.length);
            expect(input.values).toEqual(before);
            const expected = brute(input.values, input.target);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta["found"]).toBe(expected.found);
            if (expected.found) {
                expect(Number(last.meta["bestSize"])).toBe(expected.minSize);
                const subset = last.meta["subset"] as number[];
                const sum = subset.reduce((total, i) => total + (input.values[i] as number), 0);
                expect(sum).toBe(input.target);
                expect(subset.length).toBe(expected.minSize);
            }
        }
    });

    it("reports the enumerations and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        const first = frames[0] as VisualFrame;
        expect(Number(first.meta["leftCount"])).toBe(0);
        const summary = frames[1] as VisualFrame;
        expect(Number(summary.meta["leftCount"])).toBe(8);
        expect(Number(summary.meta["rightCount"])).toBe(8);
        expect(Number((frames[frames.length - 1] as VisualFrame).meta["tested"])).toBe(8);
    });
});
