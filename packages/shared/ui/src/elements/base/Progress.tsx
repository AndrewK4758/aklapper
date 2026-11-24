import { Progress as BaseProgress } from '@base-ui/react/progress';

import { styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export const Progress = {
  Root: styledPart(BaseProgress.Root, disclosureStyles.gaugeRoot, 'Progress.Root'),
  Label: styledPart(BaseProgress.Label, disclosureStyles.fieldLabel, 'Progress.Label'),
  Value: styledPart(BaseProgress.Value, disclosureStyles.gaugeValue, 'Progress.Value'),
  Track: styledPart(BaseProgress.Track, disclosureStyles.gaugeTrack, 'Progress.Track'),
  Indicator: styledPart(
    BaseProgress.Indicator,
    disclosureStyles.gaugeIndicator,
    'Progress.Indicator',
  ),
} as const;

export type {
  ProgressIndicatorProps,
  ProgressIndicatorState,
  ProgressLabelProps,
  ProgressLabelState,
  ProgressRootProps,
  ProgressRootState,
  ProgressStatus,
  ProgressTrackProps,
  ProgressTrackState,
  ProgressValueProps,
  ProgressValueState,
} from '@base-ui/react/progress';
