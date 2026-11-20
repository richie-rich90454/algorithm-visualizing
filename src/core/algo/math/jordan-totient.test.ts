import { describe, expect, it } from "vitest";
import mod from "./jordan-totient";
import type { VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function bruteJordan(n: number, k: number): number {
    const tuple = new Array<number>(k).fill(1);
    let count = 0;
    const walk = (position: number): void => {
        if (position === k) {
            let common = n;
            for (const value of tuple) {
                common = gcd(common, value);
            }
            if (common === 1) {
                count += 1;
            }
            return;
        }
        for (let value = 1; value <= n; value += 1) {
            tuple[position] = value;
            walk(position + 1);
        }
    };
    walk(0);
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Jordan Totient Function", () => {
    it("counts coprime k-tuples by brute force", () => {
        for (let n = 1; n <= 12; n += 1) {
            for (const k of [1, 2, 3]) {
                const frames = [...mod.run({ n, k })];
                checkFrames(frames);
                expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(bruteJordan(n, k));
            }
        }
    });

    it("agrees with Euler totient at k = 1 and solves the default", () => {
        const phiFrames = [...mod.run({ n: 30, k: 1 })];
        expect(Number(phiFrames[phiFrames.length - 1]?.meta["phi"])).toBe(8);
        expect(Number(phiFrames[phiFrames.length - 1]?.meta["result"])).toBe(8);
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        expect(Number(last?.meta["result"])).toBe(96);
        expect(Number(last?.meta["phi"])).toBe(4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
