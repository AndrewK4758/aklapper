import Container from '@mui/material/Container';
import List from '@mui/material/List';
import RenderList from '../render-list/render-list';
import type { SxProps } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { Variant } from '@mui/material/styles/createTypography';
import Label, { type LabelProps } from '../label/label';

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
    component={'section'}
    id={`${id}-wrapper`}
    data-testid={`tech-list-${id}-title-text`}
    sx={techListContainerSxProps}
  >
    <Label
      tooltipTitle={tooltipTitle}
      labelVariant={variant}
      labelText={labelText}
      placement={placement}
      sx={techListTextSxProps}
    />
    <List key={`${id}-list`} id={`${id}-list`}>
      <RenderList data={data} listMapCallback={renderTechLists} />
    </List>
  </Container>
);

export default TechList;
