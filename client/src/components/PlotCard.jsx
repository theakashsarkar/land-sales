import { Link } from "react-router-dom";
import Icon from "./Icons.jsx";
import Reveal from "./Reveal.jsx";
import StatusBadge from "./StatusBadge.jsx";
import { formatPrice, kathaToSqft } from "../utils.js";

export default function PlotCard({ plot, project, delay = 0 }) {
  return (
    <Reveal className={`plot-card plot-card--${plot.status}`} delay={delay}>
      <Link to={`/plots/${plot.id}`} className="plot-card__media">
        <img src={plot.image} alt={`Plot ${plot.id}`} loading="lazy" />
        <StatusBadge status={plot.status} />
        <span className="plot-card__id">{plot.id}</span>
      </Link>
      <div className="plot-card__body">
        <div className="plot-card__top">
          <div className="plot-card__price">
            <strong>{formatPrice(plot.price)}</strong>
            <span>৳ {Math.round(plot.price / plot.size)} Lac / Katha</span>
          </div>
          <div className="plot-card__size">
            <strong>{plot.size} Katha</strong>
            <span>≈ {kathaToSqft(plot.size)} sqft</span>
          </div>
        </div>
        <div className="plot-card__project">
          <Icon name="map-pin" size={14} />
          <span>{project ? project.name : plot.projectId}</span>
          {project && <em>· {project.location}</em>}
        </div>
        <div className="plot-card__specs">
          <span>
            <Icon name="road" size={14} /> {plot.roadWidth} ft road
          </span>
          <span>
            <Icon name="compass" size={14} /> {plot.facing}
          </span>
          <span className="plot-card__type">{plot.type}</span>
        </div>
        <Link to={`/plots/${plot.id}`} className="btn btn--outline btn--sm btn--block">
          View Details
        </Link>
      </div>
    </Reveal>
  );
}
