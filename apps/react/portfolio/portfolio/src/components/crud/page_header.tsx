import CardHeader from '@mui/material/CardHeader';
import { CRUD_BODY, CRUD_TITLE } from '../../pages/static/crud-text.js';

export default function CrudHeader() {
  return <CardHeader id='crud-header' title={CRUD_TITLE} subheader={CRUD_BODY} />;
}
