/** spake2.test.ts - Matching and mismatched password property checks, share masking, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { MASK_M, MASK_N, passwordScalar, powMod, secretA, secretB, shareA, shareB } from "./spake2";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SPAKE2 (toy field)", () => {
    it("maps passwords deterministically into the scalar range", () => {
        for (const password of ["", "a", "shared secret", "another password"]) {
            const scalar = passwordScalar(password);
            expect(scalar).toBe(passwordScalar(password));
            expect(scalar).toBeGreaterThanOrEqual(0);
            expect(scalar).toBeLessThan(1000002);
        }
        expect(MASK_M).not.toBe(MASK_N);
    });

    it("derives the same key when both passwords match", () => {
        const passwords = ["pw", "shared secret", "a longer passphrase"];
        const pairs: Array<[number, number]> = [[1, 2], [314, 271], [17, 999]];
        for (const password of passwords) {
            for (const [x, y] of pairs) {
                const X = shareA(password, x);
                const Y = shareB(password, y);
                const keyA = secretA(password, x, Y);
                const keyB = secretB(password, y, X);
                expect(keyA).toBe(keyB);
                expect(keyA).toBeGreaterThan(0);
                expect(keyA).toBe(powMod(2, x * y, 1000003));
            }
        }
    });

    it("derives different keys and hides raw shares when passwords differ", () => {
        const x = 314;
        const y = 271;
        const X = shareA("alice password", x);
        const Y = shareB("bob password", y);
        const keyA = secretA("alice password", x, Y);
        const keyB = secretB("bob password", y, X);
        expect(keyA).not.toBe(keyB);
        expect(X).not.toBe(powMod(2, x, 1000003));
        expect(Y).not.toBe(powMod(2, y, 1000003));
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["matched"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
