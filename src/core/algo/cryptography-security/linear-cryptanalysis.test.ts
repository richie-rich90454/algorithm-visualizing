/** linear-cryptanalysis.test.ts - Key recovery, bias search, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./linear-cryptanalysis";
import type { VisualFrame } from "@/types";

const SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7];
const parity = (mask: number, value: number): number => {
    let bits = mask & value;
    let result = 0;
    while (bits > 0) {
        result ^= bits & 1;
        bits >>>= 1;
    }
    return result;
};
const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("linear cryptanalysis toy", () => {
    it("recovers every possible key from the linear bias", () => {
        for (let key = 0; key < 16; key += 1) {
            const frames = [...mod.run({ key })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            expect(meta["correct"]).toBe(true);
            expect(meta["recovered"]).toBe(key);
            let fromEvidence = 0;
            for (const entry of meta["evidence"] as string[]) {
                const [mask, , , , bit] = entry.split(":").map(Number);
                if (bit === 1) fromEvidence |= mask as number;
            }
            expect(fromEvidence).toBe(key);
        }
    });

    it("finds the true best S-box mask pair by exhaustive search", () => {
        let best = { x: 0, y: 0, count: 8 };
        for (let x = 1; x < 16; x += 1) {
            for (let y = 1; y < 16; y += 1) {
                let count = 0;
                for (let u = 0; u < 16; u += 1) if (parity(x, u) === parity(y, SBOX[u] as number)) count += 1;
                if (Math.abs(count - 8) > Math.abs(best.count - 8)) best = { x, y, count };
            }
        }
        const meta = finalMeta([...mod.run({ key: 3 })]);
        expect(meta["inputMask"]).toBe(best.x);
        expect(meta["outputMask"]).toBe(best.y);
        expect(meta["count"]).toBe(best.count);
        expect(meta["bias"]).toBe(Math.abs(best.count - 8));
        expect((meta["bestTable"] as string[]).length).toBe(225);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
