import { useLayoutEffect, type RefObject } from 'react';
import { handleScrollIntoView } from '../utils/handle-scroll-into-view';

/**
 * This custom hook scrolls an element into view when the component mounts or when the dependencies change.
 *
 * @param {RefObject<HTMLElement | null>} elementRef - A ref object that refers to the element to be scrolled into view.
 */

export const useScrollIntoView = (elementRef: RefObject<HTMLElement | null>) => {
  useLayoutEffect(() => {
    if (elementRef.current) handleScrollIntoView(elementRef.current);
  }, [elementRef]);
};

export default useScrollIntoView;
