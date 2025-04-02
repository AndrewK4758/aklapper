import { SxProps } from '@mui/material';
import Box from '@mui/material/Box';
// import ImageListItemBar from '@mui/material/ImageListItemBar';
import { CSSProperties, ReactNode, type Dispatch, type SetStateAction } from 'react';
import { Link, To } from 'react-router';
import Text from '../text/text';

export interface ImageLinkProps {
  type: string;
  to: To;
  id: string | number;
  srcSet: string | undefined;
  loading?: 'eager' | 'lazy' | undefined;
  alt: string;
  style: CSSProperties;
  title: ReactNode;
  position?: 'bottom' | 'top' | 'below' | undefined;
  breakpointsImageListText?: SxProps;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export function ImageLink({
  type,
  to,
  id,
  srcSet,
  loading,
  alt,
  style,
  title,
  setOpen,
  breakpointsImageListText
}: ImageLinkProps) {
  return (
    <Box component={'li'} key={id} sx={{ overflow: 'hidden' }}>
      <Link
        type={type}
        to={to}
        onClick={() => setOpen(true)}
        style={{ display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none' }}
      >
        <img srcSet={srcSet} loading={loading} alt={alt} style={style} />

        <Text component={'span'} titleVariant="body2" titleText={title} sx={breakpointsImageListText} />
      </Link>
    </Box>
  );
}
