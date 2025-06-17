import Box from '@mui/material/Box';
// import Container from '@mui/material/Container';
import Container from '@mui/material/Container';
import List from '@mui/material/List';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import type { ReactElement } from 'react';
import RenderList from '../render-list/render-list.jsx';
import SectionTitle, { type SectionTitleProps } from '../section_title/section_title.jsx';

interface TechListProps<T> extends SectionTitleProps {
  techListContainerSxProps: SxProps;
  techListTextSxProps: SxProps;
  data: T[];
  renderTechLists: (value: T, index: number, array: T[]) => ReactElement<T>;
  id: string;
  labelText: string;
  variant: TypographyVariant;
}

export const TechList = <T,>({
  techListContainerSxProps,
  techListTextSxProps,
  data,
  renderTechLists,
  id,
  labelText,
  variant,
  tooltipTitle,
  placement,
}: TechListProps<T>) => (
  <Container
    component={'div'}
    id={`${id}-wrapper`}
    data-testid={`tech-list-${id}-title-text`}
    sx={techListContainerSxProps}
  >
    <SectionTitle
      id={id}
      title={labelText}
      placement={placement}
      variant={variant}
      tooltipTitle={tooltipTitle}
      sx={techListTextSxProps}
    />

    <List id={`${id}-list`} sx={{ display: 'flex', flexDirection: 'column' }}>
      <RenderList<T> data={data} listMapCallback={renderTechLists} />
    </List>
  </Container>
);

export default TechList;
