import { mapEmbedUrl } from "../utils.js";

export default function MapEmbed({ coords, span = 0.02, title = "Location map", className = "" }) {
  return (
    <div className={`map-embed ${className}`}>
      <iframe
        title={title}
        src={mapEmbedUrl(coords, span)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
