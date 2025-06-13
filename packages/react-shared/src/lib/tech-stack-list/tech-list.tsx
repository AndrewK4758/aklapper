import Container from '@mui/material/Container';
import List from '@mui/material/List';
import type { SxProps, TypographyVariant } from '@mui/material/styles';
import type { ReactNode } from 'react';
import RenderList from '../render-list/render-list.jsx';
import SectionTitle, { type SectionTitleProps } from '../section_title/section_title.jsx';

interface TechListProps extends SectionTitleProps {
  techListContainerSxProps: SxProps;
  techListTextSxProps: SxProps;
  data: string[];
  renderTechLists: (value: unknown, index: number, array: unknown[]) => ReactNode;
  id: string;
  labelText: string;
  variant: TypographyVariant;
}

export const TechList = ({
  techListContainerSxProps,
  techListTextSxProps,
  data,
  renderTechLists,
  id,
  labelText,
  variant,
  tooltipTitle,
  placement,
}: TechListProps) => (
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

    <List key={`${id}-list`} id={`${id}-list`}>
      <RenderList<string> data={data} listMapCallback={renderTechLists} />
    </List>
  </Container>
);

export default TechList;
