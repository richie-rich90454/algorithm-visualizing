/**
 * mceliece-encryption.test.ts - Brute-force code equation checks, round trips, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod, { buildMcEliece } from "./mceliece-encryption";
import type { VisualFrame } from "@/types";

interface Input {
    message: number;
    errorPosition: number;
    perm: number[];
}

const PERMS: number[][] = [
    [0, 1, 2, 3, 4, 5, 6],
    [2, 5, 0, 6, 1, 3, 4],
    [6, 3, 1, 4, 0, 2, 5],
];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(8);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent parity product: G_pub times H_priv transposed, mod 2. */
function parityProduct(gPub: number[][], hPriv: number[][]): boolean {
    for (let i = 0; i < gPub.length; i += 1) {
        for (let k = 0; k < hPriv.length; k += 1) {
            let sum = 0;
            for (let j = 0; j < gPub[i]!.length; j += 1) {
                sum += (gPub[i]![j] ?? 0) * (hPriv[k]![j] ?? 0);
            }
            if (sum % 2 !== 0) {
                return false;
            }
        }
    }
    return true;
}

describe("McEliece Encryption (Toy)", () => {
    it("exhaustively round-trips every message, error position, and permutation", () => {
        for (const perm of PERMS) {
            for (let message = 0; message < 16; message += 1) {
                for (let errorPosition = -1; errorPosition < 7; errorPosition += 1) {
                    const data = buildMcEliece(message, errorPosition, perm);
                    expect(parityProduct(data.gPub, data.hPriv)).toBe(true);
                    expect(data.errorFound).toBe(errorPosition);
                    expect(data.recovered).toBe(message);

                    // Recompute the ciphertext from scratch, independent of the helper.
                    for (let j = 0; j < 7; j += 1) {
                        let sum = j === errorPosition ? 1 : 0;
                        for (let i = 0; i < 4; i += 1) {
                            sum += data.messageBits[i]! * (data.gPub[i]![j] ?? 0);
                        }
                        expect(data.ciphertext[j]).toBe(sum % 2);
                    }
                    // Syndrome equals the error times the private parity check.
                    for (let k = 0; k < 3; k += 1) {
                        let sum = 0;
                        for (let j = 0; j < 7; j += 1) {
                            sum += (data.error[j] ?? 0) * (data.hPriv[k]![j] ?? 0);
                        }
                        expect(data.syndrome[k]).toBe(sum % 2);
                    }
                }
            }
        }
    });

    it("emits well-formed frames whose final metadata agrees with the helper", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = buildMcEliece(input.message, input.errorPosition, input.perm);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["recovered"]).toBe(expected.recovered);
        expect(final?.["agreed"]).toBe(true);
        expect(final?.["syndrome"]).toEqual(expected.syndrome);
        expect(final?.["errorFound"]).toBe(expected.errorFound);
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
