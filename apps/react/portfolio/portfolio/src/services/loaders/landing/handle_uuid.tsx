export default async function handleUUID() {
  try {
    const cookie = 'userID=TEMP_ID';

    localStorage.setItem('userID', cookie.split('=')[1]);
    const cookies = document.cookie;

    console.log(cookies);
  } catch (error) {
    console.error(error);
  }
}
