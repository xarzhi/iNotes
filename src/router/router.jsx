import Home from "@/views/Home/Home";
import Note from "@/views/Note/Note";
import Setting from "@/views/Setting/Setting";
const routes = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/note",
    element: <Note />,
  },
  {
    path: "/setting",
    element: <Setting />,
  },
];

export default routes;
