/**
 * hill-cipher.test.ts - Hill cipher correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hill-cipher";
import type { VisualFrame } from "@/types";

const modv = (value: number, m: number): number => ((value % m) + m) % m;
const letter = (value: number): string => String.fromCharCode(65 + modv(value, 26));

/** Independent encryption using the key matrix on two-letter blocks. */
function referenceEncrypt(key: number[][], text: string): string {
    const padded = text.length % 2 === 1 ? `${text}X` : text;
    let out = "";
    for (let i = 0; i < padded.length; i += 2) {
        const p0 = padded.charCodeAt(i) - 65;
        const p1 = padded.charCodeAt(i + 1)! - 65;
        out += letter((key[0]![0]! * p0 + key[0]![1]! * p1));
        out += letter((key[1]![0]! * p0 + key[1]![1]! * p1));
    }
    return out;
}

function checkFrames(frames: VisualFrame[], chars: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(chars);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hill cipher", () => {
    it("encrypts like an independent reference and decrypts back", () => {
        const input = mod.defaultInput as { key: number[][]; message: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.message.length + 1);
        const final = frames[frames.length - 1]?.meta;
        const padded = `${input.message}X`;
        expect(final?.["ciphertext"]).toBe(referenceEncrypt(input.key, input.message));
        expect(final?.["decrypted"]).toBe(padded);
        expect(final?.["invertible"]).toBe(true);
    });

    it("round-trips a longer message", () => {
        const input = { key: [[3, 3], [2, 5]], message: "RETURN" };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["ciphertext"]).toBe(referenceEncrypt(input.key, input.message));
        expect(final?.["decrypted"]).toBe("RETURN");
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
