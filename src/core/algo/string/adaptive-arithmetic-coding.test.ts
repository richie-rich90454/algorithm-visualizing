import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./adaptive-arithmetic-coding";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

describe("Adaptive Arithmetic Coding", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("recovers every short message from its interval code", () => {
        for (const text of ["abracadabra", "aba", "aaaa", "abcabc", "x", ""]) {
            const frames = [...module.run({ text })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.decoded).toBe(text);
            expect(last.meta.code).toBeGreaterThanOrEqual(0);
            expect(last.meta.code).toBeLessThanOrEqual(1);
        }
    });
});
