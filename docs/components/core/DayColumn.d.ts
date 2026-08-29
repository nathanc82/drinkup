/**
 * One tappable day in a week chart: count, bar, weekday letter, date number.
 * @startingPoint section="Charts" subtitle="Tappable day column" viewport="700x220"
 */
export interface DayColumnProps {
  letter: string;
  day: string;
  /** null for a day that hasn't happened yet. */
  count?: number | null;
  goal?: number;
  max?: number;
  today?: boolean;
  onClick?: () => void;
}
export function DayColumn(props: DayColumnProps): JSX.Element;
