/**
 * One square cell per cup; grows past the goal in accent orange.
 * @startingPoint section="Core" subtitle="Cup progress, overshoot-friendly" viewport="700x80"
 */
export interface SegmentBarProps {
  count?: number;
  goal?: number;
  height?: number;
}
export function SegmentBar(props: SegmentBarProps): JSX.Element;
