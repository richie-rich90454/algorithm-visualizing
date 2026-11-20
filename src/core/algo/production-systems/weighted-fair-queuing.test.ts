/**
 * weighted-fair-queuing.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./weighted-fair-queuing";
import type { VisualFrame } from "@/types";

type FlowInput = { id: string; weight: number; packets: number[] };

function reference(flows: FlowInput[]) {
    const entries: Array<{ flow: number; packet: number; finish: number; label: string }> = [];
    flows.forEach((flow, fi) => {
        let finish = 0;
        flow.packets.forEach((size, pi) => {
            finish += size / flow.weight;
            entries.push({ flow: fi, packet: pi, finish, label: `${flow.id}${pi}` });
        });
    });
    entries.sort((a, b) => a.finish - b.finish || a.flow - b.flow || a.packet - b.packet);
    return entries;
}

function checkFrames(frames: VisualFrame[], packets: number): void {
    expect(frames.length).toBe(packets + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(packets);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Weighted Fair Queuing", () => {
    it("matches an independent virtual finish time computation", () => {
        const input = mod.defaultInput as { flows: FlowInput[] };
        const frames = [...mod.run(input)];
        const packets = input.flows.reduce((a, f) => a + f.packets.length, 0);
        checkFrames(frames, packets);
        const expected = reference(input.flows);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["order"]).toEqual(expected.map((e) => e.label));
        const finishTimes = meta?.["finishTimes"] as number[];
        for (let i = 0; i < expected.length; i += 1) {
            expect(finishTimes[i]).toBeCloseTo(expected[i]?.finish as number, 12);
        }
    });

    it("preserves FIFO order inside every flow", () => {
        const flows: FlowInput[] = [
            { id: "A", weight: 1, packets: [2, 5, 1, 4] },
            { id: "B", weight: 3, packets: [1, 9, 2] },
            { id: "C", weight: 2, packets: [7, 3] },
        ];
        const frames = [...mod.run({ flows })];
        const meta = frames[frames.length - 1]?.meta;
        const order = meta?.["order"] as string[];
        const lastSeen = new Map<string, number>();
        for (const label of order) {
            const flow = label.charAt(0);
            const index = Number(label.slice(1));
            const previous = lastSeen.get(flow) ?? -1;
            expect(index).toBeGreaterThan(previous);
            lastSeen.set(flow, index);
        }
        expect(order.length).toBe(9);
    });

    it("gives heavier flows earlier finish times", () => {
        const flows: FlowInput[] = [
            { id: "L", weight: 1, packets: [6] },
            { id: "H", weight: 3, packets: [6] },
        ];
        const frames = [...mod.run({ flows })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["order"]).toEqual(["H0", "L0"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
