// import type { IPlayer } from '@aklapper/types';
// import axios from 'axios';
// import { ActionFunctionArgs } from 'react-router';

// const baseUrl = import.meta.env.VITE_REST_API_SERVER_URL_V2;

// export default async function handleNewPlayerSubmit({ request, context }: ActionFunctionArgs) {
//   try {
//     console.log(context);
//     const values = await request.json();

//     console.log(values);
//     const { name } = values;

//     const resp = await axios.post(
//       `${baseUrl}/register`,
//       { name: name },
//       { headers: { 'Content-Type': 'application/json' } }
//     );

//     console.log('RESP DATA ', resp.data);

//     const { player, lobby } = resp.data as { player: Partial<IPlayer>; lobby: Partial<IPlayer[]> };

//     sessionStorage.setItem('activePlayer', JSON.stringify(player));

//     console.log(player);
//     console.log(lobby);

//     return { player, lobby };
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }
