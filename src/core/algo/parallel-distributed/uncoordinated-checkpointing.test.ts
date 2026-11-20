import { describe, expect, it } from "vitest";
import mod from "./uncoordinated-checkpointing";
import type { VisualFrame } from "@/types";

type Message = { from: number; to: number; send: number; recv: number };

function reference(processes: number, checkpoints: number, messages: Message[], failed: number) {
    const lost = new Set<string>([`${failed}:${checkpoints - 1}`]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const m of messages) {
            const dependent = `${m.to}:${m.recv}`;
            const dependency = `${m.from}:${m.send}`;
            if (lost.has(dependency) && !lost.has(dependent)) {
                lost.add(dependent);
                changed = true;
            }
        }
    }
    const recovery: number[] = [];
    for (let p = 0; p < processes; p += 1) {
        let chosen = -1;
        for (let k = checkpoints - 1; k >= 0; k -= 1) {
            if (!lost.has(`${p}:${k}`)) {
                chosen = k;
                break;
            }
        }
        recovery.push(chosen);
    }
    return { lost, recovery };
}

function checkFrames(frames: VisualFrame[], expectedCells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(expectedCells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Uncoordinated Checkpointing", () => {
    it("matches a fixpoint reference and chooses a consistent recovery line", () => {
        const input = mod.defaultInput as { processes: number; checkpoints: number; messages: Message[]; failed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.processes * input.checkpoints);
        const expected = reference(input.processes, input.checkpoints, input.messages, input.failed);
        const final = frames[frames.length - 1]?.meta;
        const recovery = final?.["recoveryLine"] as number[];
        expect(recovery).toEqual(expected.recovery);
        expect(Number(final?.["rollbackCount"])).toBe(expected.lost.size);
        for (const m of input.messages) {
            if (expected.lost.has(`${m.from}:${m.send}`)) {
                expect(expected.lost.has(`${m.to}:${m.recv}`)).toBe(true);
            }
        }
    });

    it("handles a domino chain and a single failure", () => {
        const cases: Array<{ processes: number; checkpoints: number; failed: number; messages: Message[] }> = [
            {
                processes: 3,
                checkpoints: 4,
                failed: 0,
                messages: [
                    { from: 0, to: 1, send: 3, recv: 3 },
                    { from: 1, to: 2, send: 3, recv: 3 },
                    { from: 2, to: 1, send: 2, recv: 1 },
                ],
            },
            { processes: 4, checkpoints: 3, failed: 2, messages: [{ from: 2, to: 3, send: 2, recv: 2 }] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.processes * input.checkpoints);
            const expected = reference(input.processes, input.checkpoints, input.messages, input.failed);
            const final = frames[frames.length - 1]?.meta;
            expect((final?.["recoveryLine"] as number[])).toEqual(expected.recovery);
            expect(Number(final?.["rollbackCount"])).toBe(expected.lost.size);
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
