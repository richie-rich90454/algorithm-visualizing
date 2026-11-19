import { describe, expect, it } from "vitest";
import mod, { ctrBlock, ctrTransform } from "./counter-mode";
import type { VisualFrame } from "@/types";

function reference(blocks: number[], key: number, counter: number): number[] {
    const stream = (c: number): number => ((((c ^ key) * 7 + 13) % 256) + 256) % 256;
    return blocks.map((block, i) => block ^ stream((counter + i) % 256));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Number(frame.meta["rows"])).toBe(3);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 8);
        expect(frame.meta).toBeDefined();
    });
}

describe("Counter Mode (Toy Cipher)", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["roundTrip"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("matches an independent oracle and round-trips random messages", () => {
        let seed = 24680;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const length = 1 + rand(12);
            const plaintext = Array.from({ length }, () => rand(256));
            const key = rand(256);
            const counter = rand(256);
            const result = ctrTransform(plaintext, key, counter);
            expect(result.ciphertext).toEqual(reference(plaintext, key, counter));
            expect(ctrTransform(result.ciphertext, key, counter).ciphertext).toEqual(plaintext);
        }
    });

    it("masks equal plaintext bytes differently at different counters", () => {
        const result = ctrTransform([9, 9, 9], 91, 5);
        expect(new Set(result.keystream).size).toBe(3);
        expect(new Set(result.ciphertext).size).toBe(3);
        expect(ctrBlock(5, 91)).toBe(result.keystream[0]);
    });
});
