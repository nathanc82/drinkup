/**
 * A single line of the day's ledger: time, marker, note, running total.
 * @startingPoint section="Core" subtitle="Timeline row with running total" viewport="700x80"
 */
export interface LedgerRowProps {
  time: string;
  note?: string;
  value?: string;
  marker?: 'ink' | 'now';
  /** Not-yet-happened row: hollow marker, ghost ink, softer hairline. */
  ghost?: boolean;
}
export function LedgerRow(props: LedgerRowProps): JSX.Element;
