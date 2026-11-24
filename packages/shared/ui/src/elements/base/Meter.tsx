import { Meter as BaseMeter } from '@base-ui/react/meter';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const Meter = {
  Root: styledPart(BaseMeter.Root, disclosureStyles.gaugeRoot, 'Meter.Root'),
  Label: styledPart(BaseMeter.Label, disclosureStyles.fieldLabel, 'Meter.Label'),
  Value: styledPart(BaseMeter.Value, disclosureStyles.gaugeValue, 'Meter.Value'),
  Track: styledPart(BaseMeter.Track, disclosureStyles.gaugeTrack, 'Meter.Track'),
  Indicator: styledPart(BaseMeter.Indicator, disclosureStyles.gaugeIndicator, 'Meter.Indicator'),
} as const;

export type {
  MeterIndicatorProps,
  MeterIndicatorState,
  MeterLabelProps,
  MeterLabelState,
  MeterRootProps,
  MeterRootState,
  MeterTrackProps,
  MeterTrackState,
  MeterValueProps,
  MeterValueState,
} from '@base-ui/react/meter';
