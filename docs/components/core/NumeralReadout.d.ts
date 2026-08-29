/**
 * The big count. One per screen, top-left, above everything.
 * @startingPoint section="Core" subtitle="Oversized count against a goal" viewport="700x200"
 */
export interface NumeralReadoutProps {
  value: string;
  of?: string;
  caption?: string;
  size?: 'lg' | 'sm';
}
export function NumeralReadout(props: NumeralReadoutProps): JSX.Element;
