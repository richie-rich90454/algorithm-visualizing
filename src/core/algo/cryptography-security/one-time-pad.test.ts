/**
 * one-time-pad.test.ts - Modular arithmetic brute force, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./one-time-pad";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBeGreaterThan(cols);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cols * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("OneTimePad", () => {
    it("matches the modular addition formula for every key letter", () => {
        const plain = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let shift = 0; shift < 26; shift += 1) {
            const key = String.fromCharCode(65 + shift).repeat(26);
            const frames = [...mod.run({ plaintext: plain, key })];
            checkFrames(frames, 26);
            const cipher = String(frames[frames.length - 1]?.meta["ciphertext"]);
            expect(cipher.length).toBe(26);
            for (let i = 0; i < 26; i += 1) {
                const expected = String.fromCharCode(65 + ((i + shift) % 26));
                expect(cipher[i]).toBe(expected);
            }
        }
    });

    it("round-trips many messages and keys", () => {
        const messages = ["", "A", "ATTACKDAWN", "MEETMEATMIDNIGHT", "Z".repeat(40)];
        const keys = ["", "K", "STREAM", "Q", "ABCXYZ"];
        for (const plaintext of messages) {
            for (const key of keys) {
                const frames = [...mod.run({ plaintext, key })];
                checkFrames(frames, plaintext.length);
                const meta = frames[frames.length - 1]?.meta;
                expect(meta?.["plaintext"]).toBe(plaintext);
                expect(meta?.["ciphertext"]).toHaveLength(plaintext.length);
            }
        }
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
