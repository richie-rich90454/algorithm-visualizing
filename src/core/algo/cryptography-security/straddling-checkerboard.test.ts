/** straddling-checkerboard.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./straddling-checkerboard";
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

const TOP: Record<string, string> = { E: "1", T: "2", A: "4", O: "5", I: "6", N: "7", S: "8", R: "0" };
const LOWER: Record<string, string> = { "3": "BCDFGHJKLM", "9": "PQUVWXYZ--" };
const MARKERS = new Set(["3", "9"]);

function refEncode(letters: string[]): string[] {
    return letters.map((letter) => {
        if (TOP[letter]) return TOP[letter] as string;
        for (const marker of ["3", "9"]) {
            const col = (LOWER[marker] as string).indexOf(letter);
            if (col >= 0) return marker + String(col);
        }
        return "";
    });
}

function refDecode(tokens: string[]): string {
    return tokens
        .map((token) => {
            const first = token[0] as string;
            if (MARKERS.has(first)) {
                const row = LOWER[first] as string;
                return row[Number(token[1])] === "-" ? "?" : (row[Number(token[1])] ?? "?");
            }
            return Object.keys(TOP).find((letter) => TOP[letter] === first) ?? "?";
        })
        .join("");
}

describe("Straddling Checkerboard", () => {
    it("round-trips the default message", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
        const letters = [...input.text].map((ch) => ch.toUpperCase()).filter((ch) => ch >= "A" && ch <= "Z");
        expect(tokens).toEqual(refEncode(letters));
        expect(refDecode(tokens)).toBe(letters.join(""));
        const back = [...mod.run({ text: tokens.join(""), mode: "decode" })];
        expect(back[back.length - 1]?.meta["output"]).toBe(letters.join(""));
    });

    it("round-trips random letter strings", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let seed = 3141;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 100; trial += 1) {
            const text = Array.from({ length: 1 + rand(25) }, () => alphabet[rand(26)]).join("");
            const frames = [...mod.run({ text, mode: "encode" })];
            const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
            expect(refDecode(tokens)).toBe(text);
            for (const token of tokens) expect(token.length >= 1 && token.length <= 2).toBe(true);
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
