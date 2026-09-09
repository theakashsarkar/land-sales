import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Logo from "./Logo.jsx";
import Icon from "./Icons.jsx";
import { useData } from "../context/DataContext.jsx";
import { telHref } from "../utils.js";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/#about", label: "About", hash: true },
  { to: "/projects", label: "Projects" },
  { to: "/plots", label: "Land / Plots" },
  { to: "/#amenities", label: "Amenities", hash: true },
  { to: "/#location", label: "Location", hash: true },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { data } = useData();
  const phone = data?.settings.contact.phoneDisplay ?? "+880 1712-345 678";
  const phoneRaw = data?.settings.contact.phoneHref ?? "+8801712345678";

  // Transparent-on-hero only applies to the home page before scrolling.
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", open);
    return () => document.body.classList.remove("no-scroll");
  }, [open]);

  return (
    <>
      <header className={`nav ${overHero ? "nav--overlay" : ""} ${open ? "nav--open" : ""}`}>
        <div className="container nav__inner">
          <Link to="/" className="nav__brand" aria-label="Bhumi Landmarks — home">
            <Logo variant={overHero ? "light" : "dark"} />
          </Link>

          <nav className="nav__links" aria-label="Primary">
            {LINKS.map((l) =>
              l.hash ? (
                <Link key={l.label} to={l.to} className="nav__link">
                  {l.label}
                </Link>
              ) : (
                <NavLink
                  key={l.label}
                  to={l.to}
                  className={({ isActive }) =>
                    `nav__link ${isActive ? "is-active" : ""}`
                  }
                  end={l.to === "/"}
                >
                  {l.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="nav__actions">
            <a href={telHref(phoneRaw)} className="nav__phone">
              <Icon name="phone" size={16} />
              <span>{phone}</span>
            </a>
            <Link to="/plots" className="btn btn--gold btn--sm">
              Find Your Plot
            </Link>
            <button
              className="nav__burger"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <Icon name={open ? "x" : "menu"} size={22} />
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${open ? "is-open" : ""}`}>
        <nav className="mobile-menu__links" aria-label="Mobile">
          {LINKS.map((l, i) => (
            <Link
              key={l.label}
              to={l.to}
              className="mobile-menu__link"
              style={{ transitionDelay: `${60 + i * 40}ms` }}
              onClick={() => setOpen(false)}
            >
              {l.label}
              <Icon name="arrow-up-right" size={18} />
            </Link>
          ))}
        </nav>
        <div className="mobile-menu__foot">
          <Link to="/plots" className="btn btn--gold btn--block" onClick={() => setOpen(false)}>
            Find Your Plot
          </Link>
          <a href={telHref(phoneRaw)} className="mobile-menu__phone">
            <Icon name="phone" size={16} /> {phone}
          </a>
        </div>
      </div>
    </>
  );
}
