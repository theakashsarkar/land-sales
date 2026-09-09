import { Link } from "react-router-dom";
import Icon from "./Icons.jsx";
import Reveal from "./Reveal.jsx";
import { formatPrice } from "../utils.js";

export default function ProjectCard({ project, delay = 0 }) {
  return (
    <Reveal className="project-card" delay={delay}>
      <Link to={`/projects/${project.slug}`} className="project-card__media">
        <img src={project.thumb} alt={project.name} loading="lazy" />
        <span className="project-card__type">{project.type}</span>
        <span className={`project-card__status project-card__status--${project.statusKind}`}>
          {project.status}
        </span>
      </Link>
      <div className="project-card__body">
        <div className="project-card__loc">
          <Icon name="map-pin" size={14} />
          {project.location}
        </div>
        <h3 className="project-card__name">
          <Link to={`/projects/${project.slug}`}>{project.name}</Link>
        </h3>
        <p className="project-card__desc">{project.shortDescription}</p>
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
          View Project <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </Reveal>
  );
}
