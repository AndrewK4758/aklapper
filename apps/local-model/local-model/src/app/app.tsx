import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <div>
        <h1>Welcome</h1>
      </div>
    )
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}

export default App;
