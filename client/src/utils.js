export function formatPrice(lakh) {
  if (lakh == null) return "Price on request";
  if (lakh >= 100) return `৳ ${(lakh / 100).toFixed(2).replace(/\.00$/, "")} Cr`;
  return `৳ ${lakh} Lac`;
}

export function kathaToSqft(katha) {
  return Math.round(katha * 720).toLocaleString("en-US");
}

export function telHref(phone) {
  return `tel:${phone}`;
}

export function waHref(whatsapp, text) {
  const base = `https://wa.me/${whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function mapEmbedUrl(coords, span = 0.02) {
  const [lat, lng] = String(coords).split(",").map(Number);
  const bbox = [lng - span, lat - span / 2, lng + span, lat + span / 2]
    .map((n) => n.toFixed(5))
    .join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function usePageTitle(title) {
  if (typeof document !== "undefined") {
    document.title = title
      ? `${title} — Bhumi Landmarks`
      : "Bhumi Landmarks — Premium Land & Plots in Dhaka";
  }
}
