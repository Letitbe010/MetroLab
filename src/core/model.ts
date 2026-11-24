/**
 * Data model (spec §4), JSON-friendly: every datum shown to the user is an exact decimal
 * string ("25.882"), so the answer key is always computed from exactly what is displayed
 * (spec §8.1). Solvers parse these strings; trigonometry only at the end.
 *
 * Deviations from the spec's sketch (reported to the user): setups carry the displayed data
 * as strings; the vernier setup stores the true reading plus the scale (the picture is drawn
 * from it); ask kinds are finer-grained than spec §7 (one kind per graded quantity).
 */

/** Exact decimal string, e.g. "10.325". */
export type Num = string;

export type Setup =
  /** Vernier caliper: main-scale division s, n vernier divisions, modulus γ; `value` = the reading shown in the picture. */
  | { kind: 'vernier'; s: Num; n: number; modulus: 1 | 2; value: Num }
  /** Micrometer (pitch 0.5, 50 divisions), optional 0.001 vernier. */
  | { kind: 'micrometer'; vernierDivs: 0 | 10; value: Num }
  | { kind: 'gaugeStack'; target: Num; set: string }
  /**
   * Sine bar of length L. Either the angle is given (angleDeg, or taperC: the bar is set at the
   * half-angle of a cone of taper C), or the height h of the stack is given (sineAngle ask).
   */
  | { kind: 'sineBar'; L: Num; angleDeg?: Num; taperC?: Num; h?: Num; set?: string; checkLength?: Num }
  /** External cone over two equal rollers on blocks h1 < h2 (0 = on the plate); plane = trapezoid section. */
  | { kind: 'taperRollers'; rollerD: Num; h1: Num; h2: Num; M1: Num; M2: Num; coneLength?: Num; plane?: boolean }
  /** Internal cone, two balls; depth = from the top face to the top of the ball (negative: above it). */
  | { kind: 'taperBalls'; d1: Num; d2: Num; depth1: Num; depth2: Num }
  /** Three wires: M given → d2 asked, or d2 given → M asked. */
  | { kind: 'threeWire'; thread?: string; P: Num; flankAngleDeg: Num; wireD: Num; M?: Num; d2?: Num }
  | { kind: 'spline'; rollerD: Num; vAngleDeg: Num; apexRadius: Num }
  /** Dovetail: width on the plate given → X asked, or X given → width asked. */
  | { kind: 'dovetail'; dovetail: 'male' | 'female'; rollerD: Num; alphaDeg: Num; width?: Num; X?: Num }
  /**
   * Temperature. given = 'measured': L is a reading taken at tPart (instrument at tTool);
   * given = 'at20': L is the length at 20 °C and the length at tPart is asked.
   */
  | { kind: 'temperature'; given: 'measured' | 'at20'; L: Num; material?: string; alphaPart: Num; tPart: Num; alphaTool?: Num; tTool?: Num }
  /** Limit gauges: an ISO designation from the subset, or the limits given as numbers. */
  | { kind: 'fixedGauge'; feature: 'hole' | 'shaft'; designation?: string; nominal?: Num; max?: Num; min?: Num }
  /** Errors: repeated readings of a reference of known value. */
  | { kind: 'error'; measured: Num[]; trueValue: Num };

export type SetupKind = Setup['kind'];

/** One graded quantity (spec §7, refined). */
export type AskKind =
  | 'reading' // instrument reading, mm (exact)
  | 'appreciation' // vernier appreciation, mm (exact)
  | 'gaugeStack' // list of blocks
  | 'sineHeight' // h, mm
  | 'sineAngle' // α, degrees
  | 'selectionError' // error over the check length due to the composable stack, mm
  | 'taperC' // C (ratio, %, 1:x)
  | 'halfAngle' // α/2, degrees
  | 'fullAngle' // α, degrees
  | 'planeAngle' // trapezoid: angle between base and flank inside the part, degrees
  | 'diameter' // cone diameter (at: plate | top), mm
  | 'pitchDiameter' // d2, mm
  | 'bestWire' // dw, mm
  | 'measure' // micrometer reading over rollers/wires (M or X), mm
  | 'width' // dovetail width on the plate, mm
  | 'tempDelta' // ΔL, mm
  | 'length20' // length at 20 °C, mm
  | 'lengthAtT' // length at the working temperature, mm
  | 'gaugeGo' // GO side, mm (exact)
  | 'gaugeNoGo' // NO-GO side, mm (exact)
  | 'errorAbs' // mean − true, mm
  | 'errorRel'; // (mean − true)/true, %

export interface Ask {
  id: string;
  kind: AskKind;
  /** gaugeStack: the statement demands the minimum number of blocks (§8.2). */
  minimal?: boolean;
  /** gaugeStack in a sine-bar exercise: the stack for h rounded to the set (nearest composable). */
  nearestFeasible?: boolean;
  /** diameter: where. */
  at?: 'plate' | 'top';
}

export type Origin = 'ope' | 'adapted' | 'generated';
export type ReviewStatus = 'approved' | 'review-needed';

export interface Exercise {
  id: string;
  origin: Origin;
  status?: ReviewStatus;
  sourceNote?: string;
  sourceUrl?: string;
  template?: string;
  seed?: number;
  difficulty: 1 | 2 | 3;
  setup: Setup;
  asks: Ask[];
  weights: Record<string, number>;
  text: { eu: string; es: string };
}
