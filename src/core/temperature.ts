/**
 * Temperature correction (spec §3). Reference temperature 20 °C (ISO 1).
 *
 * Sign convention (stated in every statement): ΔL = L_measured − L_20, i.e. how much longer
 * the reading is than the length the part would have at 20 °C.
 *   A (linear, the formula of the exam): ΔL = L · (α_p·ΔT_p − α_t·ΔT_t),  ΔT = T − 20
 *   B (exact physical model): the part's true length at 20 °C is L20; at T_p it measures
 *     L20·(1 + α_p·ΔT_p); the scale at T_t has divisions (1 + α_t·ΔT_t) long, so the reading is
 *     L = L20·(1 + α_p·ΔT_p)/(1 + α_t·ΔT_t) → L20 = L·(1 + α_t·ΔT_t)/(1 + α_p·ΔT_p).
 * A and B differ by second-order terms (≈ L·(αΔT)²); tests bound that difference so the
 * linear convention never changes a graded answer.
 */
import { add, div, mul, q, sub, type Rational } from './rational';

export interface TemperatureData {
  /** Measured length, mm. */
  L: Rational;
  /** Expansion coefficient of the part, 1/K. */
  alphaPart: Rational;
  tPart: Rational;
  /** Instrument / gauge blocks: omitted → at 20 °C or no expansion. */
  alphaTool?: Rational;
  tTool?: Rational;
}

const T20 = q(20);

export function deltaLA(t: TemperatureData): Rational {
  const part = mul(t.alphaPart, sub(t.tPart, T20));
  const tool = t.alphaTool && t.tTool ? mul(t.alphaTool, sub(t.tTool, T20)) : q(0);
  return mul(t.L, sub(part, tool));
}

export const lengthAt20A = (t: TemperatureData): Rational => sub(t.L, deltaLA(t));

export function lengthAt20B(t: TemperatureData): Rational {
  const part = add(q(1), mul(t.alphaPart, sub(t.tPart, T20)));
  const tool = t.alphaTool && t.tTool ? add(q(1), mul(t.alphaTool, sub(t.tTool, T20))) : q(1);
  return div(mul(t.L, tool), part);
}

export const deltaLB = (t: TemperatureData): Rational => sub(t.L, lengthAt20B(t));
