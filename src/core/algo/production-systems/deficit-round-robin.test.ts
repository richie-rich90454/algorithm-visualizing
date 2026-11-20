/**
 * deficit-round-robin.test.ts - Independent packet scheduling reference,
 * frame shape, correctness property, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./deficit-round-robin";
import type { VisualFrame } from "@/types";

type FlowInput = { id: string; packets: number[] };

/** Independent reference using head indices rather than shifting arrays. */
function reference(flows: FlowInput[], quantum: number) {
    const heads = flows.map(() => 0);
    const credit = flows.map(() => 0);
    const sent: string[] = [];
    let rounds = 0;
    const total = flows.reduce((sum, flow) => sum + flow.packets.length, 0);
    while (heads.some((head, i) => head < (flows[i]?.packets.length ?? 0)) && rounds < total + 5) {
        rounds += 1;
        for (let i = 0; i < flows.length; i += 1) {
            const flow = flows[i];
            if (!flow || heads[i] === flow.packets.length) {
                continue;
            }
            credit[i] = (credit[i] ?? 0) + quantum;
            while (heads[i] < flow.packets.length && credit[i] >= flow.packets[heads[i]]) {
                credit[i] -= flow.packets[heads[i]];
                sent.push(`${flow.id}:${flow.packets[heads[i]]}`);
                heads[i] += 1;
            }
            if (heads[i] === flow.packets.length) {
                credit[i] = 0;
            }
        }
    }
    return { sent, rounds };
}

function checkFrames(frames: VisualFrame[], flowCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(flowCount);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Deficit Round Robin", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as { flows: FlowInput[]; quantum: number };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.flows.length);
        const expected = reference(input.flows, input.quantum);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["sent"]).toEqual(expected.sent);
        expect(final?.["rounds"]).toBe(expected.rounds);
    });

    it("sends every packet exactly once and keeps deficits nonnegative", () => {
        const flows: FlowInput[] = [
            { id: "X", packets: [300, 900, 200] },
            { id: "Y", packets: [1200, 400] },
        ];
        const frames = [...mod.run({ flows, quantum: 500 })];
        const final = frames[frames.length - 1]?.meta;
        const sent = final?.["sent"] as string[];
        const expectedPackets = flows.flatMap((flow) => flow.packets.map((size) => `${flow.id}:${size}`));
        expect([...sent].sort()).toEqual([...expectedPackets].sort());
        expect(sent.length).toBe(expectedPackets.length);
        for (const frame of frames) {
            const deficits = frame.meta["deficits"] as number[] | undefined;
            if (deficits) {
                expect(deficits.every((value) => value >= 0)).toBe(true);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
