import { useRoutes } from "react-router-dom";
import routes from "./router/router.jsx";
import DragTop from "@/components/DragTop/DragTop.jsx";

import "./App.scss";
function App() {
  const element = useRoutes(routes);

  return (
    <div className="App">
      <div className="top">
        <DragTop />
      </div>
      <div className="app_contnet">{element}</div>
    </div>
  );
}

export default App;
