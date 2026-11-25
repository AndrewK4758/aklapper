import { Slider as BaseSlider } from '@base-ui/react/slider';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';

export const Slider = {
  Root: styledPart(BaseSlider.Root, controlStyles.sliderRoot, 'Slider.Root'),
  Label: styledPart(BaseSlider.Label, disclosureStyles.fieldLabel, 'Slider.Label'),
  Value: styledPart(BaseSlider.Value, controlStyles.sliderValue, 'Slider.Value'),
  Control: styledPart(
    BaseSlider.Control,
    cx(controlStyles.sliderControl, controlMobileStyles.touchTarget),
    'Slider.Control',
  ),
  Track: styledPart(BaseSlider.Track, controlStyles.sliderTrack, 'Slider.Track'),
  Indicator: styledPart(BaseSlider.Indicator, controlStyles.sliderIndicator, 'Slider.Indicator'),
  Thumb: styledPart(
    BaseSlider.Thumb,
    cx(controlStyles.sliderThumb, controlMobileStyles.touchHitArea),
    'Slider.Thumb',
  ),
} as const;

export type {
  SliderControlProps,
  SliderControlState,
  SliderIndicatorProps,
  SliderIndicatorState,
  SliderLabelProps,
  SliderLabelState,
  SliderRootChangeEventDetails,
  SliderRootChangeEventReason,
  SliderRootCommitEventDetails,
  SliderRootCommitEventReason,
  SliderRootProps,
  SliderRootState,
  SliderThumbProps,
  SliderThumbState,
  SliderTrackProps,
  SliderTrackState,
  SliderValueProps,
  SliderValueState,
} from '@base-ui/react/slider';
