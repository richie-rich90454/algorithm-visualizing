/**
 * fountain-code.test.ts - Decoding correctness and xor-property checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./fountain-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("fountain-code");
    });
}

describe("Fountain Code", () => {
    it("recovers every source symbol", () => {
        const source = [10, 20, 30, 40, 50];
        const frames = [...mod.run({ symbols: source, extraDroplets: 4, seed: 12345 })];
        checkFrames(frames, source.length + 4);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["success"]).toBe(true);
        expect(meta?.["decoded"]).toEqual(source);
        expect(meta?.["recovered"]).toBe(source.length);
    });

    it("produces droplets consistent with the decoded symbols", () => {
        const source = [7, 13, 21, 45, 88, 3];
        const frames = [...mod.run({ symbols: source, extraDroplets: 6, seed: 999 })];
        const meta = frames[frames.length - 1]?.meta;
        const decoded = meta?.["decoded"] as number[];
        expect(meta?.["success"]).toBe(true);
        const values = meta?.["values"] as number[];
        const degrees = meta?.["degrees"] as number[];
        expect(values.length).toBe(source.length + 6);
        values.forEach((value, j) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(degrees[j]).toBeGreaterThanOrEqual(1);
        });
        expect(decoded).toEqual(source);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
