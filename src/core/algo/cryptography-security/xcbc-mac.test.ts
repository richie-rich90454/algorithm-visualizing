/**
 * xcbc-mac.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./xcbc-mac";
import type { VisualFrame } from "@/types";

const enc = (b: number, k: number): number => (((b ^ k) * 13) + 7) & 0xff;
function reference(message: number[], k1: number, k2: number): number {
    let state = 0;
    for (let i = 0; i < message.length - 1; i += 1) {
        state = enc(state ^ (message[i] ?? 0), k1);
    }
    return enc(state ^ (message[message.length - 1] ?? 0) ^ k2, k1);
}
function tagOf(input: unknown): { tag: number; frames: VisualFrame[] } {
    const frames = [...mod.run(input)];
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    return { tag: frames[frames.length - 1]?.meta["tag"] as number, frames };
}

describe("XCBC-MAC toy model", () => {
    it("matches an independent three-key reference over many messages", () => {
        const messages = [
            [5],
            [1, 2],
            [9, 8, 7, 6, 5],
            [3, 3, 3, 3, 3, 3, 3, 3],
        ];
        for (const message of messages) {
            for (const k1 of [0, 43, 200]) {
                const k2 = (k1 * 3 + 17) & 0xff;
                const k3 = (k1 * 7 + 91) & 0xff;
                const { tag } = tagOf({ message, k1, k2, k3 });
                expect(tag).toBe(reference(message, k1, k2));
            }
        }
    });

    it("is sensitive to message and key changes", () => {
        const base = { message: [1, 2, 3, 4], k1: 43, k2: 90, k3: 135 };
        const a = tagOf(base).tag;
        const b = tagOf({ ...base, message: [1, 2, 9, 4] }).tag;
        const c = tagOf({ ...base, k1: 44 }).tag;
        expect(a).not.toBe(b);
        expect(a).not.toBe(c);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
