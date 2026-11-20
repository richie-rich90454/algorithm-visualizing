/** scytale.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./scytale";
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

function refEncrypt(text: string, width: number): string {
    const chars = [...text];
    const rows = Math.ceil(chars.length / width);
    const out: string[] = [];
    for (let col = 0; col < width; col += 1) {
        for (let row = 0; row < rows; row += 1) {
            const idx = row * width + col;
            if (idx < chars.length) out.push(chars[idx] as string);
        }
    }
    return out.join("");
}

function refDecrypt(text: string, width: number): string {
    const chars = [...text];
    const rows = Math.ceil(chars.length / width);
    const rem = chars.length % width;
    const lengths = Array.from({ length: width }, (_, col) => (rem === 0 ? rows : col < rem ? rows : rows - 1));
    const grid: string[][] = Array.from({ length: rows }, () => new Array<string>(width).fill(""));
    let ptr = 0;
    for (let col = 0; col < width; col += 1) {
        for (let row = 0; row < lengths[col]!; row += 1) {
            const line = grid[row];
            if (line) line[col] = chars[ptr++] as string;
        }
    }
    const out: string[] = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < width; col += 1) {
            const value = grid[row]?.[col];
            if (value) out.push(value);
        }
    }
    return out.join("");
}

describe("Scytale", () => {
    it("matches an independent reference and round-trips", () => {
        const input = mod.defaultInput as { text: string; rails: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const encrypted = String(frames[frames.length - 1]?.meta["output"]);
        expect(encrypted).toBe(refEncrypt(input.text, input.rails));
        expect(refDecrypt(encrypted, input.rails)).toBe(input.text);

        const back = [...mod.run({ text: encrypted, rails: input.rails, mode: "decrypt" })];
        expect(back[back.length - 1]?.meta["output"]).toBe(input.text);
    });

    it("round-trips every length against the reference", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let seed = 1918;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 100; trial += 1) {
            const length = 1 + rand(30);
            const text = Array.from({ length }, () => alphabet[rand(26)]).join("");
            const width = 1 + rand(9);
            expect(refDecrypt(refEncrypt(text, width), width)).toBe(text);
            const frames = [...mod.run({ text, rails: width, mode: "encrypt" })];
            expect(frames[frames.length - 1]?.meta["output"]).toBe(refEncrypt(text, width));
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
