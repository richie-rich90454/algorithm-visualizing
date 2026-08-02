/**
 * engine.ts – The StepEngine class.
 *
 * The StepEngine is the tiny brain behind the visualiser's playback controls.
 * When an algorithm is loaded it runs the module's generator function to
 * *exhaustion*, collecting every yielded frame into an in-memory array. From
 * that moment on, "stepping" through the algorithm is nothing more than
 * moving an integer pointer along that array.
 *
 * Because every frame is precomputed up front, playback is instant and fully
 * deterministic: the same input always produces the exact same sequence of
 * frames, which makes debugging and classroom replay reliable.
 */

import type { AlgorithmModule, VisualFrame } from "@/types";

/**
 * A deterministic, synchronous frame player.
 *
 * The engine owns two pieces of state: the frame buffer produced when an
 * algorithm was loaded, and the index of the frame currently displayed.
 */
export class StepEngine {
    /** Every frame of the currently loaded algorithm run. */
    private frames: VisualFrame[] = [];

    /** Zero-based index of the frame being displayed right now. */
    private currentIndex = 0;

    /**
     * Run a module's generator against an input and buffer every frame.
     *
     * The generator is drained synchronously with a for-of loop, which forces
     * it to produce all frames before this method returns. The engine then
     * resets to the first frame.
     *
     * @param module The algorithm module to execute.
     * @param input  The validated input; defaults to the module's own default.
     * @returns The total number of frames the run produced.
     */
    load(module: AlgorithmModule, input: unknown): number {
        // Fall back to the module's default input if the caller passed nothing.
        const frames: VisualFrame[] = [];
        for (const frame of module.run(input ?? module.defaultInput)) {
            frames.push(frame);
        }
        this.frames = frames;
        this.currentIndex = 0;
        return frames.length;
    }

    /**
     * @returns The frame at the current step, or null when nothing is loaded.
     */
    getCurrentFrame(): VisualFrame | null {
        return this.frames[this.currentIndex] ?? null;
    }

    /**
     * Advance one step forward.
     *
     * @returns `true` when the pointer moved, `false` at the final frame.
     */
    next(): boolean {
        if (this.currentIndex >= this.frames.length - 1) {
            return false;
        }
        this.currentIndex += 1;
        return true;
    }

    /**
     * Move one step backward.
     *
     * @returns `true` when the pointer moved, `false` at the first frame.
     */
    prev(): boolean {
        if (this.currentIndex <= 0) {
            return false;
        }
        this.currentIndex -= 1;
        return true;
    }

    /** Jump back to the very first frame. */
    reset(): void {
        this.currentIndex = 0;
    }

    /** Total number of frames in the loaded run. */
    get totalFrames(): number {
        return this.frames.length;
    }

    /** Zero-based index of the currently displayed frame. */
    get step(): number {
        return this.currentIndex;
    }
}
