import type { IBuiltGame } from '@aklapper/types';
import Avatar from '@mui/material/Avatar';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardHeader from '@mui/material/CardHeader';
import { SxProps } from '@mui/material/styles';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';

export interface ImageLinkProps {
  game: IBuiltGame;
  // type: string;
  // to: To;
  id: string | number;
  srcSet: string | undefined;
  loading?: 'eager' | 'lazy' | undefined;
  alt: string;
  style: CSSProperties;
  title: string;
  subtitle: string;
  position?: 'bottom' | 'top' | 'below' | undefined;
  icon: string;
  breakpointsImageListText?: SxProps;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedGame: Dispatch<SetStateAction<IBuiltGame | null>>;
}

export function ImageLink({ game, id, title, setOpen, icon, setSelectedGame }: ImageLinkProps) {
  console.log(game);
  return (
    <Card
      component={'li'}
      key={id}
      onClick={() => {
        setOpen(true);
        setSelectedGame(game);
      }}
      sx={{ width: '200px', height: 'auto' }}
    >
      <CardActionArea>
        <CardHeader
          avatar={<Avatar src={icon} />}
          title={title}
          subheader={
            game.players.min === game.players.max
              ? `Players: ${game.players.min}`
              : `Players: ${game.players.min}-${game.players.max}`
          }
          slotProps={{
            title: {
              sx: { fontSize: '2rem' }
            }
          }}
        />
      </CardActionArea>
    </Card>
  );
}
