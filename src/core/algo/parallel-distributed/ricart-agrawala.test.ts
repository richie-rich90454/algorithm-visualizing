/**
 * ricart-agrawala.test.ts - Grant-order, mutual-exclusion, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ricart-agrawala";
import type { VisualFrame } from "@/types";

interface Spec {
    proc: number;
    time: number;
}

/** Independently derive the request stamps and the total-order grant sequence. */
function reference(n: number, specs: Spec[]): { grantOrder: number[]; messages: number } {
    const clocks = Array<number>(n).fill(0);
    const requests = specs.map((s) => {
        clocks[s.proc] = Math.max(clocks[s.proc] ?? 0, s.time) + 1;
        return { proc: s.proc, time: clocks[s.proc] ?? 1 };
    });
    requests.sort((a, b) => (a.time !== b.time ? a.time - b.time : a.proc - b.proc));
    return { grantOrder: requests.map((r) => r.proc), messages: specs.length * 2 * (n - 1) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("point");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ricart-Agrawala mutual exclusion", () => {
    it("grants in total stamp order with the right message count", () => {
        const input = mod.defaultInput as { processes: number; requests: Spec[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const expected = reference(input.processes, input.requests);
        expect(final["grantOrder"]).toEqual(expected.grantOrder);
        expect(final["messages"]).toBe(expected.messages);
    });

    it("never reports two processes in the critical section", () => {
        const input = mod.defaultInput as { processes: number; requests: Spec[] };
        for (const frame of mod.run(input)) {
            const inCS = Number(frame.meta["inCS"]);
            expect(inCS === -1 || (inCS >= 0 && inCS < input.processes)).toBe(true);
        }
    });

    it("matches the reference on randomized requests", () => {
        let seed = 7;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (let t = 0; t < 12; t += 1) {
            const n = 3 + Math.floor(rand() * 4);
            const count = 2 + Math.floor(rand() * 5);
            const requests = Array.from({ length: count }, () => ({
                proc: Math.floor(rand() * n),
                time: Math.floor(rand() * 8),
            }));
            const frames = [...mod.run({ processes: n, requests })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["grantOrder"]).toEqual(reference(n, requests).grantOrder);
        }
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
