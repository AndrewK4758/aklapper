import { Field as BaseField } from '@base-ui/react/field';

import { styledPart } from '../_internal/elementFactory';

import controlStyles from '../_styles/control.module.css';
import disclosureStyles from '../_styles/disclosure.module.css';

export const Field = {
  Root: styledPart(BaseField.Root, disclosureStyles.fieldRoot, 'Field.Root'),
  Label: styledPart(BaseField.Label, disclosureStyles.fieldLabel, 'Field.Label'),
  Control: styledPart(BaseField.Control, controlStyles.input, 'Field.Control'),
  Description: styledPart(
    BaseField.Description,
    disclosureStyles.fieldDescription,
    'Field.Description',
  ),
  Error: styledPart(BaseField.Error, disclosureStyles.fieldError, 'Field.Error'),
  Validity: BaseField.Validity,
  Item: styledPart(BaseField.Item, disclosureStyles.fieldItem, 'Field.Item'),
} as const;

export type {
  FieldControlChangeEventDetails,
  FieldControlChangeEventReason,
  FieldControlProps,
  FieldControlState,
  FieldDescriptionProps,
  FieldDescriptionState,
  FieldErrorProps,
  FieldErrorState,
  FieldItemProps,
  FieldItemState,
  FieldLabelProps,
  FieldLabelState,
  FieldRootProps,
  FieldRootState,
  FieldValidityData,
  FieldValidityProps,
  FieldValidityState,
} from '@base-ui/react/field';
