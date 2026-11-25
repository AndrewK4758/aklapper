import { Tabs as BaseTabs } from '@base-ui/react/tabs';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';

export const Tabs = {
  Root: styledPart(BaseTabs.Root, disclosureStyles.tabsRoot, 'Tabs.Root'),
  List: styledPart(
    BaseTabs.List,
    cx(disclosureStyles.tabsList, controlMobileStyles.touchStrip),
    'Tabs.List',
  ),
  Tab: styledPart(
    BaseTabs.Tab,
    cx(disclosureStyles.tab, controlMobileStyles.touchTarget),
    'Tabs.Tab',
  ),
  Indicator: styledPart(BaseTabs.Indicator, disclosureStyles.tabsIndicator, 'Tabs.Indicator'),
  Panel: styledPart(BaseTabs.Panel, disclosureStyles.tabPanel, 'Tabs.Panel'),
} as const;

export type {
  TabsIndicatorProps,
  TabsIndicatorState,
  TabsListProps,
  TabsListState,
  TabsPanelProps,
  TabsPanelState,
  TabsRootChangeEventDetails,
  TabsRootChangeEventReason,
  TabsRootProps,
  TabsRootState,
  TabsTabProps,
  TabsTabState,
  TabsTabValue,
} from '@base-ui/react/tabs';
