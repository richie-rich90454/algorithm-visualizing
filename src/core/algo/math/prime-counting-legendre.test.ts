import { describe, expect, it } from "vitest";
import mod from "./prime-counting-legendre";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteCount(x: number): number {
    if (x < 2) return 0;
    const composite = new Array<boolean>(x + 1).fill(false);
    let count = 0;
    for (let i = 2; i <= x; i += 1) {
        if (!composite[i]) {
            count += 1;
            if (i * i <= x) for (let j = i * i; j <= x; j += i) composite[j] = true;
        }
    }
    return count;
}

function countFrom(frames: VisualFrame[]): number {
    return Number(frames[frames.length - 1]?.meta["count"]);
}

describe("Legendre Prime Counting", () => {
    it("matches brute-force sieve counts on a range of limits", () => {
        for (let x = 2; x <= 400; x += 3) {
            const frames = [...mod.run({ x })];
            checkFrames(frames);
            expect(countFrom(frames)).toBe(bruteCount(x));
        }
    });

    it("handles small limits and known values", () => {
        expect(countFrom([...mod.run({ x: 2 })])).toBe(1);
        expect(countFrom([...mod.run({ x: 3 })])).toBe(2);
        expect(countFrom([...mod.run({ x: 100 })])).toBe(25);
        expect(countFrom([...mod.run({ x: 1000 })])).toBe(168);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
