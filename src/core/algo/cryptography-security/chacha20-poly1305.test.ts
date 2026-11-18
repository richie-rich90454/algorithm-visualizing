/**
 * chacha20-poly1305.test.ts - RFC 8439 known-answer vectors, property checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chacha20-poly1305";
import type { VisualFrame } from "@/types";

const RFC_CHACHA_STATE = [
    0xe4e7f110, 0x15593bd1, 0x1fdd0f50, 0xc47120a3, 0xc7f4d1c7, 0x0368c033, 0x9aaa2204,
    0x4e6cd4c3, 0x466482d2, 0x09aa9f07, 0x05d7c214, 0xa2028bd9, 0xd19c12b5, 0xb94e16de,
    0xe883d0cb, 0x4e3c50a2,
];
const RFC_TAG = "a8061dc1305136c6c22b8baf0c0127a9";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(13);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(32);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => {
            const r = e.metadata["row"] as number;
            const c = e.metadata["col"] as number;
            return r >= 0 && r < 8 && c >= 0 && c < 4;
        })).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("ChaCha20-Poly1305 (teaching model)", () => {
    it("matches the RFC 8439 ChaCha20 block test vector", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const state = frames[frames.length - 2]?.meta["chachaState"] as number[];
        expect(state.map((w) => w >>> 0)).toEqual(RFC_CHACHA_STATE);
    });

    it("matches the RFC 8439 Poly1305 test vector", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const finalMeta = frames[frames.length - 1]?.meta ?? {};
        expect(finalMeta["tagHex"]).toBe(RFC_TAG);
        expect((finalMeta["tag"] as number[]).map((b) => b.toString(16).padStart(2, "0")).join("")).toBe(RFC_TAG);
    });

    it("the ChaCha state depends on the block counter and the tag on the message", () => {
        const input = mod.defaultInput as Record<string, unknown>;
        const a = [...mod.run(input)];
        const b = [...mod.run({ ...input, counter: 2 })];
        const c = [...mod.run({ ...input, message: "A different message" })];
        expect(a[0]?.meta["chachaState"]).not.toEqual(b[0]?.meta["chachaState"]);
        expect(a[a.length - 1]?.meta["tagHex"]).not.toBe(c[c.length - 1]?.meta["tagHex"]);
    });

    it("reveals the tag only on the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames[0]?.entities.filter((e) => e.id.startsWith("tag-")).every((e) => e.label === "??")).toBe(true);
        expect(frames[frames.length - 1]?.entities.filter((e) => e.id.startsWith("tag-")).every((e) => e.label !== "??")).toBe(true);
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
