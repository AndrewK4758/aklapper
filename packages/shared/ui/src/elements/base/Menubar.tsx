import { Menubar as BaseMenubar } from '@base-ui/react/menubar';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import menuStyles from '../_styles/menu.module.css';

const MenubarRoot = styledPart(
  BaseMenubar,
  cx(menuStyles.bar, controlMobileStyles.touchStrip),
  'Menubar.Root',
);

export const Menubar = Object.assign(MenubarRoot, {
  Root: MenubarRoot,
});

export type { MenubarProps, MenubarState } from '@base-ui/react/menubar';
