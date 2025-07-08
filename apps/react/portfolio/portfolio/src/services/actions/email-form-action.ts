import axios from 'axios';

const baseUrl = import.meta.env.VITE_PORTFOLIO_API_URL;

const emailFormAction = async function (formData: FormData, setOpen: (open: boolean) => void) {
  try {
    const resp = await axios.postForm(`${baseUrl}/email`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (resp.status === 201) setOpen(false);
  } catch (error) {
    console.error(error);
  }
};

export default emailFormAction;
