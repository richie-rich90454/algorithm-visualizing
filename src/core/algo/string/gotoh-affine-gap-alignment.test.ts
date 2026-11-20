/** Correctness, frame shape, and termination checks for Gotoh alignment. */
import { describe, expect, it } from "vitest";
import mod from "./gotoh-affine-gap-alignment";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
            expect(e.id).toBeTruthy();
        });
    });
}

function scoreAlignment(x: string, y: string, open: number, extend: number): number {
    let score = 0;
    let inGap = false;
    for (let i = 0; i < x.length; i += 1) {
        if (x[i] === "-" || y[i] === "-") {
            score -= inGap ? extend : open + extend;
            inGap = true;
        } else {
            score += x[i] === y[i] ? 1 : -1;
            inGap = false;
        }
    }
    return score;
}

/** Exhaustive enumeration of every alignment of two short strings. */
function bruteForce(a: string, b: string, open: number, extend: number): number {
    let best = -Infinity;
    const walk = (i: number, j: number, x: string, y: string): void => {
        if (i === a.length && j === b.length) {
            best = Math.max(best, scoreAlignment(x, y, open, extend));
            return;
        }
        if (i < a.length && j < b.length) walk(i + 1, j + 1, x + a[i], y + b[j]);
        if (i < a.length) walk(i + 1, j, x + a[i], y + "-");
        if (j < b.length) walk(i, j + 1, x + "-", y + b[j]);
    };
    walk(0, 0, "", "");
    return best;
}

describe("Gotoh Affine Gap Alignment", () => {
    const cases: Array<[string, string]> = [
        ["AC", "A"],
        ["AC", "AG"],
        ["CAT", "BAT"],
        ["AB", "BA"],
        ["GAT", "GATT"],
    ];
    for (const [a, b] of cases) {
        it(`matches exhaustive alignment for ${a} vs ${b}`, () => {
            const open = 4;
            const extend = 1;
            const frames = [...mod.run({ a, b, open, extend })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = bruteForce(a, b, open, extend);
            expect(final?.["score"]).toBe(expected);
            const alignedA = String(final?.["alignedA"]);
            const alignedB = String(final?.["alignedB"]);
            expect(alignedA.length).toBe(alignedB.length);
            expect(alignedA.replace(/-/g, "")).toBe(a);
            expect(alignedB.replace(/-/g, "")).toBe(b);
            expect(scoreAlignment(alignedA, alignedB, open, extend)).toBe(expected);
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
