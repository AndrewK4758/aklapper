import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const ScrollArea = {
  Root: styledPart(BaseScrollArea.Root, disclosureStyles.scrollRoot, 'ScrollArea.Root'),
  Viewport: styledPart(
    BaseScrollArea.Viewport,
    disclosureStyles.scrollViewport,
    'ScrollArea.Viewport',
  ),
  Content: styledPart(BaseScrollArea.Content, disclosureStyles.scrollContent, 'ScrollArea.Content'),
  Scrollbar: styledPart(
    BaseScrollArea.Scrollbar,
    disclosureStyles.scrollbar,
    'ScrollArea.Scrollbar',
  ),
  Thumb: styledPart(BaseScrollArea.Thumb, disclosureStyles.scrollThumb, 'ScrollArea.Thumb'),
  Corner: styledPart(BaseScrollArea.Corner, disclosureStyles.scrollCorner, 'ScrollArea.Corner'),
} as const;

export type {
  ScrollAreaContentProps,
  ScrollAreaContentState,
  ScrollAreaCornerProps,
  ScrollAreaCornerState,
  ScrollAreaRootProps,
  ScrollAreaRootState,
  ScrollAreaScrollbarProps,
  ScrollAreaScrollbarState,
  ScrollAreaThumbProps,
  ScrollAreaThumbState,
  ScrollAreaViewportProps,
  ScrollAreaViewportState,
} from '@base-ui/react/scroll-area';
