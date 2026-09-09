import { Link, useParams } from "react-router-dom";
import { useData } from "../context/DataContext.jsx";
import { usePageTitle, formatPrice, kathaToSqft, telHref, waHref } from "../utils.js";
import Icon from "../components/Icons.jsx";
import Reveal from "../components/Reveal.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import PlotCard from "../components/PlotCard.jsx";
import Gallery from "../components/Gallery.jsx";
import MapEmbed from "../components/MapEmbed.jsx";
import CTABand from "../components/CTABand.jsx";
import NotFound from "../components/NotFound.jsx";

export default function PlotDetails() {
  const { id } = useParams();
  const { data, getPlot } = useData();
  const plot = data ? getPlot(id) : null;

  const project = data && plot ? data.projects.find((p) => p.id === plot.projectId) : null;

  usePageTitle(plot ? `Plot ${plot.id}` : "Plot");

  if (!data) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        Loading…
      </div>
    );
  }

  if (!plot) return <NotFound label="plot" />;

  const c = data.settings.contact;
  const amenities = project
    ? data.amenities.filter((a) => project.amenities.includes(a.name))
    : [];
  const otherPlots = data.plots.filter(
    (p) => p.projectId === plot.projectId && p.id !== plot.id
  );

  return (
    <>
      {/* Hero row */}
      <section className="section" style={{ paddingTop: `calc(var(--nav-h) + 40px)` }}>
        <div className="container">
          <nav className="crumbs crumbs--on-white" aria-label="Breadcrumb" style={{ marginBottom: 28 }}>
            <Link to="/">Home</Link>
            <Icon name="chevron-right" size={13} />
            <Link to="/plots">Plots</Link>
            <Icon name="chevron-right" size={13} />
            <span>{plot.id}</span>
          </nav>

          <div className="pltd__grid">
            <Reveal className="pltd__media">
              <img src={plot.image} alt={`Plot ${plot.id}`} />
              <StatusBadge status={plot.status} />
            </Reveal>

            <Reveal className="pltd__panel" delay={100}>
              <div className="pltd__panel-id">
                <h1>{plot.id}</h1>
                <StatusBadge status={plot.status} />
              </div>
              <div className="pltd__price">
                <strong>{formatPrice(plot.price)}</strong>
                <span>
                  ৳ {Math.round(plot.price / plot.size)} Lac per katha · negotiable for genuine buyers
                </span>
              </div>
              <div className="spec-row">
                <Icon name="layers" size={17} />
                <em>Size</em>
                <strong>
                  {plot.size} Katha <span style={{ color: "var(--muted)", fontWeight: 500 }}>(≈ {kathaToSqft(plot.size)} sqft)</span>
                </strong>
              </div>
              <div className="spec-row">
                <Icon name="road" size={17} />
                <em>Road</em>
                <strong>{plot.roadWidth} ft wide</strong>
              </div>
              <div className="spec-row">
                <Icon name="compass" size={17} />
                <em>Facing</em>
                <strong>{plot.facing}</strong>
              </div>
              <div className="spec-row">
                <Icon name="home" size={17} />
                <em>Type</em>
                <strong style={{ textTransform: "capitalize" }}>{plot.type}</strong>
              </div>
              <div className="spec-row">
                <Icon name="map-pin" size={17} />
                <em>Location</em>
                <strong>{project ? `${project.location}, ${project.city}` : "—"}</strong>
              </div>
              {project && (
                <div className="spec-row">
                  <Icon name="plan" size={17} />
                  <em>Project</em>
                  <strong>
                    <Link to={`/projects/${project.slug}`}>{project.name}</Link>
                  </strong>
                </div>
              )}

              <div className="pltd__actions">
                <Link
                  to={`/contact?plot=${plot.id}&project=${plot.projectId}&interest=visit`}
                  className="btn btn--primary btn--lg"
                >
                  <Icon name="calendar" size={17} />
                  Book a Site Visit
                </Link>
                <Link
                  to={`/contact?plot=${plot.id}&project=${plot.projectId}`}
                  className="btn btn--outline btn--lg"
                >
                  Request Information
                </Link>
                <div className="pltd__actions-row">
                  <a href={telHref(c.phoneHref)} className="btn btn--gold">
                    <Icon name="phone" size={16} />
                    Call Now
                  </a>
                  <a
                    href={waHref(c.whatsapp, `Hello, I'm interested in plot ${plot.id} (${plot.size} Katha, ${formatPrice(plot.price)}). Is it still available?`)}
                    className="btn btn--outline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="whatsapp" size={16} />
                    WhatsApp
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="section section--tight">
        <div className="container">
          <SectionHeading eyebrow="About This Plot" title={`Why ${plot.id} Works`} />
          <Reveal>
            <p className="pltd__description">{plot.description}</p>
            <span className="pltd__note">
              <Icon name="shield" size={17} />
              Clear title · RAJUK-approved layout · Mutation support included
            </span>
          </Reveal>
        </div>
      </section>

      {/* Map + nearby */}
      <section className="section section--warm">
        <div className="container">
          <div className="loc__grid">
            <Reveal>
              <MapEmbed
                coords={project ? project.coordinates : "23.8103,90.4293"}
                span={0.02}
                title="Plot location map"
                className="loc__map"
              />
            </Reveal>
            <Reveal delay={100}>
              <SectionHeading
                eyebrow="Location"
                title="Around the Plot"
                description={project ? project.tagline : undefined}
              />
              <div className="loc__points">
                {(project ? project.nearby : []).map((n) => (
                  <div className="loc__point" key={n.name}>
                    <span className="loc__point-icon">
                      <Icon name={n.icon} size={19} />
                    </span>
                    <span className="loc__point-name">{n.name}</span>
                    <span className="loc__point-time">{n.time}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Amenities */}
      {amenities.length > 0 && (
        <section className="section">
          <div className="container">
            <SectionHeading
              align="center"
              eyebrow="Amenities"
              title="Community Amenities"
            />
            <div className="amen__grid">
              {amenities.map((a, i) => (
                <Reveal className="amen-card" key={a.name} delay={(i % 5) * 60}>
                  <span className="amen-card__icon">
                    <Icon name={a.icon} size={24} />
                  </span>
                  <h3 className="amen-card__title">{a.name}</h3>
                  <p className="amen-card__desc">{a.description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Project card */}
      {project && (
        <section className="section section--warm">
          <div className="container">
            <SectionHeading eyebrow="The Project" title={`About ${project.name}`} />
            <Reveal>
              <div
                className="project-card"
                style={{ flexDirection: "row", alignItems: "stretch" }}
              >
                <Link to={`/projects/${project.slug}`} className="project-card__media" style={{ aspectRatio: "auto", minHeight: 240, maxWidth: 420, flex: 1 }}>
                  <img src={project.image} alt={project.name} />
                </Link>
                <div className="project-card__body" style={{ justifyContent: "center" }}>
                  <div className="project-card__loc">
                    <Icon name="map-pin" size={14} />
                    {project.location}
                  </div>
                  <h3 className="project-card__name">
                    <Link to={`/projects/${project.slug}`}>{project.name}</Link>
                  </h3>
                  <p className="project-card__desc" style={{ WebkitLineClamp: 3 }}>
                    {project.shortDescription}
                  </p>
                  <div className="project-card__meta">
                    <div>
                      <span>Plot Size</span>
                      <strong>{project.plotSize}</strong>
                    </div>
                    <div>
                      <span>Total Plots</span>
                      <strong>{project.totalPlots}</strong>
                    </div>
                    <div>
                      <span>From</span>
                      <strong>{formatPrice(project.priceFrom)}</strong>
                    </div>
                  </div>
                  <Link to={`/projects/${project.slug}`} className="text-link">
                    View Full Project <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* Gallery */}
      {project && (
        <section className="section">
          <div className="container">
            <SectionHeading
              eyebrow="Gallery"
              title={`${project.name} Gallery`}
            />
            <Gallery images={project.gallery} columns={3} aspect="4/3" />
          </div>
        </section>
      )}

      {/* Other plots */}
      {otherPlots.length > 0 && (
        <section className="section section--warm">
          <div className="container">
            <div className="plots__head">
              <SectionHeading
                eyebrow="Also Available"
                title={`More Plots in ${project.name}`}
              />
              <Reveal>
                <Link to={`/plots?project=${plot.projectId}`} className="btn btn--outline">
                  View All
                </Link>
              </Reveal>
            </div>
            <div className="plots__grid">
              {otherPlots.slice(0, 3).map((p, i) => (
                <PlotCard key={p.id} plot={p} project={project} delay={(i % 3) * 80} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CTABand
        title={`Stand on Plot ${plot.id} Before You Buy`}
        text="We'll pick you up, walk you through the block and answer every question on site."
        image={project ? project.image : undefined}
      />
    </>
  );
}
