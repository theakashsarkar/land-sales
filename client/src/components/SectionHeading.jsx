import Reveal from "./Reveal.jsx";

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  light = false,
}) {
  return (
    <Reveal
      className={`sec-head sec-head--${align} ${light ? "sec-head--light" : ""}`}
    >
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="sec-head__title">{title}</h2>
      {description && <p className="sec-head__desc">{description}</p>}
    </Reveal>
  );
}
