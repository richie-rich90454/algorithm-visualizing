/**
 * slh-dsa.test.ts - Exhaustive chunk verification, tamper detection, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./slh-dsa";
import type { VisualFrame } from "@/types";

type Input = { message?: string; chunks?: number[] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["tree"] === "number")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalMeta(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("SLH-DSA teaching core (toy FORS)", () => {
    it("verifies every possible two-chunk digest and detects a one-chunk change", () => {
        const roots = new Set<string>();
        for (let c0 = 0; c0 < 4; c0 += 1) {
            for (let c1 = 0; c1 < 4; c1 += 1) {
                const meta = finalMeta({ chunks: [c0, c1] });
                expect(meta["verified"]).toBe(true);
                expect(meta["tamperedVerified"]).toBe(false);
                expect(meta["chunks"]).toEqual([(c0 + 1) % 4, c1]);
                roots.add(String(meta["pk"]));
            }
        }
        expect(roots.size).toBe(1);
    });

    it("accepts message digests and reports the chunk paths", () => {
        for (const message of ["", "a", "hello", "post-quantum"]) {
            const meta = finalMeta({ message });
            const chunks = meta["chunks"] as number[];
            expect(chunks).toHaveLength(2);
            expect(chunks.every((c) => c >= 0 && c < 4)).toBe(true);
            expect(meta["verified"]).toBe(true);
            expect((meta["sig"] as string[]).length).toBe(2);
            expect((meta["paths"] as string[]).length).toBe(4);
        }
    });

    it("labels the toy scope in the final frame", () => {
        const meta = finalMeta({ message: "hello" });
        expect(String(meta["note"])).toContain("not secure");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
