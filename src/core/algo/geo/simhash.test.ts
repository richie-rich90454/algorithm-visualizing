/** simhash.test.ts - Independent fingerprint reference, determinism, similarity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./simhash";
import type { VisualFrame } from "@/types";

function fnv(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function referenceFingerprint(tokens: string[]): number {
    const sums = new Array<number>(32).fill(0);
    for (const token of tokens) {
        const h = fnv(token);
        for (let bit = 0; bit < 32; bit += 1) {
            sums[bit] += (h & (1 << bit)) !== 0 ? 1 : -1;
        }
    }
    let fp = 0;
    for (let bit = 0; bit < 32; bit += 1) if (sums[bit] > 0) fp = (fp | (1 << bit)) >>> 0;
    return fp >>> 0;
}

function hamming(a: number, b: number): number {
    let x = (a ^ b) >>> 0;
    let count = 0;
    while (x > 0) {
        count += x & 1;
        x >>>= 1;
    }
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(32);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SimHash", () => {
    it("matches an independent fingerprint computation", () => {
        const input = mod.defaultInput as { tokens: string[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const expected = referenceFingerprint(input.tokens);
        expect(finalMeta?.["fp"]).toBe(expected);
        expect((finalMeta?.["bits"] as string).replace(/0/g, "").length).toBe(
            expected.toString(2).split("1").length - 1,
        );
    });

    it("is deterministic and locality-sensitive", () => {
        const input = mod.defaultInput as { tokens: string[]; compareTokens: string[][] };
        const first = [...mod.run(input)];
        const second = [...mod.run(input)];
        const fp1 = first[first.length - 1]?.meta["fp"];
        const fp2 = second[second.length - 1]?.meta["fp"];
        expect(fp1).toBe(fp2);

        const distances = first[first.length - 1]?.meta["distances"] as number[];
        expect(distances).toHaveLength(2);
        const similar = referenceFingerprint(input.compareTokens[0] as string[]);
        const unrelated = referenceFingerprint(input.compareTokens[1] as string[]);
        expect(distances[0]).toBe(hamming(fp1 as number, similar));
        expect(distances[1]).toBe(hamming(fp1 as number, unrelated));
        expect(distances[0]).toBeLessThan(distances[1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
