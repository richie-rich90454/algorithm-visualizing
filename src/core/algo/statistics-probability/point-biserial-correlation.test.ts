/** point-biserial-correlation.test.ts - brute-force Pearson cross-check, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./point-biserial-correlation";
import type { VisualFrame } from "@/types";

/** Independent Pearson correlation between the binary and continuous vectors. */
function referencePearson(binary: number[], continuous: number[]): number {
    const n = binary.length;
    const mb = binary.reduce((s, v) => s + v, 0) / n;
    const mc = continuous.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let sb = 0;
    let sc = 0;
    for (let i = 0; i < n; i += 1) {
        const db = (binary[i] as number) - mb;
        const dc = (continuous[i] as number) - mc;
        num += db * dc;
        sb += db * db;
        sc += dc * dc;
    }
    return num / Math.sqrt(sb * sc);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Point-Biserial Correlation", () => {
    it("equals the independent Pearson correlation on several binary/continuous pairs", () => {
        const cases: Array<{ binary: number[]; continuous: number[] }> = [
            { binary: [0, 0, 0, 0, 1, 1, 1, 1], continuous: [4, 5, 6, 5, 9, 10, 11, 12] },
            { binary: [1, 1, 0, 0, 0, 1], continuous: [2, 4, 5, 9, 10, 3] },
            { binary: [0, 1, 0, 1], continuous: [7, 7, 7, 7] },
        ];
        for (const { binary, continuous } of cases) {
            const frames = [...mod.run({ binary, continuous })];
            checkFrames(frames, binary.length);
            const final = frames.at(-1)?.meta;
            const expected = referencePearson(binary, continuous);
            if (Number.isFinite(expected)) expect(Number(final?.["r"])).toBeCloseTo(expected, 9);
            else expect(Number(final?.["r"])).toBe(0);
        }
    });

    it("approaches one for perfect separation and respects the range", () => {
        const final = [...mod.run({ binary: [0, 0, 0, 1, 1, 1], continuous: [1, 2, 3, 7, 8, 9] })].at(-1)?.meta;
        const r = Number(final?.["r"]);
        expect(r).toBeGreaterThan(0.9);
        expect(r).toBeLessThanOrEqual(1);
        expect(r).toBeGreaterThanOrEqual(-1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
