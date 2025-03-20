import Container from '@mui/material/Container';
import List from '@mui/material/List';
import type { SxProps } from '@mui/material/styles';
import type { Variant } from '@mui/material/styles/createTypography.js';
import type { ReactNode } from 'react';
import Label, { type LabelProps } from '../label/label.jsx';
import RenderList from '../render-list/render-list';

interface TechListProps extends LabelProps {
  techListContainerSxProps: SxProps;
  techListTextSxProps: SxProps;
  data: string[];
  renderTechLists: (value: unknown, index: number, array: unknown[]) => ReactNode;
  id: string;
  labelText: string;
  variant: Variant;
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
  placement
}: TechListProps) => (
  <Container
    component={'div'}
    id={`${id}-wrapper`}
    data-testid={`tech-list-${id}-title-text`}
    sx={techListContainerSxProps}
  >
    <Label
      id={id}
      htmlFor={`${id}-list`}
      tooltipTitle={tooltipTitle}
      labelVariant={variant}
      labelText={labelText}
      placement={placement}
      labelTextSx={techListTextSxProps}
    />
    <List key={`${id}-list`} id={`${id}-list`}>
      <RenderList component={'section'} data={data} listMapCallback={renderTechLists} />
    </List>
  </Container>
);

export default TechList;
