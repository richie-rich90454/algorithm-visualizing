/**
 * caesar-cipher.test.ts - Exhaustive key checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./caesar-cipher";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBeGreaterThan(cols);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cols * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CaesarCipher", () => {
    it("matches the shift formula for all twenty-six keys", () => {
        const plain = "THEQUICKBROWNFOX";
        for (let shift = 0; shift < 26; shift += 1) {
            const frames = [...mod.run({ plaintext: plain, shift })];
            checkFrames(frames, plain.length);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["shift"]).toBe(shift);
            const cipher = String(meta?.["ciphertext"]);
            for (let i = 0; i < plain.length; i += 1) {
                const expected = String.fromCharCode(65 + ((plain.charCodeAt(i) - 65 + shift) % 26));
                expect(cipher[i]).toBe(expected);
            }
        }
    });

    it("handles negative and large shifts and round-trips", () => {
        for (const shift of [-29, -3, 0, 3, 26, 29, 257]) {
            const frames = [...mod.run({ plaintext: "ATTACKATDAWN", shift })];
            checkFrames(frames, 12);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["plaintext"]).toBe("ATTACKATDAWN");
            expect(meta?.["shift"]).toBe(((shift % 26) + 26) % 26);
        }
    });

    it("strips non-letters from the input", () => {
        const frames = [...mod.run({ plaintext: "Attack at dawn!", shift: 3 })];
        checkFrames(frames, 12);
        expect(frames[frames.length - 1]?.meta["plaintext"]).toBe("ATTACKATDAWN");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
