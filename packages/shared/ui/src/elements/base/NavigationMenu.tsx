import { NavigationMenu as BaseNavigationMenu } from '@base-ui/react/navigation-menu';

import { styledPart } from '../_internal/elementFactory';

import menuStyles from '../_styles/menu.module.css';
import overlayStyles from '../_styles/overlay.module.css';

export const NavigationMenu = {
  Root: styledPart(BaseNavigationMenu.Root, menuStyles.navRoot, 'NavigationMenu.Root'),
  List: styledPart(BaseNavigationMenu.List, menuStyles.navList, 'NavigationMenu.List'),
  Item: styledPart(BaseNavigationMenu.Item, menuStyles.navItem, 'NavigationMenu.Item'),
  Trigger: styledPart(BaseNavigationMenu.Trigger, menuStyles.navLink, 'NavigationMenu.Trigger'),
  Icon: styledPart(BaseNavigationMenu.Icon, menuStyles.icon, 'NavigationMenu.Icon'),
  Content: styledPart(BaseNavigationMenu.Content, menuStyles.navContent, 'NavigationMenu.Content'),
  Link: styledPart(BaseNavigationMenu.Link, menuStyles.navLink, 'NavigationMenu.Link'),
  Portal: BaseNavigationMenu.Portal,
  Backdrop: styledPart(
    BaseNavigationMenu.Backdrop,
    overlayStyles.backdrop,
    'NavigationMenu.Backdrop',
  ),
  Positioner: styledPart(
    BaseNavigationMenu.Positioner,
    menuStyles.positioner,
    'NavigationMenu.Positioner',
  ),
  Popup: styledPart(BaseNavigationMenu.Popup, menuStyles.popup, 'NavigationMenu.Popup'),
  Viewport: styledPart(
    BaseNavigationMenu.Viewport,
    overlayStyles.floatingViewport,
    'NavigationMenu.Viewport',
  ),
  Arrow: styledPart(BaseNavigationMenu.Arrow, overlayStyles.arrow, 'NavigationMenu.Arrow'),
} as const;

export type {
  NavigationMenuArrowProps,
  NavigationMenuArrowState,
  NavigationMenuBackdropProps,
  NavigationMenuBackdropState,
  NavigationMenuContentProps,
  NavigationMenuContentState,
  NavigationMenuIconProps,
  NavigationMenuIconState,
  NavigationMenuItemProps,
  NavigationMenuItemState,
  NavigationMenuLinkProps,
  NavigationMenuLinkState,
  NavigationMenuListProps,
  NavigationMenuListState,
  NavigationMenuPopupProps,
  NavigationMenuPopupState,
  NavigationMenuPortalProps,
  NavigationMenuPortalState,
  NavigationMenuPositionerProps,
  NavigationMenuPositionerState,
  NavigationMenuRootChangeEventDetails,
  NavigationMenuRootChangeEventReason,
  NavigationMenuRootProps,
  NavigationMenuRootState,
  NavigationMenuTriggerProps,
  NavigationMenuTriggerState,
  NavigationMenuViewportProps,
  NavigationMenuViewportState,
} from '@base-ui/react/navigation-menu';
