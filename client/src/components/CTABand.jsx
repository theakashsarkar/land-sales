import { Link } from "react-router-dom";
import Reveal from "./Reveal.jsx";
import Icon from "./Icons.jsx";
import { useData } from "../context/DataContext.jsx";
import { telHref } from "../utils.js";

// Full-width conversion band used near the bottom of key pages.
export default function CTABand({
  title = "See Your Future Property in Person",
  text = "Visit our projects and experience the location, surroundings and development for yourself.",
  image = "/images/cta-home.jpg",
}) {
  const { data } = useData();
  const phoneRaw = data?.settings.contact.phoneHref ?? "+8801712345678";

  return (
    <section className="cta-band" style={{ backgroundImage: `url(${image})` }}>
      <div className="cta-band__overlay" />
      <div className="container cta-band__inner">
        <Reveal>
          <span className="eyebrow eyebrow--gold">Book a Visit</span>
          <h2>{title}</h2>
          <p>{text}</p>
          <div className="cta-band__actions">
            <Link to="/contact?interest=visit" className="btn btn--gold btn--lg">
              <Icon name="calendar" size={17} />
              Book a Site Visit
            </Link>
            <a href={telHref(phoneRaw)} className="btn btn--ghost btn--lg">
              <Icon name="phone" size={17} />
              Call Now
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
