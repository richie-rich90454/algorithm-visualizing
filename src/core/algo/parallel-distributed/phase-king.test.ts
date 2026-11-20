/**
 * phase-king.test.ts - Brute-force consensus properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./phase-king";
import type { VisualFrame } from "@/types";

function patterns(length: number): number[][] {
    const out: number[][] = [];
    for (let mask = 0; mask < 2 ** length; mask += 1) {
        out.push(Array.from({ length }, (_, i) => ((mask >> i) & 1)));
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("PhaseKing", () => {
    it("reaches agreement for every initial pattern (exhaustive n=4, one fault)", () => {
        const n = 4;
        const faulty = [0];
        for (const values of patterns(n)) {
            const frames = [...mod.run({ processes: n, values, faulty })];
            checkFrames(frames);
            const final = frames.at(-1)!;
            const correct = (final.meta["correct"] as number[]).filter((v) => v >= 0);
            expect(correct.length).toBe(n - 1);
            expect(correct.every((v) => v === correct[0])).toBe(true);
            expect(final.meta["decided"]).toBe(correct[0]);
        }
    });

    it("preserves validity: uniform correct inputs decide that value", () => {
        for (const n of [4, 5]) {
            for (const v of [0, 1]) {
                const faulty = [0];
                const values = Array.from({ length: n }, (_, i) => (i === 0 ? 1 - v : v));
                const frames = [...mod.run({ processes: n, values, faulty })];
                expect(frames.at(-1)!.meta["decided"]).toBe(v);
            }
        }
    });

    it("terminates within f+1 phases for several fault sets", () => {
        for (const faulty of [[], [0], [0, 1], [3]]) {
            const frames = [...mod.run({ processes: 4, values: [0, 1, 1, 0], faulty })];
            checkFrames(frames);
            const phases = faulty.length + 1;
            expect(frames.length).toBe(phases + 2);
        }
    });

    it("runs cleanly on the default input", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(2 + 2);
        expect(gen.next().done).toBe(true);
    });
});
