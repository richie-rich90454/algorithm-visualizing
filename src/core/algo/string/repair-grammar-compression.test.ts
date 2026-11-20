/** Correctness, frame shape, and termination checks for RePair. */
import { describe, expect, it } from "vitest";
import mod from "./repair-grammar-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.type).toBe("character"));
    });
}

describe("RePair Grammar Compression", () => {
    const cases = ["", "a", "abc", "abababab", "abracadabra", "abracadabracadabra", "mississippi"];
    for (const text of cases) {
        it(`regenerates ${JSON.stringify(text)} losslessly`, () => {
            const frames = [...mod.run({ text })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["decoded"]).toBe(text);
            expect(String(final?.["final"]).length).toBeLessThanOrEqual(text.length);
        });
    }

    it("actually compresses a repetitive string", () => {
        const frames = [...mod.run({ text: "abcabcabcabcabc" })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const rules = final?.["rules"] as string[];
        expect(rules.length).toBeGreaterThan(0);
        expect(String(final?.["final"]).length).toBeLessThan("abcabcabcabcabc".length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
