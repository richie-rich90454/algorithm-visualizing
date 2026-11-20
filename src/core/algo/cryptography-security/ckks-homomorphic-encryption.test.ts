/**
 * ckks-homomorphic-encryption.test.ts - Homomorphic add/multiply approximation, scale levels, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, {
    CKKS_DELTA,
    ckksAdd,
    ckksDecrypt,
    ckksEncode,
    ckksEncrypt,
    ckksMul,
} from "./ckks-homomorphic-encryption";
import type { VisualFrame } from "@/types";

type Input = { a: number[]; b: number[] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CKKS-style toy homomorphic encryption", () => {
    it("encrypts, decrypts, adds, and multiplies approximately", () => {
        const cases: Input[] = [
            { a: [1.5, -2.25], b: [0.5, 3] },
            { a: [0, 0], b: [2, -1] },
            { a: [-3.5, 4.25, 0.75], b: [1.25, -0.5, 2] },
            { a: [0.125, 7], b: [-7, 0.125] },
        ];
        for (const { a, b } of cases) {
            const za = ckksEncode(a);
            const zb = ckksEncode(b);
            const ca = ckksEncrypt(za, 1);
            const cb = ckksEncrypt(zb, 2);
            ckksDecrypt(ca).forEach((v, i) => expect(v).toBeCloseTo(a[i] ?? 0, 2));
            ckksDecrypt(cb).forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? 0, 2));
            ckksDecrypt(ckksAdd(ca, cb)).forEach((v, i) => expect(v).toBeCloseTo((a[i] ?? 0) + (b[i] ?? 0), 2));
            ckksDecrypt(ckksMul(ca, cb)).forEach((v, i) => expect(v).toBeCloseTo((a[i] ?? 0) * (b[i] ?? 0), 2));
            expect(ckksAdd(ca, cb).level).toBe(1);
            expect(ckksMul(ca, cb).level).toBe(2);
            expect(CKKS_DELTA).toBe(4096);
        }
    });

    it("masks encoded values so raw ciphertext parts do not reveal them", () => {
        const encoded = ckksEncode([1.5, -2.25]);
        const ct = ckksEncrypt(encoded, 3);
        expect(ct.c0.some((v, i) => v !== encoded[i])).toBe(true);
        expect(ct.c1.length).toBe(encoded.length);
    });

    it("reports small approximation errors in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(final["addError"] as number).toBeLessThan(0.01);
        expect(final["mulError"] as number).toBeLessThan(0.01);
        expect(String(final["note"])).toContain("not secure");
        const decAdd = final["decAdd"] as number[];
        const expectedAdd = final["expectedAdd"] as number[];
        decAdd.forEach((v, i) => expect(v).toBeCloseTo(expectedAdd[i] ?? 0, 2));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
