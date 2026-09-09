import { Link } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import { usePageTitle } from "../utils.js";
import Icon from "../components/Icons.jsx";
import Reveal from "../components/Reveal.jsx";
import ProjectCard from "../components/ProjectCard.jsx";
import CTABand from "../components/CTABand.jsx";

export default function Projects() {
  usePageTitle("Our Projects");
  const { data } = useData();

  if (!data) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        Loading projects…
      </div>
    );
  }

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__bg" style={{ backgroundImage: "url(/images/gallery-city.jpg)" }} />
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <Icon name="chevron-right" size={13} />
            <span>Projects</span>
          </nav>
          <h1 className="page-hero__title">Explore Our Projects</h1>
          <p style={{ marginTop: 18, maxWidth: 560, color: "rgba(240,240,230,.85)", fontSize: 17 }}>
            Master-planned land communities across Dhaka — every one approved,
            documented and built around lasting value.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="projects__grid" style={{ marginTop: -20 }}>
            {data.projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} delay={i * 80} />
            ))}
          </div>

          <Reveal className="plots-page__empty">
            <h3>Looking for something specific?</h3>
            <p>
              Our advisors can shortlist plots that match your budget, size and
              timeline — often before they're publicly listed.
            </p>
            <Link to="/contact" className="btn btn--primary">
              Request a Shortlist
            </Link>
          </Reveal>
        </div>
      </section>

      <CTABand
        title="Walk the Land Before You Decide"
        text="Join a guided site visit this weekend and see the roads, parks and neighbourhood for yourself."
      />
    </>
  );
}
