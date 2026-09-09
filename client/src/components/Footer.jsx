import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";
import Icon from "./Icons.jsx";
import { useData } from "../context/DataContext.jsx";
import { telHref, waHref, mapEmbedUrl } from "../utils.js";

export default function Footer() {
  const { data } = useData();
  if (!data) return null;
  const { settings, projects } = data;
  const c = settings.contact;

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo variant="light" />
          <p>{settings.brand.short}</p>
          <div className="footer__socials">
            {settings.socials.map((s) => (
              <a key={s.name} href={s.url} aria-label={s.name} target="_blank" rel="noreferrer">
                <Icon name={s.name.toLowerCase()} size={17} />
              </a>
            ))}
          </div>
        </div>

        <nav className="footer__col" aria-label="Company">
          <h4>Company</h4>
          <Link to="/#about">About Us</Link>
          <Link to="/projects">Projects</Link>
          <Link to="/plots">Land / Plots</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        <nav className="footer__col" aria-label="Projects">
          <h4>Projects</h4>
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.slug}`}>
              {p.name}
            </Link>
          ))}
        </nav>

        <nav className="footer__col" aria-label="Support">
          <h4>Support</h4>
          <a href="#FAQ">FAQ</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms &amp; Conditions</a>
        </nav>

        <div className="footer__col footer__contact">
          <h4>Contact</h4>
          <a href={telHref(c.phoneHref)}>
            <Icon name="phone" size={15} /> {c.phoneDisplay}
          </a>
          <a href={`mailto:${c.email}`}>
            <Icon name="mail" size={15} /> {c.email}
          </a>
          <a href={waHref(c.whatsapp, "Hello, I'd like to know more about your plots.")} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={15} /> WhatsApp
          </a>
          <span className="footer__addr">
            <Icon name="map-pin" size={15} /> {c.address}
          </span>
        </div>
      </div>

      <div className="footer__map">
        <iframe
          title="Office location"
          src={mapEmbedUrl(c.coordinates, 0.012)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <span>© {new Date().getFullYear()} {settings.brand.legalName} All rights reserved.</span>
          <span className="footer__reg">{settings.brand.approval} · A company you can build on.</span>
          <button
            className="footer__top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Back to top"
          >
            <Icon name="arrow-up" size={16} />
          </button>
        </div>
      </div>
    </footer>
  );
}
