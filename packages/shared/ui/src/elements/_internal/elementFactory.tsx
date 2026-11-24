import { type ComponentPropsWithRef, createElement, type ElementType, type JSX } from 'react';

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

interface ClassNameBearingProps {
  className?: unknown;
}

export function styledPart<Component>(
  component: Component,
  baseClass: string,
  displayName: string,
): Component {
  const RenderTarget = component as unknown as ElementType<ClassNameBearingProps>;

  function StyledPart(props: ClassNameBearingProps): JSX.Element {
    const mergedClassName = mergeBaseClassName(baseClass, props.className);
    return createElement(RenderTarget, { ...props, className: mergedClassName });
  }

  StyledPart.displayName = displayName;
  return StyledPart as unknown as Component;
}

export type SlotProps<Tag extends keyof JSX.IntrinsicElements> = ComponentPropsWithRef<Tag>;

export function createSlot<Tag extends keyof JSX.IntrinsicElements>(
  tag: Tag,
  baseClass: string,
  displayName: string,
): (props: SlotProps<Tag>) => JSX.Element {
  function Slot({ className, ...props }: SlotProps<Tag>): JSX.Element {
    const merged = cx(baseClass, typeof className === 'string' ? className : undefined);
    return createElement(tag, { ...props, className: merged });
  }

  Slot.displayName = displayName;
  return Slot;
}
