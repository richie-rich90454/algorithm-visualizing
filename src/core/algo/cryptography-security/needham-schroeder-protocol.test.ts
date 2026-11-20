/** needham-schroeder-protocol.test.ts - Mask involution, replay and tamper rejection, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { authenticate, mask, runNeedhamSchroeder } from "./needham-schroeder-protocol";
import type { NSSession } from "./needham-schroeder-protocol";
import type { VisualFrame } from "@/types";

const base: NSSession = {
    a: 1, b: 2, nonceA: 101, nonceB: 202, sessionKey: 777, keyAS: 55, keyBS: 99,
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Needham-Schroeder protocol (toy)", () => {
    it("uses an involutory mask", () => {
        for (let value = 0; value < 500; value += 1) {
            for (const key of [0, 1, 55, 99, 777]) {
                expect(mask(key, mask(key, value))).toBe(value);
            }
        }
    });

    it("authenticates an honest run and recovers the key at B", () => {
        for (const nonceB of [1, 2, 202, 4096]) {
            for (const sessionKey of [3, 777, 5000]) {
                const session: NSSession = { ...base, nonceB, sessionKey };
                const result = runNeedhamSchroeder(session);
                expect(result.messages.length).toBe(5);
                expect(result.sessionKeyAtB).toBe(sessionKey);
                expect(result.replyAtB).toBe(nonceB - 1);
                expect(result.authenticated).toBe(true);
            }
        }
    });

    it("rejects replayed tickets and tampered replies", () => {
        const fresh = runNeedhamSchroeder(base);
        const stale = runNeedhamSchroeder({ ...base, sessionKey: 444, nonceB: 909 });
        expect(authenticate(base, fresh.ticket, fresh.messages[4]?.value ?? 0)).toBe(true);
        expect(authenticate(base, stale.ticket, stale.messages[4]?.value ?? 0)).toBe(false);
        expect(authenticate(base, fresh.ticket, (fresh.messages[4]?.value ?? 0) ^ 1)).toBe(false);
        expect(authenticate({ ...base, nonceB: 203 }, fresh.ticket, fresh.messages[4]?.value ?? 0)).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["authenticated"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
