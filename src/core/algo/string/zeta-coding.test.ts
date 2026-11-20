/**
 * zeta-coding.test.ts - Property-correctness, frame-shape, and termination checks.
 */
import { describe, expect, it } from "vitest";
import mod, { zetaDecode, zetaEncode } from "./zeta-coding";

function allFrames(input: unknown) {
    return [...mod.run(input)];
}

describe("Zeta Coding", () => {
    it("round-trips every integer over a wide range", () => {
        for (let n = 1; n <= 1000; n += 1) {
            expect(zetaDecode(zetaEncode(n))).toEqual([n]);
        }
        for (const n of [4095, 4096, 100000, 1048576, 2147483647]) {
            expect(zetaDecode(zetaEncode(n))).toEqual([n]);
        }
    });

    it("round-trips concatenated streams without separators", () => {
        const lists = [
            [1, 2, 3, 4, 5],
            [1, 1, 1],
            [2, 9, 40, 7, 1000, 3],
            Array.from({ length: 40 }, (_, i) => i * i + 1),
        ];
        for (const list of lists) {
            const bits = list.map(zetaEncode).join("");
            expect(zetaDecode(bits)).toEqual(list);
        }
    });

    it("produces a prefix-free code, so decoding is unambiguous", () => {
        const codes = Array.from({ length: 200 }, (_, i) => zetaEncode(i + 1));
        const set = new Set(codes);
        expect(set.size).toBe(codes.length);
        for (let i = 0; i < codes.length; i += 1) {
            for (let j = i + 1; j < codes.length; j += 1) {
                const a = codes[i] as string;
                const b = codes[j] as string;
                const shorter = a.length <= b.length ? a : b;
                const longer = a.length <= b.length ? b : a;
                expect(longer.startsWith(shorter)).toBe(false);
            }
        }
    });

    it("emits a verified round trip for the default input", () => {
        const frames = allFrames(mod.defaultInput);
        const final = frames[frames.length - 1];
        expect(final).toBeDefined();
        expect(final?.meta["roundTrip"]).toBe(true);
        expect(final?.meta["bits"]).toBe((final?.meta["codes"] as string[]).join(""));
        expect(zetaDecode(final?.meta["bits"] as string)).toEqual(
            (mod.defaultInput as { numbers: number[] }).numbers,
        );
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = allFrames({ numbers: [1, 4, 9, 16, 25, 36, 49, 64] });
        expect(frames.length).toBeGreaterThan(1);
        expect(frames.length).toBeLessThan(30);
        const lines = (mod.pseudocode ?? []).length;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(lines);
            expect(frame.layout).toBe("text");
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.meta).toBeDefined();
            expect(typeof frame.meta["roundTrip"]).toBe("boolean");
        });
    });
});
