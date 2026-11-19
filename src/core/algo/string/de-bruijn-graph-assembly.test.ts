/**
 * de-bruijn-graph-assembly.test.ts - Brute-force k-mer multiset check,
 * frame shape, and termination for de Bruijn graph assembly.
 */

import { describe, expect, it } from "vitest";
import mod from "./de-bruijn-graph-assembly";

function kmers(text: string, k: number): string[] {
    const result: string[] = [];
    for (let i = 0; i + k <= text.length; i += 1) {
        result.push(text.slice(i, i + k));
    }
    return result;
}

function sorted(values: string[]): string[] {
    return [...values].sort();
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("de Bruijn Graph Assembly", () => {
    it("reconstructs a string whose k-mers equal the input reads", () => {
        const input = mod.defaultInput as { text: string; k: number };
        const reads = kmers(input.text, input.k);
        const frames = [...mod.run({ reads })];
        const last = frames[frames.length - 1];
        const assembled = last?.meta.assembled as string;
        expect(assembled).toHaveLength(input.k - 1 + reads.length);
        expect(sorted(kmers(assembled, input.k))).toEqual(sorted(reads));
        expect(last?.meta.edgesUsed).toBe(reads.length);
    });

    it("is independent of the order in which reads arrive", () => {
        const random = seeded(31337);
        const base = "abcababcab";
        const k = 3;
        const reads = kmers(base, k);
        for (let trial = 0; trial < 40; trial += 1) {
            const shuffled = [...reads];
            for (let i = shuffled.length - 1; i > 0; i -= 1) {
                const j = Math.floor(random() * (i + 1));
                const temp = shuffled[i] as string;
                shuffled[i] = shuffled[j] as string;
                shuffled[j] = temp;
            }
            const frames = [...mod.run({ reads: shuffled, k })];
            const last = frames[frames.length - 1];
            const assembled = last?.meta.assembled as string;
            expect(sorted(kmers(assembled, k)), `trial ${trial}`).toEqual(sorted(reads));
            expect(last?.meta.edgesUsed).toBe(reads.length);
        }
    });

    it("agrees with brute force on random source strings", () => {
        const random = seeded(778899);
        const alphabet = "abcd";
        for (let trial = 0; trial < 60; trial += 1) {
            const length = 4 + Math.floor(random() * 12);
            let text = "";
            for (let i = 0; i < length; i += 1) {
                text += alphabet[Math.floor(random() * alphabet.length)];
            }
            const k = 3;
            const reads = kmers(text, k);
            const last = [...mod.run({ reads, k })].pop();
            const assembled = last?.meta.assembled as string;
            expect(assembled, `trial ${trial}`).toHaveLength(k - 1 + reads.length);
            expect(sorted(kmers(assembled, k)), `trial ${trial}`).toEqual(sorted(reads));
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as { text: string; k: number };
        const frames = [...mod.run(input)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("graph");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
            for (const e of frame.entities) {
                expect(e.type).toBe("node");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
        });
    });

    it("handles empty reads", () => {
        const frames = [...mod.run({ reads: [] })];
        expect(frames).toHaveLength(2);
        expect(frames[frames.length - 1]?.meta.assembled).toBe("");
        expect(frames[frames.length - 1]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
