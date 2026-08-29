/**
 * The screen's one primary act. Full width, square-ish, orange.
 * @startingPoint section="Core" subtitle="Primary action with hold hint" viewport="700x140"
 */
export interface ActionButtonProps {
  label?: string;
  variant?: 'primary' | 'ink';
  /** Uppercase mono hint rendered under the button, e.g. "HOLD TO UNDO LAST". */
  hint?: string;
  onClick?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
}
export function ActionButton(props: ActionButtonProps): JSX.Element;
