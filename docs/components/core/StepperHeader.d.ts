/**
 * Period pager — week or day. Arrows dim at the ends rather than disappearing.
 * @startingPoint section="Core" subtitle="Week / day pager" viewport="700x100"
 */
export interface StepperHeaderProps {
  label: string;
  sub?: string;
  onPrev?: () => void;
  onNext?: () => void;
  prevEnabled?: boolean;
  nextEnabled?: boolean;
}
export function StepperHeader(props: StepperHeaderProps): JSX.Element;
