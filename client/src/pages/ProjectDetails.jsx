import { Link, useParams } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import { usePageTitle, formatPrice } from "../utils.js";
import { useEffect, useState } from "react";
import Icon from "../components/Icons.jsx";
import Reveal from "../components/Reveal.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import PlotCard from "../components/PlotCard.jsx";
import Gallery from "../components/Gallery.jsx";
import MapEmbed from "../components/MapEmbed.jsx";
import CTABand from "../components/CTABand.jsx";
import NotFound from "../components/NotFound.jsx";

function ProgressBar({ percent }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 150);
    return () => clearTimeout(t);
  }, [percent]);
  return (
    <div className="progress__bar">
      <div className="progress__fill" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ProjectDetails() {
  const { slug } = useParams();
  const { data, getProject, plotsForProject } = useData();
  const project = data ? getProject(slug) : null;

  usePageTitle(project ? project.name : "Project");

  if (!data) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        Loading…
      </div>
    );
  }

  if (!project) return <NotFound label="project" />;

  const plots = plotsForProject(project.id);
  const amenities = data.amenities.filter((a) => project.amenities.includes(a.name));

  return (
    <>
      {/* Hero */}
      <section className="page-hero" style={{ paddingBottom: 84 }}>
        <div className="page-hero__bg" style={{ backgroundImage: `url(${project.image})` }} />
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <Icon name="chevron-right" size={13} />
            <Link to="/projects">Projects</Link>
            <Icon name="chevron-right" size={13} />
            <span>{project.name}</span>
          </nav>
          <h1 className="page-hero__title">{project.name}</h1>
          <div className="page-hero__meta">
            <span>
              <Icon name="map-pin" size={16} />
              {project.location}
            </span>
            <span>
              <Icon name="layers" size={16} />
              {project.totalArea}
            </span>
            <span>
              <Icon name="home" size={16} />
              {project.totalPlots} plots · {project.plotSize}
            </span>
          </div>
          <div className="pd-hero__badges">
            <span className="pd-hero__badge">{project.type}</span>
            <span className="pd-hero__badge pd-hero__badge--gold">{project.status}</span>
            <span className="pd-hero__badge">{project.approval}</span>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="section section--tight">
        <div className="container pd-overview__grid">
          <Reveal className="pd-overview__text">
            <SectionHeading eyebrow="Overview" title="The Vision" />
            {project.description.split("\n\n").map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
            <ul className="pd-features">
              {project.features.map((f) => (
                <li key={f}>
                  <Icon name="check-circle" size={17} />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="facts">
              <div className="fact">
                <span>Total Area</span>
                <strong>{project.totalArea}</strong>
              </div>
              <div className="fact">
                <span>Total Plots</span>
                <strong>{project.totalPlots}</strong>
              </div>
              <div className="fact">
                <span>Plot Size</span>
                <strong>{project.plotSize}</strong>
              </div>
              <div className="fact">
                <span>Road Network</span>
                <strong>{project.roadNetwork}</strong>
              </div>
              <div className="fact">
                <span>Price From</span>
                <strong>{formatPrice(project.priceFrom)}</strong>
              </div>
              <div className="fact">
                <span>Status</span>
                <strong>{project.status}</strong>
              </div>
              <div className="fact">
                <span>Approval</span>
                <strong>{project.approval}</strong>
              </div>
              <div className="fact">
                <span>Handover</span>
                <strong>{project.handover}</strong>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Master plan */}
      <section className="section masterplan">
        <div className="container">
          <SectionHeading
            eyebrow="Master Plan"
            title="Planned Around Real Life"
            description="A complete township layout — residential courts, green lungs, water bodies and a connected road hierarchy."
          />
          <Reveal>
            <figure>
              <img
                src={`/images/masterplan-${project.id === "green-valley-township" ? "greenvalley" : project.id === "lakeview-city" ? "lakeview" : "metro"}.svg`}
                alt={`${project.name} master plan`}
              />
              <figcaption>
                <span>
                  <span className="legend-dot" style={{ background: "#E7E0CB", border: "1px solid #CFC7AE" }} />
                  Residential plots
                </span>
                <span>
                  <span className="legend-dot" style={{ background: "#BBD2A8" }} />
                  Parks &amp; greens
                </span>
                <span>
                  <span className="legend-dot" style={{ background: "#AFD0D6" }} />
                  Lake / water
                </span>
                <span>
                  <span className="legend-dot" style={{ background: "#E2D9BE" }} />
                  Commercial
                </span>
                <em style={{ marginLeft: "auto", fontStyle: "normal", color: "var(--muted)" }}>
                  Illustrative plan — not to scale
                </em>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* Plot types */}
      <section className="section">
        <div className="container">
          <SectionHeading
            align="center"
            eyebrow="Plot Types"
            title="Available Plot Types"
          />
          <div className="ptypes">
            {project.plotTypes.map((pt, i) => (
              <Reveal className="ptype-card" key={pt.name} delay={i * 80}>
                <h3 className="ptype-card__name">{pt.name}</h3>
                <span className="ptype-card__size">{pt.size}</span>
                <p className="ptype-card__note">{pt.note}</p>
                <div className="ptype-card__price">
                  Starting from
                  <strong>{formatPrice(pt.priceFrom)}</strong>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities + Nearby */}
      <section className="section section--warm">
        <div className="container">
          <SectionHeading
            eyebrow="Amenities"
            title="Inside the Community"
          />
          <div className="amen__grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 72 }}>
            {amenities.map((a, i) => (
              <Reveal className="amen-card" key={a.name} delay={(i % 5) * 60}>
                <span className="amen-card__icon">
                  <Icon name={a.icon} size={24} />
                </span>
                <h3 className="amen-card__title">{a.name}</h3>
              </Reveal>
            ))}
          </div>

          <SectionHeading
            eyebrow="Nearby"
            title="Everything Close By"
            description="Drive times from the project entrance, measured in typical daytime traffic."
          />
          <Reveal>
            <div className="nearby">
              {project.nearby.map((n) => (
                <div className="nearby-row" key={n.name}>
                  <span className="nearby-row-icon">
                    <Icon name={n.icon} size={19} />
                  </span>
                  <strong>{n.name}</strong>
                  <span>{n.time}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Map */}
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Location"
            title="Find Us on the Map"
          />
          <Reveal>
            <MapEmbed coords={project.coordinates} span={0.025} title={`${project.name} map`} className="loc__map" />
          </Reveal>
        </div>
      </section>

      {/* Gallery */}
      <section className="section section--warm">
        <div className="container">
          <SectionHeading
            eyebrow="Gallery"
            title={`${project.name} in Pictures`}
          />
          <Gallery images={project.gallery} columns={3} aspect="4/3" />
        </div>
      </section>

      {/* Progress */}
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Transparency"
            title="Development Progress"
            description="Updated monthly. Ask your advisor for the latest site report and photos."
          />
          <Reveal>
            <div className="progress">
              {project.progress.map((row) => (
                <div className="progress-row" key={row.label}>
                  <div className="progress-row__top">
                    <strong>{row.label}</strong>
                    <span>{row.percent}%</span>
                  </div>
                  <ProgressBar percent={row.percent} />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Documents */}
      <section className="section section--warm">
        <div className="container">
          <SectionHeading
            eyebrow="Documents"
            title="Approvals & Legal Papers"
            description="Every document below is available for inspection at our office before you commit."
          />
          <div className="docs">
            {project.documents.map((d, i) => (
              <Reveal className="doc-item" key={d.name} delay={(i % 2) * 70}>
                <span className="doc-item__icon">
                  <Icon name="file" size={21} />
                </span>
                <div>
                  <strong>{d.name}</strong>
                  <span>{d.type} · {d.size}</span>
                </div>
                <Icon name="download" size={18} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Available plots */}
      <section className="section">
        <div className="container">
          <div className="plots__head">
            <SectionHeading
              eyebrow="Availability"
              title={`Plots in ${project.name}`}
              description="Live status — what you see is what's actually on the table today."
            />
            <Reveal>
              <Link to={`/plots?project=${project.id}`} className="btn btn--outline">
                Filter All Plots
              </Link>
            </Reveal>
          </div>
          <div className="plots__grid">
            {plots.map((plot, i) => (
              <PlotCard key={plot.id} plot={plot} project={project} delay={(i % 3) * 80} />
            ))}
          </div>
        </div>
      </section>

      <CTABand
        title={`Visit ${project.name} This Weekend`}
        text="Walk the roads, stand on your future plot and meet the team on site."
        image={project.image}
      />
    </>
  );
}
