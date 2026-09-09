import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { DataProvider } from "./context/DataContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectDetails from "./pages/ProjectDetails.jsx";
import Plots from "./pages/Plots.jsx";
import PlotDetails from "./pages/PlotDetails.jsx";
import Contact from "./pages/Contact.jsx";

function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      // Wait a frame so the target section is mounted.
      requestAnimationFrame(() => {
        const el = document.querySelector(location.hash);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 84;
          window.scrollTo({ top, behavior: "smooth" });
          return;
        }
        window.scrollTo(0, 0);
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash, location.key]);

  return null;
}

export default function App() {
  return (
    <DataProvider>
      <ScrollManager />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:slug" element={<ProjectDetails />} />
          <Route path="/plots" element={<Plots />} />
          <Route path="/plots/:id" element={<PlotDetails />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </DataProvider>
  );
}
