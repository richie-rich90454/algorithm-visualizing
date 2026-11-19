/**
 * dijkstra-scholten.test.ts - Termination-detection correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dijkstra-scholten";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number, expectedEdges: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(expectedEdges);
        expect(frame.edges.every((e) => e.sourceId.startsWith("node-") && e.targetId.startsWith("node-"))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dijkstra-Scholten termination detection", () => {
    const cases: Array<{ parent: number[]; busy: number[] }> = [
        { parent: [-1, 0, 0, 1, 1], busy: [2, 3, 4] },
        { parent: [-1, 0, 1, 2], busy: [3] },
        { parent: [-1, 0, 0, 0], busy: [1, 2, 3] },
        { parent: [-1, 0, -1, 2], busy: [1, 3] },
    ];

    it("eventually declares termination for various trees and busy sets", () => {
        for (const { parent, busy } of cases) {
            const n = parent.length;
            const frames = [...mod.run({ parent, busy, workTicks: 2 })];
            checkFrames(frames, n, parent.filter((p) => p >= 0).length);
            const final = frames[frames.length - 1]!.meta;
            expect(final["terminated"]).toBe(true);
            const finalBusy = final["busy"] as number[];
            expect(finalBusy.every((v) => v === 0)).toBe(true);
        }
    });

    it("never declares termination while work is pending", () => {
        for (const { parent, busy } of cases) {
            const frames = [...mod.run({ parent, busy, workTicks: 3 })];
            for (const frame of frames) {
                if (frame.meta["terminated"]) {
                    const busyFlags = frame.meta["busy"] as number[];
                    expect(busyFlags.every((v) => v === 0)).toBe(true);
                }
            }
        }
    });

    it("sends exactly one report per non-root process", () => {
        for (const { parent, busy } of cases) {
            const frames = [...mod.run({ parent, busy, workTicks: 2 })];
            const final = frames[frames.length - 1]!.meta;
            expect(Number(final["signals"])).toBe(parent.filter((p) => p >= 0).length);
            const reported = final["reported"] as number[];
            for (let i = 0; i < parent.length; i += 1) {
                if (parent[i] === -1) continue;
                expect(reported[i]).toBe(1);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
