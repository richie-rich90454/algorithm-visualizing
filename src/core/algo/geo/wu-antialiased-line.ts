/**
 * wu-antialiased-line.ts - Xiaolin Wu's antialiased line drawing.
 *
 * For each column along the dominant axis, Wu's method lights the two pixels
 * straddling the ideal line with complementary intensities. The upper pixel
 * gets one minus the fractional part of the computed coordinate and the lower
 * pixel gets the fractional part, so the pair reproduces the exact vertical
 * position in aggregate and the line looks smooth instead of stair-stepped.
 *
 *   Time:  O(dx + dy)
 *   Space: O(dx + dy) for the emitted pixels
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Pixel = [number, number, number];

function pixelNode(id: string, x: number, y: number, intensity: number, state: EntityState): VisualEntity {
    return {
        id,
        type: "node" as const,
        label: intensity.toFixed(2),
        value: [x, y, intensity],
        state,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { intensity },
    };
}

function wuLine(a: Pt, b: Pt): Pixel[] {
    let [x0, y0] = a;
    let [x1, y1] = b;
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    if (steep) {
        [x0, y0] = [y0, x0];
        [x1, y1] = [y1, x1];
    }
    if (x0 > x1) {
        [x0, x1] = [x1, x0];
        [y0, y1] = [y1, y0];
    }
    const dx = x1 - x0;
    const dy = y1 - y0;
    const slope = dx === 0 ? 0 : dy / dx;
    const pixels: Pixel[] = [];
    let interY = y0;
    for (let x = x0; x <= x1; x += 1) {
        const y = Math.floor(interY);
        const fraction = interY - y;
        const lower = steep ? [y, x] as Pt : [x, y] as Pt;
        const upper = steep ? [y + 1, x] as Pt : [x, y + 1] as Pt;
        pixels.push([lower[0], lower[1], 1 - fraction]);
        pixels.push([upper[0], upper[1], fraction]);
        interY += slope;
    }
    if (dx === 0) {
        pixels.length = 0;
        const yStart = Math.min(y0, y1);
        const yEnd = Math.max(y0, y1);
        for (let y = yStart; y <= yEnd; y += 1) {
            pixels.push(steep ? [y, x0, 1] : [x0, y, 1]);
        }
    }
    return pixels;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { from?: Pt; to?: Pt } | null) ?? {};
    const from: Pt = task.from ?? [0, 0];
    const to: Pt = task.to ?? [8, 4];
    let step = 0;
    const frame = (
        pixels: Pixel[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: pixels.map(([x, y, intensity], i) =>
            pixelNode(`px-${i}`, x, y, intensity, i === pixels.length - 1 ? "comparing" : "sorted"),
        ),
        edges: [],
        description,
        codeLineNumber,
        layout: "point",
        meta: { from, to, pixels: pixels.length, ...meta },
    });

    const pixels = wuLine(from, to);
    yield frame([], `Drawing an antialiased line from (${from}) to (${to}).`, 0, { pixels: 0 });
    step += 1;
    const chunk = Math.max(2, Math.ceil(pixels.length / 4));
    for (let i = 0; i < pixels.length; i += chunk) {
        const part = pixels.slice(0, Math.min(i + chunk, pixels.length));
        yield frame(part, `Plotted ${part.length} of ${pixels.length} weighted pixel samples.`, 2, {
            plotted: part.length,
        });
        step += 1;
    }
    const totalIntensity = pixels.reduce((sum, p) => sum + p[2], 0);
    yield frame(
        pixels,
        `Done: ${pixels.length} pixel samples with total coverage ${totalIntensity.toFixed(2)}.`,
        4,
        {
            pixels: pixels.map(([x, y, intensity]) => `${x},${y}:${intensity.toFixed(2)}`),
            totalIntensity,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Wu's line algorithm treats a raster line as a pair of partly lit pixels in each column rather than picking a single nearest pixel. It computes the ideal floating point y coordinate for the column, lights the pixel below with weight one minus the fraction and the pixel above with the fraction itself, and the two intensities add to one. The result is a smooth-looking line because the visual weight tracks the true geometric position.",
        invariants: [
            "In each column of the dominant axis, the two lit pixels lie on adjacent rows.",
            "Their intensities are complementary and sum to one.",
            "The first and last samples sit at the segment endpoints.",
        ],
        correctness:
            "The fractional part of the ideal coordinate measures exactly how far the line lies between the two candidate pixel centers. Giving weight one minus the fraction to the lower pixel and the fraction to the upper pixel makes the weighted average of their row centers equal the ideal coordinate. Therefore the raster carries the same vertical position as the mathematical line, and adjacent columns vary continuously instead of jumping a whole pixel.",
        complexityRationale:
            "The loop advances one column at a time along the dominant axis, emitting two weighted samples per column, so time and output size are O(dx + dy) where dx and dy are the coordinate differences. Only a few running variables are kept beyond the output pixels.",
        uses: [
            "Drawing smooth lines in raster graphics libraries",
            "Antialiased stroke rendering in vector editors",
            "Thin feature drawing in image processing",
        ],
        references: [
            "Wu, An Efficient Antialiasing Technique, SIGGRAPH 1991",
            "Foley et al., Computer Graphics: Principles and Practice, Chapter 3",
        ],
        workedExample:
            'From (0,0) to (8,4) the slope is 0.5. Columns land at y values 0, 0.5, 1, 1.5, and so on, so column 1 lights (1,0) with intensity 0.5 and (1,1) with intensity 0.5, while column 2 lights (2,1) fully.',
    },
    id: "wu-antialiased-line",
    name: "Wu Antialiased Line",
    category: "geometry",
    complexity: { time: "O(dx+dy)", space: "O(dx+dy)" },
    defaultInput: { from: [0, 0], to: [8, 4] },
    visualType: "graph",
    run,
    pseudocode: [
        "choose the axis with the larger coordinate span as the stepping axis",
        "compute the slope as the other span divided by this span",
        "for each column compute the ideal fractional coordinate",
        "light the lower pixel with weight one minus the fraction",
        "light the upper pixel with weight equal to the fraction",
        "advance the ideal coordinate by the slope",
        "report the weighted pixel samples",
    ],
};

export default module;
