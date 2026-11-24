/** Number formatting for the UI: decimal comma (eu and es), fixed decimals, angles in ° ′ ″. */
import { formatDMS, toDMS } from '../core/angles';

export const fmt = (x: number, digits = 3, trim = true): string => {
  let s = x.toFixed(digits);
  if (trim && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',').replace('-', '−');
};

export const mm = (x: number, digits = 3): string => `${fmt(x, digits)} mm`;
export const deg = (x: number, digits = 4): string => `${fmt(x, digits)}°`;
export const dms = (x: number, secDigits = 0): string => formatDMS(toDMS(x, secDigits)).replace('.', ',');
