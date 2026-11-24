import { Menubar as BaseMenubar } from '@base-ui/react/menubar';

import { styledPart } from '../_internal/elementFactory';

import menuStyles from '../_styles/menu.module.css';

const MenubarRoot = styledPart(BaseMenubar, menuStyles.bar, 'Menubar.Root');

export const Menubar = Object.assign(MenubarRoot, {
  Root: MenubarRoot,
});

export type { MenubarProps, MenubarState } from '@base-ui/react/menubar';
