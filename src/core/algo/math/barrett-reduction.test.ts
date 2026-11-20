import { describe, expect, it } from "vitest";
import mod from "./barrett-reduction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Barrett Reduction", () => {
    it("matches the JavaScript remainder across moduli", () => {
        const cases: [number, number][] = [[17, 123456], [3, 1000000], [13, 999999], [97, 123456789], [255, 987654321], [11, 0], [19, 19], [7, 48]];
        for (const [m, x] of cases) {
            const frames = [...mod.run({ m, x })];
            checkFrames(frames);
            const result = frames[frames.length - 1]?.meta["result"];
            expect(result).toBe(x % m);
            expect(result as number).toBeGreaterThanOrEqual(0);
            expect(result as number).toBeLessThan(m);
        }
    });

    it("matches remainder over many random inputs", () => {
        let seed = 987654321;
        for (let t = 0; t < 30; t += 1) {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            const m = 3 + (seed % 500);
            const x = (seed >>> 3) % 100000000;
            const frames = [...mod.run({ m, x })];
            expect(frames[frames.length - 1]?.meta["result"]).toBe(x % m);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
