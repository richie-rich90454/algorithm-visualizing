/** quic-handshake.test.ts - Independent flight/loss reference, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./quic-handshake";
import type { VisualFrame } from "@/types";

const FLIGHT_SIZES = [1, 3, 2];

/** Reference key schedule, written independently from the module. */
function referenceSecret(clientNonce: string, serverNonce: string): string {
    let h = 2166136261;
    for (const ch of `${clientNonce}|${serverNonce}`) {
        h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

/** Brute-force replay of the flight/loss loop to predict sends and losses. */
function referenceHandshake(lossPattern: boolean[]) {
    let sent = 0;
    let lost = 0;
    let complete = true;
    for (const size of FLIGHT_SIZES) {
        const acked = new Set<number>();
        let attempt = 0;
        while (acked.size < size && attempt < 50) {
            attempt += 1;
            for (let m = 0; m < size; m += 1) {
                if (acked.has(m)) continue;
                const isLost = lossPattern[sent % lossPattern.length] ?? false;
                sent += 1;
                if (isLost) lost += 1;
                else acked.add(m);
            }
        }
        if (acked.size < size) complete = false;
    }
    return { sent, lost, complete };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(9);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("QUIC Handshake", () => {
    it("matches the reference send and loss counts across loss patterns", () => {
        const patterns: boolean[][] = [
            [false],
            [true, false, false],
            [true, true, false, false, false],
            [false, true, false, true, false, false, false],
        ];
        for (const lossPattern of patterns) {
            const frames = [...mod.run({ clientNonce: "c", serverNonce: "s", lossPattern })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = referenceHandshake(lossPattern);
            expect(Number(final?.["sent"])).toBe(expected.sent);
            expect(Number(final?.["lost"])).toBe(expected.lost);
            expect(final?.["complete"]).toBe(expected.complete);
        }
    });

    it("derives identical secrets on both sides when the handshake completes", () => {
        const final = [...mod.run({ clientNonce: "alpha", serverNonce: "beta", lossPattern: [true, false] })].at(-1)?.meta;
        expect(final?.["complete"]).toBe(true);
        expect(final?.["clientSecret"]).toBe(final?.["serverSecret"]);
        expect(final?.["clientSecret"]).toBe(referenceSecret("alpha", "beta"));
        expect(String(final?.["secret"])).toHaveLength(8);
    });

    it("stops cleanly when no packet is ever delivered", () => {
        const final = [...mod.run({ lossPattern: [true] })].at(-1)?.meta;
        expect(final?.["complete"]).toBe(false);
        expect(Number(final?.["sent"])).toBeLessThanOrEqual(1 * 50 * 6);
    });

    it("emits one frame per packet attempt", () => {
        const frames = [...mod.run({ lossPattern: [false] })];
        // setup + 6 delivered packets + final
        expect(frames.length).toBe(8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
