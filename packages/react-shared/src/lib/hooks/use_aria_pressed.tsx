import { useCallback, useState } from 'react';
import Aria from '../utils/aria_pressed_handler';

export default function useAriaPressed() {
  const [isPressed, setIsPressed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePressState = useCallback((e: MouseEvent) => {
    setIsPressed(Aria.isPushed(e.type));
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prevState => Aria.toggleExpanded(prevState));
  }, []);

  return {
    isPressed,
    isExpanded,
    pressHandlers: {
      onMouseDown: handlePressState,
      onMouseUp: handlePressState,
      onMouseLeave: () => setIsPressed(false),
    },
    toggleExpanded: toggleExpanded,
  };
}
