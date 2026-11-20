/**
 * bloom-filter-join.test.ts - Independent join reference, no-false-negative
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bloom-filter-join";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bits: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(bits);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => e.state !== undefined)).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function naiveJoin(left: number[], right: number[]): string[] {
    const out: string[] = [];
    for (const r of right) {
        for (const l of left) {
            if (l === r) {
                out.push(`${l}:${r}`);
            }
        }
    }
    return out;
}

describe("bloom-filter join", () => {
    const cases: Array<{ left: number[]; right: number[]; bits: number; hashes: number }> = [
        { left: [10, 20, 30, 40], right: [20, 99, 30, 7, 40, 13], bits: 32, hashes: 3 },
        { left: [1, 2, 3], right: [1, 2, 3, 4, 5], bits: 64, hashes: 4 },
        { left: [5, 5, 6], right: [5, 6, 7], bits: 128, hashes: 2 },
        { left: [100], right: [100, 101, 102], bits: 16, hashes: 1 },
    ];

    it("returns exactly the pairs of a plain hash join", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames, c.bits);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["matchedPairs"]).toEqual(naiveJoin(c.left, c.right));
        }
    });

    it("never skips a key that is actually present", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            const matched = frames[frames.length - 1]?.meta["matchedPairs"] as string[];
            const matchedKeys = new Set(matched.map((p) => Number(p.split(":")[1])));
            const present = c.right.filter((r) => c.left.includes(r));
            for (const key of present) {
                expect(matchedKeys.has(key)).toBe(true);
            }
        }
    });

    it("accounts for skipped probes and final filter contents", () => {
        const frames = [...mod.run(cases[0])];
        const last = frames[frames.length - 1]?.meta;
        const bits = last?.["bloomBits"] as number[];
        expect(bits.length).toBe(32);
        expect(bits.some((b) => b === 1)).toBe(true);
        expect(Number(last?.["probesSkipped"])).toBeGreaterThan(0);
        expect(last?.["matchedPairs"]).toEqual(["20:20", "30:30", "40:40"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
