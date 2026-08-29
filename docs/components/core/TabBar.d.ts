/**
 * Four uppercase mono tabs on a full-ink rule. No icons.
 * @startingPoint section="Core" subtitle="Text-only bottom navigation" viewport="700x110"
 */
export interface TabBarProps {
  tabs?: string[];
  active?: string;
  onSelect?: (tab: string) => void;
}
export function TabBar(props: TabBarProps): JSX.Element;
