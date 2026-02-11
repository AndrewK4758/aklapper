import { useCallback, useState } from 'react';
import Aria from '../utils/aria_pressed_handler';

export default function useAriaPressed() {
  const [isPressed, setIsPressed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePressState = useCallback((e: MouseEvent) => {
    setIsPressed(Aria.isPushed(e.type));
    setIsFocused(false);
  }, []);

  const handleFocusAndBlur = useCallback((e: FocusEvent) => {
    if (e.type === 'blur') setIsFocused(false);
    else setIsFocused(true);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prevState => Aria.toggleExpanded(prevState));
  }, []);

  return {
    isPressed,
    isExpanded,
    isFocused,
    pressHandlers: {
      onMouseDown: handlePressState,
      onMouseUp: handlePressState,
      onFocus: handleFocusAndBlur,
      onBlur: handleFocusAndBlur,
      onMouseLeave: () => {
        setIsPressed(false);
      },
    },
    toggleExpanded: toggleExpanded,
  };
}
