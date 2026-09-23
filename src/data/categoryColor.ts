import { colors } from '../theme';
import type { Category } from './places';

export const CATEGORY_COLOR: Record<Category, string> = {
  history: colors.brick,
  museum: colors.vistula,
  jewish: colors.jewish,
  view: colors.patina,
  food: colors.gilt,
  daytrip: colors.ink,
  remembrance: colors.remembrance,
  night: colors.night,
};
