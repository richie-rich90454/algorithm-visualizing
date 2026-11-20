/**
 * hmac.test.ts - Independent HMAC construction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hmac";
import type { VisualFrame } from "@/types";

function hash(bytes: number[]): number {
    let acc = 2166136261;
    for (const b of bytes) acc = Math.imul(acc ^ b, 16777619) >>> 0;
    return acc >>> 0;
}
function toBytes(text: string): number[] {
    return [...text].map((c) => c.charCodeAt(0) & 0xff);
}
function fromInt(value: number): number[] {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}
function hex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}
function reference(key: string, message: string): string {
    let kb = toBytes(key);
    if (kb.length > 8) kb = fromInt(hash(kb));
    const block = new Array<number>(8).fill(0);
    kb.forEach((b, i) => { block[i] = b; });
    const ipad = block.map((b) => b ^ 0x36);
    const opad = block.map((b) => b ^ 0x5c);
    const inner = hash([...ipad, ...toBytes(message)]);
    return hex(fromInt(hash([...opad, ...fromInt(inner)])));
}

function checkFrames(frames: VisualFrame[], keyLen: number, msgLen: number): void {
    expect(frames.length).toBe(4);
    const cols = Math.max(8, msgLen, 4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(4);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Hmac", () => {
    it("matches the independent HMAC construction", () => {
        const cases: Array<[string, string]> = [
            ["secret", "HELLO"],
            ["", ""],
            ["a", "MESSAGE"],
            ["a-much-longer-key-than-eight-bytes", "PAYLOAD"],
            ["key", "X".repeat(20)],
        ];
        for (const [key, message] of cases) {
            const frames = [...mod.run({ key, message })];
            const keyLen = toBytes(key).length > 8 ? 4 : toBytes(key).length;
            checkFrames(frames, keyLen, toBytes(message).length);
            const final = frames[frames.length - 1];
            expect(final?.meta["mac"]).toBe(reference(key, message));
        }
    });

    it("changes the MAC when the message or key changes", () => {
        const base = [...mod.run({ key: "key", message: "HELLO" })][3]?.meta["mac"];
        const changedMsg = [...mod.run({ key: "key", message: "HELLP" })][3]?.meta["mac"];
        const changedKey = [...mod.run({ key: "kez", message: "HELLO" })][3]?.meta["mac"];
        expect(base).not.toBe(changedMsg);
        expect(base).not.toBe(changedKey);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
