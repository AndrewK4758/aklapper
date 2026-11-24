import { Avatar as BaseAvatar } from '@base-ui/react/avatar';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const Avatar = {
  Root: styledPart(BaseAvatar.Root, disclosureStyles.avatarRoot, 'Avatar.Root'),
  Image: styledPart(BaseAvatar.Image, disclosureStyles.avatarImage, 'Avatar.Image'),
  Fallback: styledPart(BaseAvatar.Fallback, disclosureStyles.avatarFallback, 'Avatar.Fallback'),
} as const;

export type {
  AvatarFallbackProps,
  AvatarFallbackState,
  AvatarImageProps,
  AvatarImageState,
  AvatarRootProps,
  AvatarRootState,
  ImageLoadingStatus,
} from '@base-ui/react/avatar';
