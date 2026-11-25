import { OTPField as BaseOTPField } from '@base-ui/react/otp-field';

import { cx, styledPart } from '../_internal/elementFactory';

import controlMobileStyles from '../_styles/control-mobile.module.css';
import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';

export const OTPField = {
  Root: styledPart(BaseOTPField.Root, controlStyles.otpRoot, 'OTPField.Root'),
  Input: styledPart(
    BaseOTPField.Input,
    cx(controlStyles.otpInput, controlMobileStyles.touchInput),
    'OTPField.Input',
  ),
  Separator: styledPart(BaseOTPField.Separator, disclosureStyles.separator, 'OTPField.Separator'),
} as const;

export type {
  OTPFieldInputProps,
  OTPFieldInputState,
  OTPFieldRootChangeEventDetails,
  OTPFieldRootChangeEventReason,
  OTPFieldRootProps,
  OTPFieldRootState,
} from '@base-ui/react/otp-field';
