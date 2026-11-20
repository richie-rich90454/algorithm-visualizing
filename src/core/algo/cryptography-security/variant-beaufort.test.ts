/** variant-beaufort.test.ts - Round-trip, reference, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./variant-beaufort";
import type { VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

/** Independent reference using character codes and a repeating key. */
function reference(text: string, key: string, mode: Mode): string {
    const letters = [...key].filter((c) => /[A-Za-z]/.test(c)).map((c) => c.toUpperCase());
    let ki = 0;
    let out = "";
    for (const ch of text) {
        if (!/[A-Za-z]/.test(ch)) {
            out += ch;
            continue;
        }
        const k = letters[ki % letters.length] as string;
        ki += 1;
        const p = ch.toUpperCase().charCodeAt(0) - 65;
        const kval = k.charCodeAt(0) - 65;
        const v = mode === "encrypt" ? p - kval : p + kval;
        out += String.fromCharCode(65 + (((v % 26) + 26) % 26));
    }
    return out;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const final = (frames: VisualFrame[]) => String(frames[frames.length - 1]?.meta["output"]);

describe("Variant Beaufort Cipher", () => {
    it("matches the independent reference on several inputs", () => {
        const cases: Array<{ text: string; key: string; mode: Mode }> = [
            { text: "ATTACKATDAWN", key: "KEYWORD", mode: "encrypt" },
            { text: "QEBIBPQDUXQVI", key: "KEYWORD", mode: "decrypt" },
            { text: "Meet me at 7!", key: "LEMON", mode: "encrypt" },
            { text: "Zzzz", key: "abcdefghij", mode: "encrypt" },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames, [...c.text].length);
            expect(final(frames)).toBe(reference(c.text, c.key, c.mode));
        }
    });

    it("round-trips every case and differs from ordinary Beaufort and Vigenere", () => {
        const text = "ATTACKATDAWN";
        const key = "KEYWORD";
        const enc = final([...mod.run({ text, key, mode: "encrypt" })]);
        const dec = final([...mod.run({ text: enc, key, mode: "decrypt" })]);
        expect(dec).toBe(text);
        const beaufort = [...text].map((ch, i) => {
            const p = ch.charCodeAt(0) - 65;
            const k = key[i % key.length]!.charCodeAt(0) - 65;
            return String.fromCharCode(65 + (((k - p) % 26 + 26) % 26));
        }).join("");
        const vigenere = [...text].map((ch, i) => {
            const p = ch.charCodeAt(0) - 65;
            const k = key[i % key.length]!.charCodeAt(0) - 65;
            return String.fromCharCode(65 + ((p + k) % 26));
        }).join("");
        expect(enc).not.toBe(beaufort);
        expect(enc).not.toBe(vigenere);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(generator.next().done).toBe(true);
        expect(count).toBeGreaterThan(1);
    });
});
