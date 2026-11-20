/** least-response-time-balancer.test.ts - Reference schedule and greedy optimality check. */

import { describe, expect, it } from "vitest";
import mod from "./least-response-time-balancer";
import type { VisualFrame } from "@/types";

interface Server {
    id: string;
    weight: number;
    latency: number;
}

function reference(servers: Server[], requests: number[]) {
    const loads = servers.map((s) => Math.max(0, s.latency));
    const assignments: number[] = [];
    for (const t of requests) {
        let best = 0;
        let bestRatio = Number.POSITIVE_INFINITY;
        for (let i = 0; i < servers.length; i += 1) {
            const weight = Math.max(1, servers[i]?.weight ?? 1);
            const ratio = (loads[i] ?? 0) / weight;
            if (ratio < bestRatio) {
                bestRatio = ratio;
                best = i;
            }
        }
        assignments.push(best);
        loads[best] = (loads[best] ?? 0) + t;
    }
    return { assignments, loads };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
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

describe("least-response-time-balancer", () => {
    it("matches an independent WRT schedule", () => {
        const input = mod.defaultInput as { servers: Server[]; requests: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.servers, input.requests);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["assignments"]).toEqual(expected.assignments);
        expect(final?.["loads"]).toEqual(expected.loads);
        expect(final?.["assignedIds"]).toEqual(expected.assignments.map((i) => input.servers[i]?.id));
    });

    it("chosen server minimizes load divided by weight at every step", () => {
        const input = mod.defaultInput as { servers: Server[]; requests: number[] };
        const frames = [...mod.run(input)];
        const loads = input.servers.map((s) => s.latency);
        for (let step = 0; step < input.requests.length; step += 1) {
            const frame = frames[step + 1];
            const chosen = Number(frame?.meta["chosen"]);
            const chosenRatio = (loads[chosen] ?? 0) / Math.max(1, input.servers[chosen]?.weight ?? 1);
            for (let i = 0; i < input.servers.length; i += 1) {
                const ratio = (loads[i] ?? 0) / Math.max(1, input.servers[i]?.weight ?? 1);
                expect(chosenRatio).toBeLessThanOrEqual(ratio);
            }
            loads[chosen] = (loads[chosen] ?? 0) + (input.requests[step] ?? 0);
        }
    });

    it("respects initial latencies and weights", () => {
        const servers: Server[] = [
            { id: "fast", weight: 4, latency: 0 },
            { id: "slow", weight: 1, latency: 12 },
        ];
        const frames = [...mod.run({ servers, requests: [8, 8, 8] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["assignments"]).toEqual([0, 0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
