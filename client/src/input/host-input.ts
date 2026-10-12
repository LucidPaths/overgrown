// The one place input messages are made. Every input adapter (keyboard/mouse, touch) reports here, so there is
// one set of press counters and one posted stream. Two adapters with their own counters would fake presses on every
// alternation (sim/src/input.ts reads any counter change as a press), and one adapter's idle report would cancel
// another's held stick.
import type { InputMessage } from "@overgrown/sim/protocol";

export type InputSource = "keyboard-mouse" | "touch";

/** The held (non-edge) part of an InputMessage, as one source sees it. */
export interface HeldInput {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  sprint: boolean;
}

export const NO_HELD_INPUT: Readonly<HeldInput> = Object.freeze({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, sprint: false });

function sameInput(a: InputMessage, b: InputMessage): boolean {
  return (
    a.moveX === b.moveX &&
    a.moveY === b.moveY &&
    a.aimX === b.aimX &&
    a.aimY === b.aimY &&
    a.sprint === b.sprint &&
    a.attackPresses === b.attackPresses &&
    a.dodgePresses === b.dodgePresses
  );
}

export class HostInput {
  private readonly held: Record<InputSource, HeldInput> = {
    "keyboard-mouse": { ...NO_HELD_INPUT },
    touch: { ...NO_HELD_INPUT },
  };
  private source: InputSource;
  private attackPresses = 0;
  private dodgePresses = 0;
  private lastPosted: InputMessage | null = null;

  /** `initial` is the source assumed active before any input (its held state starts as NO_HELD_INPUT, like every source's). */
  constructor(
    private readonly post: (msg: InputMessage) => void,
    initial: InputSource,
  ) {
    this.source = initial;
  }

  /** The source whose held fields are sent: the one with the latest user activity. */
  get active(): InputSource {
    return this.source;
  }

  /**
   * `src`'s current held state. `activity`: this came from a user input event, so `src` becomes active.
   * Posts if the merged message differs from the last posted one.
   */
  report(src: InputSource, held: HeldInput, activity: boolean): void {
    this.held[src] = { ...held };
    if (activity) this.source = src;
    this.flush();
  }

  /**
   * One press: stores `held` for `src`, makes `src` active, counter = (counter + 1) >>> 0, posts.
   * The press and its held state (e.g. the aim it was made with) are one message.
   */
  press(src: InputSource, button: "attack" | "dodge", held: HeldInput): void {
    this.held[src] = { ...held };
    this.source = src;
    if (button === "attack") this.attackPresses = (this.attackPresses + 1) >>> 0;
    else this.dodgePresses = (this.dodgePresses + 1) >>> 0;
    this.flush();
  }

  /** Posts the merged input if any field differs from the last posted message. */
  private flush(): void {
    const h = this.held[this.source];
    const msg: InputMessage = {
      type: "input",
      moveX: h.moveX,
      moveY: h.moveY,
      aimX: h.aimX,
      aimY: h.aimY,
      sprint: h.sprint,
      attackPresses: this.attackPresses,
      dodgePresses: this.dodgePresses,
    };
    if (this.lastPosted !== null && sameInput(msg, this.lastPosted)) return;
    this.lastPosted = msg;
    this.post(msg);
  }
}
