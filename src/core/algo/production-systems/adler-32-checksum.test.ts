/**
 * adler-32-checksum.test.ts - Canonical check values, independent reference,
 * sensitivity, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adler-32-checksum";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], byteCount: number): void {
    expect(frames.length).toBe(byteCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(byteCount);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(byteCount);
    });
}

function adlerOf(text: string): number {
    return Number([...mod.run({ text })].at(-1)?.meta["checksum"]);
}

/** Direct modular sums using a different word form than the module. */
function reference(bytes: number[]): number {
    let a = 1;
    let b = 0;
    for (const byte of bytes) {
        a += byte;
        if (a >= 65521) {
            a -= 65521;
        }
        b += a;
        b %= 65521;
    }
    return b * 65536 + a;
}

describe("Adler32Checksum", () => {
    it("matches the canonical published check values", () => {
        const vectors: Array<[string, number]> = [
            ["Wikipedia", 0x11e60398],
            ["123456789", 0x091e01de],
            ["a", 0x00620062],
            ["", 0x00000001],
        ];
        for (const [text, expected] of vectors) {
            const frames = [...mod.run({ text })];
            checkFrames(frames, text.length);
            expect(frames[frames.length - 1]?.meta["checksum"]).toBe(expected);
        }
    });

    it("agrees with an independent modular implementation on varied byte arrays", () => {
        const cases = [
            [0, 1, 2, 255],
            [65, 66, 67, 68, 69],
            [31, 47, 59, 71, 73, 97, 101, 103],
            Array.from({ length: 200 }, (_, i) => (i * 37) % 256),
        ];
        for (const bytes of cases) {
            const frames = [...mod.run({ bytes })];
            checkFrames(frames, bytes.length);
            expect(frames[frames.length - 1]?.meta["checksum"]).toBe(reference(bytes));
            const as = frames[frames.length - 1]?.meta["as"] as number[];
            const bs = frames[frames.length - 1]?.meta["bs"] as number[];
            expect(as.length).toBe(bytes.length);
            expect(bs.length).toBe(bytes.length);
            for (let i = 0; i < bytes.length; i += 1) {
                expect(as[i]!).toBeGreaterThanOrEqual(0);
                expect(as[i]!).toBeLessThan(65521);
                expect(bs[i]!).toBeGreaterThanOrEqual(0);
                expect(bs[i]!).toBeLessThan(65521);
            }
        }
    });

    it("changes when a single byte changes", () => {
        const original = adlerOf("a message long enough to modify");
        const bytes = Array.from("a message long enough to modify", (c) => c.charCodeAt(0));
        bytes[12]! = (bytes[12]! + 1) & 0xff;
        const changed = [...mod.run({ bytes })].at(-1)?.meta["checksum"];
        expect(changed).not.toBe(original);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
