import { TechList } from '@aklapper/react-shared';
import MenuOpen from '@mui/icons-material/MenuOpen';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
// import Zoom from '@mui/material/Zoom';
import { useState, type ReactElement } from 'react';
import { analytics, build, cloud, data, languages, libraries, styles, testing } from '../static/tech-stack-text.jsx';

/**
 * This function renders a single list item for the tech stack list.
 *
 * @param {string} e - The text of the list item.
 * @param {number} _i - The index of the list item.
 * @param {string[]} _arr - The array of list items.
 * @returns {ReactElement<string>} The rendered list item.
 */

const renderTechLists = (e: string, _i: number, _arr: string[]): ReactElement<string> => (
  <ListItem key={`${e}-wrapper`} id={`${e}-wrapper`} data-testid={`${e}-wrapper`}>
    <ListItemText key={`${e}`} id={`${e}`} data-testid={`${e}`}>
      {e}
    </ListItemText>
    <ListItemIcon key={`${e}-svg-icon-wrapper`} id={`${e}-svg-icon-wrapper`} data-testid={`${e}-svg-icon-wrapper`}>
      <img
        key={`${e}-svg-icon`}
        data-testid={`${e}-svg-icon`}
        id={`${e}-svg-icon`}
        src={`/client/icons/${e.toLowerCase()}-icon.svg`}
        alt={`${e}-icon`}
        role='img'
        style={{ width: '32px', height: 'auto' }}
      />
    </ListItemIcon>
  </ListItem>
);

/**
 * This component renders a list of technologies i am strongest with.
 *
 * @returns {ReactElement} The rendered tech stack list component.
 */

const TechStackList = (): ReactElement => {
  const [open, setOpen] = useState<boolean>(false);
  console.log(open);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Container
        component={'div'}
        id='tech-list-text-container'
        data-testid='tech-list-title-text'
        sx={{ paddingY: 2, flex: '0 1 30%', width: '100%', display: 'flex', gap: 2 }}
      >
        <Button
          id='tech-list-title-text-button'
          data-testid='tech-list-title-text-button'
          LinkComponent={'button'}
          variant='contained'
          onClick={handleOpen}
          endIcon={<MenuOpen sx={{}} />}
          // sx={introButtonSxProps}
        >
          My Core Tech Stack
        </Button>
      </Container>
      {open && (
        <Dialog
          open={open}
          aria-modal={true}
          maxWidth={false}
          onClose={e => {
            console.log(e);
            handleClose();
          }}
          slotProps={{
            paper: { sx: { width: '60vw' } },
          }}
        >
          <DialogContent id='tech-list-dialog-content-wrapper' data-testid='tech-list-dialog-content-wrapper'>
            <DialogActions>
              <Button
                key='tech-list-dialog-action-button'
                id='tech-list-dialog-action-button'
                data-testid='tech-list-dialog-action-button'
                onClick={() => handleClose()}
              >
                Close
              </Button>
            </DialogActions>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
              }}
            >
              <TechList
                id='languages'
                labelText='Languages'
                tooltipTitle={'My strongest languages'}
                variant={'h5'}
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={languages}
                renderTechLists={renderTechLists}
                title={'Languages'}
                placement='top'
              />
              <TechList
                id='libraries'
                labelText='Libraries'
                title='Libraries'
                tooltipTitle={'My most used libraries'}
                variant='h5'
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={libraries}
                renderTechLists={renderTechLists}
                placement='top'
              />
              <TechList
                id='build-list'
                labelText='Build'
                title='Build'
                tooltipTitle='The build tools I use for building anything web'
                variant='h5'
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={build}
                renderTechLists={renderTechLists}
                placement='top'
              />

              <TechList
                id='databases'
                labelText='Databases'
                title='Databases'
                tooltipTitle='My most used databases'
                variant='h5'
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={data}
                renderTechLists={renderTechLists}
                placement='top'
              />
              <TechList
                id='cloud'
                labelText='Cloud'
                title='Cloud'
                tooltipTitle='The cloud tools I am most comfortable with'
                variant='h5'
                techListContainerSxProps={{
                  display: 'flex',
                  flexBasis: '25%',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={cloud}
                renderTechLists={renderTechLists}
                placement='top'
              />
              <TechList
                id='styles'
                labelText='Styles'
                title='Styles'
                tooltipTitle='The style tools I use for building anything web'
                variant='h5'
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={styles}
                renderTechLists={renderTechLists}
                placement='top'
              />
              <TechList
                id='analytics'
                labelText='Analytics'
                title='Analytics'
                tooltipTitle='The analytics tools I use'
                variant='h5'
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={analytics}
                renderTechLists={renderTechLists}
                placement='top'
              />
              <TechList
                id='testing'
                labelText='Testing'
                title='Testing'
                tooltipTitle='The tools I use for unit & e2e testing'
                variant='h5'
                techListContainerSxProps={{
                  flexBasis: '25%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                techListTextSxProps={{}}
                data={testing}
                renderTechLists={renderTechLists}
                placement='top'
              />
            </Box>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
export default TechStackList;
