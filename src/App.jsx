import { Routes, Route } from "react-router-dom";
import JobsList from "./pages/JobsList.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<JobsList />} />
    </Routes>
  );
}
