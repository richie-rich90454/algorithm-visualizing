/**
 * bloom-filter-compressed.test.ts - Round-trip, membership, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bloom-filter-compressed";
import type { VisualFrame } from "@/types";

interface Input {
    keys?: number[];
    queries?: number[];
}

const M = 16;
const positions = (key: number): number[] => [
    (((key * 31 + 7) % M) + M) % M,
    (((key * 131 + 17) % M) + M) % M,
];

/** Independent decoder for the run-length encoding. */
function decode(encoding: number[], m: number): number[] {
    const out: number[] = [];
    for (let i = 0; i + 1 < encoding.length; i += 2) {
        for (let t = 0; t < (encoding[i + 1] ?? 0); t += 1) out.push(encoding[i] ?? 0);
    }
    return out.slice(0, m);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Compressed bloom filter", () => {
    it("round-trips the run-length encoding on every frame", () => {
        const input: Input = { keys: [5, 17, 9, 42], queries: [5, 17, 42] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        for (const frame of frames) {
            const bits = frame.meta["bits"] as number[];
            const encoding = frame.meta["encoding"] as number[];
            expect(bits.length).toBe(M);
            expect(encoding.length % 2).toBe(0);
            expect(decode(encoding, M)).toEqual(bits);
        }
    });

    it("never reports an inserted key as absent", () => {
        const input: Input = { keys: [3, 11, 27, 8], queries: [3, 11, 27, 8, 99] };
        const frames = [...mod.run(input)];
        const present = frames.filter((f) => typeof f.meta["present"] === "boolean");
        expect(present.length).toBe(input.queries!.length);
        for (const frame of present) {
            if ((input.keys ?? []).includes(frame.meta["queried"] as number)) {
                expect(frame.meta["present"]).toBe(true);
            }
        }
    });

    it("points each add at exactly the hashed positions", () => {
        const frames = [...mod.run({ keys: [5], queries: [] })];
        const addFrame = frames.find((f) => f.meta["added"] === 5);
        expect(addFrame).toBeDefined();
        const bits = addFrame?.meta["bits"] as number[];
        for (const j of positions(5)) expect(bits[j]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
