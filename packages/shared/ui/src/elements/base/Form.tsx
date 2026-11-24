import { Form as BaseForm } from '@base-ui/react/form';

import { createSlot, type SlotProps, styledPart } from '../_internal/elementFactory';

import disclosureStyles from '../_styles/disclosure.module.css';

export type FormActionsProps = SlotProps<'div'>;
export type FormMessageProps = SlotProps<'div'>;

const FormRoot = styledPart(BaseForm, disclosureStyles.formRoot, 'Form.Root');
const FormActions = createSlot('div', disclosureStyles.formActions, 'Form.Actions');
const FormMessage = createSlot('div', disclosureStyles.formMessage, 'Form.Message');

export const Form = Object.assign(FormRoot, {
  Root: FormRoot,
  Actions: FormActions,
  Message: FormMessage,
});

export type {
  FormProps,
  FormState,
  FormSubmitEventDetails,
  FormSubmitEventReason,
} from '@base-ui/react/form';
