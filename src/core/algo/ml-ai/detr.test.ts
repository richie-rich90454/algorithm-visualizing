/** detr.test.ts - Independent bipartite-matching cost and set-loss verification. */
import { describe, expect, it } from "vitest";
import mod from "./detr";
import type { VisualFrame } from "@/types";

type Box = [number, number, number, number];
interface Prediction {
    logits: number[];
    box: Box;
}
interface Target {
    cls: number;
    box: Box;
}
interface Input {
    predictions: Prediction[];
    targets: Target[];
    lambdaL1: number;
    lambdaGiou: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeDefined();
    });
}

function softmax(logits: number[]): number[] {
    const m = Math.max(...logits);
    const e = logits.map((v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
}
function l1(a: Box, b: Box): number {
    return a.reduce((sum, v, i) => sum + Math.abs(v - b[i]!), 0);
}
function giou(a: Box, b: Box): number {
    const ax1 = a[0] - a[2] / 2, ax2 = a[0] + a[2] / 2, ay1 = a[1] - a[3] / 2, ay2 = a[1] + a[3] / 2;
    const bx1 = b[0] - b[2] / 2, bx2 = b[0] + b[2] / 2, by1 = b[1] - b[3] / 2, by2 = b[1] + b[3] / 2;
    const iw = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
    const ih = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    const inter = iw * ih;
    const union = a[2] * a[3] + b[2] * b[3] - inter;
    const iou = union > 0 ? inter / union : 0;
    const enc = Math.max(0, Math.max(ax2, bx2) - Math.min(ax1, bx1)) * Math.max(0, Math.max(ay2, by2) - Math.min(ay1, by1));
    return enc > 0 ? iou - (enc - union) / enc : iou;
}
function allPerms(n: number): number[][] {
    const out: number[][] = [];
    const used = Array(n).fill(false);
    const cur: number[] = [];
    const go = (): void => {
        if (cur.length === n) {
            out.push([...cur]);
            return;
        }
        for (let j = 0; j < n; j += 1) {
            if (!used[j]) {
                used[j] = true;
                cur.push(j);
                go();
                cur.pop();
                used[j] = false;
            }
        }
    };
    go();
    return out;
}

function reference(input: Input) {
    const n = Math.min(input.predictions.length, 7);
    const preds = input.predictions.slice(0, n);
    const targets = input.targets.slice(0, n);
    const m = targets.length;
    const probs = preds.map((p) => softmax(p.logits));
    const noObj = preds[0]!.logits.length - 1;
    const cost = preds.map((p, i) =>
        Array.from({ length: n }, (_, j) => {
            if (j < m) {
                const t = targets[j]!;
                const cls = Math.min(noObj - 1, Math.max(0, t.cls));
                return -(probs[i]![cls] ?? 0) + input.lambdaL1 * l1(p.box, t.box) + input.lambdaGiou * (1 - giou(p.box, t.box));
            }
            return -(probs[i]![noObj] ?? 0);
        }),
    );
    let best: number[] = [];
    let bestCost = Infinity;
    for (const perm of allPerms(n)) {
        const total = perm.reduce((sum, j, i) => sum + cost[i]![j]!, 0);
        if (total < bestCost) {
            bestCost = total;
            best = perm;
        }
    }
    let clsLoss = 0, l1Loss = 0, giouLoss = 0;
    for (let i = 0; i < n; i += 1) {
        const slot = best[i]!;
        if (slot < m) {
            const t = targets[slot]!;
            const cls = Math.min(noObj - 1, Math.max(0, t.cls));
            clsLoss += -Math.log(probs[i]![cls]! + 1e-12);
            l1Loss += input.lambdaL1 * l1(preds[i]!.box, t.box);
            giouLoss += input.lambdaGiou * (1 - giou(preds[i]!.box, t.box));
        } else {
            clsLoss += -Math.log(probs[i]![noObj]! + 1e-12);
        }
    }
    const costFlat = cost.reduce<number[]>((a, r) => a.concat(r), []);
    return { costFlat, best, bestCost, clsLoss, l1Loss, giouLoss, totalLoss: clsLoss + l1Loss + giouLoss, n };
}

describe("DETR set prediction", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent cost matrix, optimal assignment, and set loss", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const ref = reference(input);
        (final["cost"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.costFlat[i]!, 10));
        expect(final["assignment"]).toEqual(ref.best);
        expect(final["matchingCost"] as number).toBeCloseTo(ref.bestCost, 10);
        expect(final["clsLoss"] as number).toBeCloseTo(ref.clsLoss, 10);
        expect(final["l1Loss"] as number).toBeCloseTo(ref.l1Loss, 10);
        expect(final["giouLoss"] as number).toBeCloseTo(ref.giouLoss, 10);
        expect(final["totalLoss"] as number).toBeCloseTo(ref.totalLoss, 10);
    });

    it("keeps the total loss invariant to permuting the prediction order", () => {
        const reordered: Input = { ...input, predictions: [input.predictions[2]!, input.predictions[0]!, input.predictions[1]!] };
        const a = [...mod.run(input)].at(-1)!.meta["totalLoss"] as number;
        const b = [...mod.run(reordered)].at(-1)!.meta["totalLoss"] as number;
        expect(a).toBeCloseTo(b, 10);
    });

    it("switches from class-driven to geometry-driven assignment as the box weight grows", () => {
        const twoObjects: Omit<Input, "lambdaL1" | "lambdaGiou"> = {
            predictions: [
                { logits: [3, 0.1, 0.1], box: [5, 5, 0.5, 0.5] },
                { logits: [0.1, 3, 0.1], box: [1, 1, 0.5, 0.5] },
            ],
            targets: [
                { cls: 0, box: [1, 1, 0.5, 0.5] },
                { cls: 1, box: [5, 5, 0.5, 0.5] },
            ],
        };
        const classDriven = [...mod.run({ ...twoObjects, lambdaL1: 0.01, lambdaGiou: 0 })].at(-1)!.meta;
        const geometryDriven = [...mod.run({ ...twoObjects, lambdaL1: 20, lambdaGiou: 0 })].at(-1)!.meta;
        expect(classDriven["assignment"]).toEqual([0, 1]);
        expect(geometryDriven["assignment"]).toEqual([1, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
