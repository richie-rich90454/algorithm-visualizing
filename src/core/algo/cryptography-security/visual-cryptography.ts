/**
 * visual-cryptography.ts - Visual Secret Sharing (2 out of 2)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Naor and Shamir's visual secret sharing scheme encodes a black-and-white
 * image into two transparent shares. Each pixel becomes four subpixels. A
 * white pixel gives both shares the same two-black pattern; a black pixel gives
 * them complementary patterns. Stacking the shares with logical OR shows a
 * gray pixel for white and a fully black pixel for black, while either share
 * alone reveals nothing about the image.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p) for p pixels
 *   Space: O(4p) for the four subpixels stored in each share
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid's top half is share one; the bottom half is share two.
 *   - Each pixel expands to a two by two block of subpixel cells.
 *   - The current pixel's blocks are highlighted while being generated.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pattern = [number, number, number, number];

const PATTERNS: Pattern[] = [
    [1, 1, 0, 0],
    [1, 0, 1, 0],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 1, 0, 1],
    [0, 0, 1, 1],
];

/** Deterministic generator so the same image always yields the same shares. */
function nextRandom(state: number): { state: number; value: number } {
    const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return { state: next, value: next % PATTERNS.length };
}

/** The visual cryptography module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { image?: string; seed?: number } | null) ?? {};
    const image = typeof task.image === "string" && task.image.length > 0
        ? [...task.image].map((ch) => (ch === "1" || ch === "#" ? 1 : 0))
        : [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1];
    const size = Math.ceil(Math.sqrt(image.length));
    const width = size;
    const height = Math.ceil(image.length / width);
    let rngState = (task.seed ?? 12345) >>> 0;

    const share1: number[] = [];
    const share2: number[] = [];
    const stacked: number[] = [];
    let step = 0;

    const cells = (activePixel: number | null): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let share = 0; share < 2; share += 1) {
            const flat = share === 0 ? share1 : share2;
            for (let p = 0; p < image.length; p += 1) {
                for (let sub = 0; sub < 4; sub += 1) {
                    const row = share * height * 2 + Math.floor(p / width) * 2 + Math.floor(sub / 2);
                    const col = (p % width) * 2 + (sub % 2);
                    const bit = flat[p * 4 + sub] ?? 0;
                    const state: EntityState =
                        activePixel === p ? "active" : bit === 1 ? "visited" : "idle";
                    entities.push({
                        id: `cell-${share}-${p}-${sub}`,
                        type: "cell" as const,
                        label: String(bit),
                        value: bit,
                        state,
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                        metadata: { row, col, share, pixel: p, sub, bit },
                    });
                }
            }
        }
        return entities;
    };

    yield {
        stepNumber: step,
        entities: cells(null),
        edges: [],
        description: `Encoding ${image.length} pixel(s) into two shares of four subpixels each.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: height * 2, cols: width * 2, width, height, share1: [], share2: [], stacked: [], pixels: image.slice() },
    };
    step += 1;

    for (let p = 0; p < image.length; p += 1) {
        const pick = nextRandom(rngState);
        rngState = pick.state;
        const pattern = PATTERNS[pick.value] as Pattern;
        const black = image[p] === 1;
        const first = pattern;
        const second: Pattern = black
            ? [1 - first[0], 1 - first[1], 1 - first[2], 1 - first[3]]
            : [...first] as Pattern;
        share1.push(...first);
        share2.push(...second);
        for (let sub = 0; sub < 4; sub += 1) {
            stacked.push((first[sub] as number) | (second[sub] as number));
        }
        yield {
            stepNumber: step,
            entities: cells(p),
            edges: [],
            description: `Pixel ${p} is ${black ? "black: shares receive complementary patterns" : "white: shares receive the same pattern"}; stacking yields ${first.reduce((sum, bit, i) => sum + ((bit as number) | (second[i] as number)), 0)} dark subpixel cell(s).`,
            codeLineNumber: black ? 3 : 2,
            layout: "grid",
            meta: {
                rows: height * 2,
                cols: width * 2,
                width,
                height,
                share1: share1.slice(),
                share2: share2.slice(),
                stacked: stacked.slice(),
                pixels: image.slice(),
                index: p,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(null),
        edges: [],
        description: `Shares complete: each share has exactly two dark subpixels per pixel; stacking reconstructs ${image.filter((bit) => bit === 1).length} black pixel(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: height * 2, cols: width * 2, width, height, share1: share1.slice(), share2: share2.slice(), stacked: stacked.slice(), pixels: image.slice() },
    };
}

/** The visual cryptography module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Visual cryptography hides an image in two transparencies such that neither one alone shows anything. Every original pixel becomes a two by two block on each share. If the pixel is white the two blocks are identical; if it is black they are exact opposites. Each share always has two of four subpixels dark regardless of the secret, but stacking them makes white pixels half dark and black pixels fully dark.",
        invariants: [
            "Each share block contains exactly two dark subpixels.",
            "A white pixel gives the two shares the same pattern.",
            "A black pixel gives the two shares complementary patterns.",
        ],
        correctness:
            "For any pixel, a single share is one of the six two-dark patterns chosen independently of the secret, so it carries no information by itself. Stacking with logical OR gives two dark subpixels when the patterns are equal, which the eye reads as gray or white, and four dark subpixels when they are complementary, which reads as black. Thus the decoded image is exactly the set of black pixels and no participant learns the secret alone.",
        complexityRationale:
            "Encoding each pixel needs one pattern choice and four copies, so the running time is linear in the number of pixels. Each share stores four subpixels per pixel, giving O(4p) space for p pixels.",
        uses: [
            "Secret sharing that needs no computation to decode",
            "Watermarking and printable secret messages",
            "Teaching information-theoretic secrecy with a visual example",
        ],
        references: [
            "Naor and Shamir, Visual Cryptography, EUROCRYPT 1994",
            "Wikipedia, Visual cryptography",
        ],
        workedExample:
            "For a white pixel both shares might receive the pattern dark, dark, light, light. Stacking keeps two dark cells, so the pixel looks light. For a black pixel the second share receives light, light, dark, dark; stacking fills all four cells and the pixel looks black. Either share alone always shows two dark cells.",
    },
    id: "visual-cryptography",
    name: "Visual Cryptography (2 out of 2)",
    category: "cryptography-security",
    complexity: { time: "O(p)", space: "O(4p)" },
    defaultInput: { image: "11111100110011111111", seed: 12345 },
    visualType: "grid",
    run,
    pseudocode: [
        "expand each pixel into four subpixels",
        "choose a random pattern with two dark subpixels",
        "for a white pixel copy that pattern to both shares",
        "for a black pixel give the shares complementary patterns",
        "stack the two shares with logical OR",
        "read two dark cells as white and four as black",
        "done: report both shares and the reconstructed image",
    ],
};

export default module;
