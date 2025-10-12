import { CenteredFlexDiv, Waiting } from '@aklapper/react-shared';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Suspense, type ReactElement } from 'react';
import { Await } from 'react-router';
import waiting from '../../assets/images/swirly-dots-to-chrome.webp';
import Theme from '../../styles/themes/theme';

interface CrudElementProps<T1, T2> {
  crudElement: string;
  loader: Promise<T2>;
  Header: ReactElement;
  NewEntry: ReactElement<T1>;
  DataGrid: ReactElement;
  children?: ReactElement | ReactElement[];
}

export default function CrudElement<T1, T2>({
  crudElement,
  loader,
  Header,
  NewEntry,
  DataGrid,
}: CrudElementProps<T1, T2>): ReactElement<CrudElementProps<T1, T2>> {
  return (
    <Box sx={{ width: '100%' }}>
      <CenteredFlexDiv sx={{ padding: 0 }}>
        <Box
          id={crudElement}
          sx={{
            flex: 1,
            gap: Theme.spacing(4),
            borderRadius: Theme.shape.borderRadius,
            width: '100%',
            backgroundColor: Theme.palette.background.paper,
          }}
        >
          {Header}
          <Container id={`add-${crudElement}-wrapper`}>{NewEntry}</Container>
        </Box>
        <Box sx={{ width: '100%' }}>
          <Suspense fallback={<Waiting src={waiting} />}>
            <Await resolve={loader}>{DataGrid}</Await>
          </Suspense>
        </Box>
      </CenteredFlexDiv>
    </Box>
  );
}
