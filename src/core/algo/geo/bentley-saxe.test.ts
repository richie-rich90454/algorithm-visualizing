/** bentley-saxe.test.ts - Brute-force intersection check, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./bentley-saxe";
import type { VisualFrame } from "@/types";

type Rect = [number, number, number, number];

function checkFrames(frames: VisualFrame[], rects: number, events: number): void {
    expect(frames.length).toBe(events + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rects);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForce(rectangles: Rect[]): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < rectangles.length; i += 1) {
        for (let j = i + 1; j < rectangles.length; j += 1) {
            const a = rectangles[i]!;
            const b = rectangles[j]!;
            if (a[0]! <= b[2]! && b[0]! <= a[2]! && a[1]! <= b[3]! && b[1]! <= a[3]!) pairs.push([i, j]);
        }
    }
    return pairs;
}

const normalize = (pairs: Array<[number, number]>): string =>
    pairs.map(([a, b]) => `${a}-${b}`).sort().join(",");

describe("Bentley-Saxe rectangle intersection", () => {
    it("matches brute force on the default input", () => {
        const rectangles = (mod.defaultInput as { rectangles: Rect[] }).rectangles;
        const frames = [...mod.run({ rectangles })];
        checkFrames(frames, rectangles.length, rectangles.length * 2);
        const final = frames[frames.length - 1]!.meta;
        expect(normalize(final["allPairs"] as Array<[number, number]>)).toBe(normalize(bruteForce(rectangles)));
    });

    it("matches brute force on random rectangle sets including boundary touches", () => {
        for (let seed = 1; seed <= 40; seed += 1) {
            let s = seed;
            const rand = (): number => {
                s = (s * 1103515245 + 12345) & 0x7fffffff;
                return s % 9;
            };
            const rectangles: Rect[] = [];
            for (let i = 0; i < 7; i += 1) {
                const x1 = rand();
                const y1 = rand();
                rectangles.push([x1, y1, x1 + rand(), y1 + rand()]);
            }
            const frames = [...mod.run({ rectangles })];
            checkFrames(frames, rectangles.length, rectangles.length * 2);
            const final = frames[frames.length - 1]!.meta;
            expect(normalize(final["allPairs"] as Array<[number, number]>)).toBe(normalize(bruteForce(rectangles)));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
