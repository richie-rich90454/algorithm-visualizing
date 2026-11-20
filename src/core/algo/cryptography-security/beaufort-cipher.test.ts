/** beaufort-cipher.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./beaufort-cipher";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const A = 65;
const value = (ch: string) => {
    const code = ch.toUpperCase().charCodeAt(0) - A;
    return code >= 0 && code < 26 ? code : -1;
};

function refBeaufort(text: string, key: string): string {
    const stream = [...key].map((ch) => ch.toUpperCase()).filter((ch) => value(ch) >= 0);
    let ki = 0;
    const out: string[] = [];
    for (const ch of [...text]) {
        const p = value(ch);
        if (p < 0) {
            out.push(ch);
            continue;
        }
        const k = value(stream[ki % stream.length] as string);
        ki += 1;
        out.push(String.fromCharCode(A + (((k - p) % 26) + 26) % 26));
    }
    return out.join("");
}

describe("Beaufort Cipher", () => {
    it("matches an independent reference and is its own inverse", () => {
        const input = mod.defaultInput as { text: string; key: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const cipher = String(frames[frames.length - 1]?.meta["output"]);
        expect(cipher).toBe(refBeaufort(input.text, input.key));
        expect(refBeaufort(cipher, input.key)).toBe(input.text);

        const back = [...mod.run({ text: cipher, key: input.key, mode: "decrypt" })];
        expect(back[back.length - 1]?.meta["output"]).toBe(input.text);
    });

    it("round-trips random mixed strings", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ,.!123";
        let seed = 1857;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 100; trial += 1) {
            const text = Array.from({ length: 1 + rand(30) }, () => alphabet[rand(alphabet.length)]).join("");
            const key = Array.from({ length: 1 + rand(8) }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[rand(26)]).join("");
            const frames = [...mod.run({ text, key, mode: "encrypt" })];
            const cipher = String(frames[frames.length - 1]?.meta["output"]);
            expect(cipher).toBe(refBeaufort(text, key));
            const back = [...mod.run({ text: cipher, key, mode: "decrypt" })];
            expect(back[back.length - 1]?.meta["output"]).toBe(text);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
