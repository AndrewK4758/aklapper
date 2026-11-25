import { type ComponentPropsWithRef, createElement, type ElementType, type JSX } from 'react';

import {
  type ElementViewMode,
  resolveElementViewport,
} from '../../components/terminalViewportSplit';
import { useViewportContext } from '../../components/ViewportProvider';

export function cx(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function mergeBaseClassName<ClassProp>(
  baseClass: string | undefined,
  userClass: ClassProp,
): ClassProp {
  if (!baseClass) {
    return userClass;
  }
  if (typeof userClass === 'function') {
    const resolver = userClass as (...args: readonly unknown[]) => string | undefined;
    return ((...args: readonly unknown[]) => {
      const resolved = resolver(...args);
      return resolved ? `${baseClass} ${resolved}` : baseClass;
    }) as ClassProp;
  }
  if (typeof userClass === 'string' && userClass.length > 0) {
    return `${baseClass} ${userClass}` as ClassProp;
  }
  return baseClass as ClassProp;
}

export interface StyledPartOptions {
  readonly stampViewport?: boolean;
  readonly mobileSheet?: boolean;
}

interface ViewportClassBearingProps {
  className?: unknown;
  viewMode?: ElementViewMode;
  'data-viewport'?: string;
  'data-mobile-sheet'?: string;
}

export type WithElementViewMode<Component> = Component extends (props: infer Props) => infer Result
  ? (props: Props & { readonly viewMode?: ElementViewMode }) => Result
  : Component;

export function styledPart<Component>(
  component: Component,
  baseClass: string,
  displayName: string,
  options?: StyledPartOptions,
): WithElementViewMode<Component> {
  const RenderTarget = component as unknown as ElementType<ViewportClassBearingProps>;
  const shouldStampViewport = options?.stampViewport === true;
  const isMobileSheet = options?.mobileSheet === true;

  function StyledPart(props: ViewportClassBearingProps): JSX.Element {
    const { layoutMode } = useViewportContext();
    const { viewMode, className, ...restProps } = props;
    const mergedClassName = mergeBaseClassName(baseClass, className);
    const resolvedViewport = resolveElementViewport(layoutMode, viewMode);
    const nextProps: ViewportClassBearingProps = {
      ...restProps,
      className: mergedClassName,
    };

    if (shouldStampViewport || viewMode !== undefined) {
      nextProps['data-viewport'] = props['data-viewport'] ?? resolvedViewport;
    }

    if (isMobileSheet && resolvedViewport !== 'desktop') {
      nextProps['data-mobile-sheet'] = 'true';
    }

    return createElement(RenderTarget, nextProps);
  }

  StyledPart.displayName = displayName;
  return StyledPart as unknown as WithElementViewMode<Component>;
}

export function viewportStyledPart<Component>(
  component: Component,
  baseClass: string,
  displayName: string,
  options?: Omit<StyledPartOptions, 'stampViewport'>,
): WithElementViewMode<Component> {
  return styledPart(component, baseClass, displayName, {
    ...options,
    stampViewport: true,
  });
}

export type SlotProps<Tag extends keyof JSX.IntrinsicElements> = ComponentPropsWithRef<Tag> & {
  readonly viewMode?: ElementViewMode;
};

export function createSlot<Tag extends keyof JSX.IntrinsicElements>(
  tag: Tag,
  baseClass: string,
  displayName: string,
): (props: SlotProps<Tag>) => JSX.Element {
  function Slot({ className, viewMode, ...props }: SlotProps<Tag>): JSX.Element {
    const { layoutMode } = useViewportContext();
    const merged = cx(baseClass, typeof className === 'string' ? className : undefined);
    const viewportAttr =
      viewMode !== undefined
        ? { 'data-viewport': resolveElementViewport(layoutMode, viewMode) }
        : undefined;
    return createElement(tag, { ...props, ...viewportAttr, className: merged });
  }

  Slot.displayName = displayName;
  return Slot;
}
