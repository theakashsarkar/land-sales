import { useEffect, useRef, useState } from "react";
import Icon from "./Icons.jsx";

export default function TestimonialCarousel({ testimonials }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(
      () => setIndex((i) => (i + 1) % testimonials.length),
      6000
    );
    return () => clearInterval(timer.current);
  }, [paused, testimonials.length]);

  const go = (dir) =>
    setIndex((i) => (i + dir + testimonials.length) % testimonials.length);

  return (
    <div
      className="testi"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="testi__viewport">
        <div
          className="testi__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {testimonials.map((t) => (
            <figure className="testi__slide" key={t.name}>
              <div className="testi__card">
                <Icon name="quote" size={34} className="testi__quote-icon" />
                <blockquote>“{t.quote}”</blockquote>
                <div className="testi__stars" aria-label={`${t.rating} out of 5 stars`}>
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Icon key={i} name="star" size={15} />
                  ))}
                </div>
                <figcaption className="testi__person">
                  <img src={t.image} alt={t.name} loading="lazy" />
                  <div>
                    <strong>{t.name}</strong>
                    <span>
                      {t.location} · {t.project}
                    </span>
                  </div>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      </div>

      <div className="testi__controls">
        <button onClick={() => go(-1)} aria-label="Previous testimonial">
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="testi__dots">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={i === index ? "is-active" : ""}
              onClick={() => setIndex(i)}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
        <button onClick={() => go(1)} aria-label="Next testimonial">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
    </div>
  );
}
