/**
 * Data model (spec §4). Every length is an exact Rational in mm; angles that are
 * data ("15°") are exact too. Trigonometry only happens at the very end, in the solvers.
 */
import type { Rational } from './rational';

export type Setup =
  /** Vernier caliper: main-scale division s (mm), n vernier divisions, modulus γ (1 normal, 2 extended). */
  | { kind: 'vernier'; s: Rational; divisions: number; modulus?: 1 | 2; main: Rational; line: number }
  /** Micrometer: sleeve reading (incl. the 0.5 mm mark), thimble line (0..49), optional vernier line (0..9). */
  | { kind: 'micrometer'; sleeve: Rational; thimble: number; vernier?: number }
  | { kind: 'gaugeStack'; target: Rational; set: string }
  | { kind: 'sineBar'; L: Rational; h?: Rational; angleDeg?: Rational }
  | { kind: 'taperRollers'; rollerD: Rational; h1: Rational; h2: Rational; M1: Rational; M2: Rational }
  | { kind: 'taperBalls'; d1: Rational; d2: Rational; depth1: Rational; depth2: Rational }
  | { kind: 'threeWire'; P: Rational; flankAngleDeg: Rational; wireD: Rational; M?: Rational }
  | { kind: 'rollerProfile'; profile: 'dovetail' | 'vGroove' | 'spline'; params: Record<string, Rational> }
  | { kind: 'temperature'; L: Rational; alphaPart: Rational; tPart: Rational; alphaTool?: Rational; tTool?: Rational }
  | { kind: 'fixedGauge'; designation: string; limits?: { max: Rational; min: Rational } };

/** Ask types (spec §7). */
export type AskKind =
  | 'reading'
  | 'gaugeStack'
  | 'sineHeight'
  | 'sineAngle'
  | 'taper'
  | 'taperDiameters'
  | 'pitchDiameter'
  | 'bestWire'
  | 'micrometerReading'
  | 'tempCorrection'
  | 'error'
  | 'gaugeLimits';

export interface Ask {
  id: string;
  kind: AskKind;
  /** For gaugeStack: the statement demands the minimum number of blocks (§8.2). */
  minimal?: boolean;
}

export interface Exercise {
  id: string;
  origin: 'ope' | 'adapted' | 'generated';
  sourceNote?: string;
  sourceUrl?: string;
  seed?: number;
  difficulty: 1 | 2 | 3;
  setup: Setup;
  asks: Ask[];
  weights: Record<string, number>;
  text: { eu: string; es: string };
}
