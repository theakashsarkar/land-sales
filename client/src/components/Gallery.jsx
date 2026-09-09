import { useCallback, useEffect, useState } from "react";
import Icon from "./Icons.jsx";
import Reveal from "./Reveal.jsx";

export function Lightbox({ images, index, onClose, onNavigate }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate(1);
      if (e.key === "ArrowLeft") onNavigate(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [onClose, onNavigate]);

  if (index == null) return null;
  const img = images[index];

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lightbox__close" aria-label="Close" onClick={onClose}>
        <Icon name="x" size={22} />
      </button>
      <button
        className="lightbox__nav lightbox__nav--prev"
        aria-label="Previous image"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(-1);
        }}
      >
        <Icon name="chevron-left" size={24} />
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={img.src} alt={img.caption || "Gallery image"} />
        {img.caption && <figcaption>{img.caption}</figcaption>}
      </figure>
      <button
        className="lightbox__nav lightbox__nav--next"
        aria-label="Next image"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(1);
        }}
      >
        <Icon name="chevron-right" size={24} />
      </button>
    </div>
  );
}

export default function Gallery({ images, columns = 3, aspect = "4/3" }) {
  const [index, setIndex] = useState(null);

  const navigate = useCallback(
    (dir) =>
      setIndex((i) => (i == null ? i : (i + dir + images.length) % images.length)),
    [images.length]
  );

  return (
    <>
      <div className={`gallery gallery--${columns}`}>
        {images.map((img, i) => (
          <Reveal key={img.src + i} delay={(i % 3) * 70} className="gallery__item">
            <button
              className="gallery__btn"
              onClick={() => setIndex(i)}
              aria-label={`Open image: ${img.caption || "gallery"}`}
            >
              <img
                src={img.src}
                alt={img.caption || "Gallery image"}
                loading="lazy"
                style={{ aspectRatio: aspect }}
              />
              {img.caption && (
                <span className="gallery__caption">
                  <Icon name="eye" size={16} />
                  {img.caption}
                </span>
              )}
            </button>
          </Reveal>
        ))}
      </div>
      {index != null && (
        <Lightbox
          images={images}
          index={index}
          onClose={() => setIndex(null)}
          onNavigate={navigate}
        />
      )}
    </>
  );
}
