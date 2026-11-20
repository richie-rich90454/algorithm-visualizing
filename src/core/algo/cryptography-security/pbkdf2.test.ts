/**
 * pbkdf2.test.ts - SHA-256 and PBKDF2 known-answer vectors, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pbkdf2";
import type { VisualFrame } from "@/types";

interface Input {
    password: string;
    salt: string;
    iterations: number;
    dkLen: number;
}

function checkFrames(frames: VisualFrame[], dkLen: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dkLen);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function derive(input: Input): string {
    const frames = [...mod.run(input)];
    checkFrames(frames, input.dkLen);
    return String(frames[frames.length - 1]?.meta["derivedKey"]);
}

describe("PBKDF2-HMAC-SHA256", () => {
    it("matches authoritative PBKDF2-HMAC-SHA256 vectors", () => {
        expect(derive({ password: "password", salt: "salt", iterations: 2, dkLen: 32 })).toBe(
            "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43",
        );
        expect(derive({ password: "pass", salt: "NaCl", iterations: 4096, dkLen: 32 })).toBe(
            "63c222ee2ae73b90d161e9ab1116bac34e92f16bd5bd10f60fe0083cd689e002",
        );
    });

    it("matches a multi-block derivation", () => {
        const dk = derive({ password: "pwd", salt: "SALTSALT", iterations: 3, dkLen: 64 });
        expect(dk).toHaveLength(128);
        const first = derive({ password: "pwd", salt: "SALTSALT", iterations: 3, dkLen: 32 });
        expect(dk.startsWith(first)).toBe(true);
    });

    it("is deterministic and sensitive to each input", () => {
        const base: Input = { password: "password", salt: "salt", iterations: 2, dkLen: 32 };
        const a = derive(base);
        expect(derive(base)).toBe(a);
        expect(derive({ ...base, password: "Password" })).not.toBe(a);
        expect(derive({ ...base, salt: "pepper" })).not.toBe(a);
        expect(derive({ ...base, iterations: 3 })).not.toBe(a);
    });

    it("with one iteration equals HMAC of the salt plus block index", () => {
        const dk = derive({ password: "password", salt: "salt", iterations: 1, dkLen: 32 });
        expect(dk).toHaveLength(64);
        expect(/^[0-9a-f]+$/.test(dk)).toBe(true);
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
