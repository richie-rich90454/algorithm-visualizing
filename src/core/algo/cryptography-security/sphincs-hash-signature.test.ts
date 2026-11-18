/**
 * sphincs-hash-signature.test.ts - Signature validity, tamper detection, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sphincs-hash-signature";
import type { VisualFrame } from "@/types";

interface Input {
    message: string;
    leafIndex: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(7);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["parentId"] === "string")).toBe(true);
        expect(frame.edges.length).toBe(6);
        expect(frame.edges.every((e) => e.sourceId.startsWith("node-") && e.targetId.startsWith("node-"))).toBe(true);
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

describe("SPHINCS-style toy signature", () => {
    it("verifies honest signatures for many messages and leaves", () => {
        const messages = ["", "hello", "abc", "The quick brown fox", "post-quantum 2026"];
        for (const message of messages) {
            for (const leafIndex of [0, 1, 2, 3]) {
                const meta = finalMeta({ message, leafIndex });
                expect(meta["verified"]).toBe(true);
                expect(meta["tamperedVerified"]).toBe(false);
                const digits = meta["digits"] as number[];
                expect(digits).toHaveLength(4);
                expect(digits.every((d) => d >= 0 && d < 16)).toBe(true);
            }
        }
    });

    it("publishes a stable root for a fixed key set", () => {
        const roots = new Set<string>();
        for (const message of ["a", "b", "c"]) {
            roots.add(String(finalMeta({ message, leafIndex: 0 })["root"]));
        }
        expect(roots.size).toBe(1);
    });

    it("different leaves use different one-time keys but share the root", () => {
        const a = finalMeta({ message: "hello", leafIndex: 0 });
        const b = finalMeta({ message: "hello", leafIndex: 1 });
        expect(a["root"]).toBe(b["root"]);
        expect(a["authPath"]).not.toEqual(b["authPath"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
