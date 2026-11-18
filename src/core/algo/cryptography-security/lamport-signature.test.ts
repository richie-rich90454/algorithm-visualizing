/**
 * lamport-signature.test.ts - Exhaustive bit-vector verification, tamper detection, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { lamportPublic, lamportSecret, lamportSign, lamportVerify } from "./lamport-signature";
import type { VisualFrame } from "@/types";

type Input = { message?: string; bits?: number[] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalMeta(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("Lamport one-time signature (toy)", () => {
    it("verifies all 16 four-bit vectors and rejects a one-bit change", () => {
        const roots = new Set<string>();
        for (let value = 0; value < 16; value += 1) {
            const bits = Array.from({ length: 4 }, (_, i) => (value >>> i) & 1);
            const meta = finalMeta({ bits });
            expect(meta["verified"]).toBe(true);
            expect(meta["tamperedVerified"]).toBe(false);
            expect(meta["bits"]).toEqual([1 - (bits[0] ?? 0), bits[1], bits[2], bits[3]]);
            roots.add((meta["pk"] as string[]).join(","));
        }
        expect(roots.size).toBe(1);
    });

    it("keeps zero and one public values distinct at each position", () => {
        for (let i = 0; i < 4; i += 1) {
            expect(lamportPublic(i, 0)).not.toBe(lamportPublic(i, 1));
            expect(lamportSecret(i, 0)).not.toBe(lamportSecret(i, 1));
        }
        const bits = [1, 0, 1, 1];
        expect(lamportVerify(lamportSign(bits), bits)).toBe(true);
        expect(lamportVerify(lamportSign(bits), [0, 0, 1, 1])).toBe(false);
    });

    it("derives consistent bits from a message", () => {
        for (const message of ["", "a", "hello", "lamport"]) {
            const meta = finalMeta({ message });
            expect((meta["bits"] as number[]).length).toBe(4);
            expect((meta["bits"] as number[]).every((b) => b === 0 || b === 1)).toBe(true);
            expect(meta["verified"]).toBe(true);
        }
        expect(String(finalMeta({ message: "hello" })["note"])).toContain("not secure");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
