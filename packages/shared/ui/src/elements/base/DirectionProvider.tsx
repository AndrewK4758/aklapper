import {
  DirectionProvider as BaseDirectionProvider,
  useDirection,
} from '@base-ui/react/direction-provider';

export const DirectionProvider = Object.assign(BaseDirectionProvider, {
  Provider: BaseDirectionProvider,
  Root: BaseDirectionProvider,
  useDirection,
});

export { useDirection };
export type { DirectionProviderProps, TextDirection } from '@base-ui/react/direction-provider';
