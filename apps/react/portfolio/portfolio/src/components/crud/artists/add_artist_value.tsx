// import { Text } from '@aklapper/react-shared';
// import Button from '@mui/material/Button';
// import ButtonGroup from '@mui/material/ButtonGroup';
// import TextField from '@mui/material/TextField';
// import { Form, type FormikProps } from 'formik';
// import type { FocusEvent } from 'react';
// import CenteredFlexDiv from '../../styled/centered_flexbox.js';
// import HelperTextBox from '../../styled/helper_text_box.js';

// interface AddDataGridValueProps<T> {
//   formik: FormikProps<T>;
//   name: Extract<keyof T, string>;
//   helperText: string | null;
//   label: string;
// }

// export default function AddDataGridValue<T>({ formik, label, name, helperText }: AddDataGridValueProps<T>) {
//   const handlelFocus = async (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     await formik.setFieldTouched(e.target.name, false);
//   };

//   return (
//     <Form method='post' onSubmit={formik.handleSubmit}>
//       <CenteredFlexDiv id='add-artist-container'>
//         <HelperTextBox>
//           <TextField
//             autoComplete='off'
//             name={name}
//             id='name'
//             fullWidth={true}
//             label={label}
//             variant='outlined'
//             value={formik.values[name]}
//             onChange={formik.handleChange}
//             onBlur={formik.handleBlur}
//             onFocus={handlelFocus}
//             error={formik.touched[name] && !!formik.errors[name]}
//             helperText={(formik.touched[name] as boolean) && (formik.errors[name] as string)}
//           />
//           {helperText && <Text variant='caption' children={helperText} />}
//         </HelperTextBox>

//         <ButtonGroup fullWidth>
//           <Button type='submit' variant='contained' color='primary'>
//             {formik.isSubmitting ? 'Submitting' : 'Submit'}
//           </Button>
//           <Button type='reset' variant='contained' color='secondary'>
//             Clear
//           </Button>
//         </ButtonGroup>
//       </CenteredFlexDiv>
//     </Form>
//   );
// }
