import { CenteredFlexDiv, Text } from '@aklapper/react-shared';
import type { FormikProps } from 'formik';
import { type ChangeEvent, type RefObject } from 'react';
import type { MessageMeFormValues } from './email-form';

const FILE_ACCEPTS =
  '.jpg, .jpeg, .png, .gif, .webp, .avif, .ico, .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .txt, .md, .markdown, .json, .csv, .mp4, .mov, .avi, .webm, .mkv, .mp3, .wav, .ogg, .flac, .ttf, .otf, .woff, .woff2, .zip, .rar, .7z';

interface UploadFileButtonProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  formik: FormikProps<MessageMeFormValues>;
  name: keyof MessageMeFormValues;
}

export default function UploadFileButton({ fileInputRef, formik, name, ...props }: UploadFileButtonProps) {
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await formik.setFieldValue('attachment', e.target.files[0], true);
  };

  return (
    <CenteredFlexDiv {...props} id='attachment-wrapper' data-testid='attachment-wrapper'>
      <input
        ref={fileInputRef}
        accept={FILE_ACCEPTS}
        id={name}
        data-testid={name}
        name={name}
        type='file'
        style={{ display: 'none' }}
        onBlur={formik.handleBlur}
        onChange={handleFileChange}
      />
      {formik.values.attachment && (
        <CenteredFlexDiv component={'span'}>
          <Text variant='subtitle1' children={(formik.values.attachment as File).name} sx={{ textAlign: 'center' }} />
        </CenteredFlexDiv>
      )}
    </CenteredFlexDiv>
  );
}
