/**
 * blake2s.test.ts - RFC 7693 known-answer vectors, determinism and diffusion, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./blake2s";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            expect(Number.isInteger(entity.value as number)).toBe(true);
        }
    });
}

function digestOf(message: string): string {
    const frames = [...mod.run({ message })];
    checkFrames(frames);
    return frames[frames.length - 1]!.meta["digest"] as string;
}

describe("Blake2s", () => {
    it("matches RFC 7693 known-answer vectors", () => {
        expect(digestOf("")).toBe("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9");
        expect(digestOf("abc")).toBe("508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982");
    });

    it("is deterministic and produces a 256-bit digest", () => {
        for (const message of ["hello", "algorithm", "The quick brown fox jumps over the lazy dog", "a"]) {
            const first = digestOf(message);
            const second = digestOf(message);
            expect(first).toBe(second);
            expect(first).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it("changes the digest for every single-character variation tested", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 26; i += 1) {
            seen.add(digestOf(String.fromCharCode(97 + i)));
        }
        expect(seen.size).toBe(26);
    });

    it("shows a distinct working state after each of the ten rounds", () => {
        const frames = [...mod.run({ message: "abc" })];
        checkFrames(frames);
        const states = frames.slice(1, 11).map((f) => (f.meta["stateWords"] as number[]).join(","));
        expect(new Set(states).size).toBe(10);
        expect(frames[10]!.meta["round"]).toBe(10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
