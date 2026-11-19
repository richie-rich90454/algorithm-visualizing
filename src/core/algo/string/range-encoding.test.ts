import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./range-encoding";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(frame.layout).toBe(module.visualType);
        expect(frame.meta).toBeDefined();
    });
}

describe("RangeEncoding", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("round-trips every message through a single integer tag", () => {
        const messages = ["a", "ab", "aab", "abracadabra", "aaaa", "abcabc", "mississippi", "zzzzzyx"];
        for (const message of messages) {
            const frames = [...module.run({ message })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.decoded).toBe(message);
            expect(last.meta.tagInside).toBe(true);
            const tag = BigInt(last.meta.tag as string);
            const low = BigInt(last.meta.low as string);
            const high = BigInt(last.meta.high as string);
            expect(tag >= low && tag < high).toBe(true);
        }
    });

    it("respects the length cap and never loops", () => {
        const long = "ab".repeat(40);
        const frames = [...module.run({ message: long })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!;
        expect(last.meta.length).toBe(32);
        expect(last.meta.decoded).toBe(long.slice(0, 32));
    });

    it("falls back to a default on empty input", () => {
        const frames = [...module.run({ message: "" })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta.decoded).toBe("abracadabra");
    });
});
