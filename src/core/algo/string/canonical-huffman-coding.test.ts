import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./canonical-huffman-coding";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

function optimalCost(text: string): number {
    const freq = new Map<string, number>();
    for (const ch of text) freq.set(ch, (freq.get(ch) ?? 0) + 1);
    const weights = [...freq.values()].sort((a, b) => a - b);
    if (weights.length <= 1) return weights[0] ?? 0;
    let cost = 0;
    while (weights.length > 1) {
        const a = weights.shift()!;
        const b = weights.shift()!;
        const sum = a + b;
        cost += sum;
        weights.push(sum);
        weights.sort((x, y) => x - y);
    }
    return cost;
}

describe("Canonical Huffman Coding", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("produces prefix-free optimal codes that round-trip", () => {
        for (const text of ["abracadabra", "aab", "mississippi", "aaa", "abcabc", ""]) {
            const frames = [...module.run({ text })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const codes = last.meta.codes as Record<string, string>;
            const words = Object.values(codes);
            for (let i = 0; i < words.length; i += 1) {
                for (let j = 0; j < words.length; j += 1) {
                    if (i !== j) expect(words[j]!.startsWith(words[i]!)).toBe(false);
                }
            }
            let cost = 0;
            for (const [sym, code] of Object.entries(codes)) {
                cost += (text.split(sym).length - 1) * code.length;
            }
            expect(cost).toBe(optimalCost(text));
            const encoded = last.meta.encoded as string;
            expect(encoded.length).toBe(last.meta.totalBits);
            let decoded = "";
            const reverse: Record<string, string> = {};
            for (const [sym, code] of Object.entries(codes)) reverse[code] = sym;
            let buffer = "";
            for (const bit of encoded) {
                buffer += bit;
                if (reverse[buffer] !== undefined) {
                    decoded += reverse[buffer];
                    buffer = "";
                }
            }
            expect(decoded).toBe(text);
        }
    });
});
