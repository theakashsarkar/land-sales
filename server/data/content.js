// ------------------------------------------------------------------
// Site content — stats, categories, amenities, why-us, testimonials,
// location storytelling, gallery, investment points.
// ------------------------------------------------------------------

export const stats = [
  { value: 15, suffix: "+", label: "Years of Experience" },
  { value: 1000, suffix: "+", label: "Happy Families" },
  { value: 10, suffix: "+", label: "Land Projects" },
  { value: 500, suffix: "+", label: "Plots Sold" },
];

export const categories = [
  {
    type: "residential",
    title: "Residential Plots",
    description:
      "Ready-to-build plots in planned townships for the home your family deserves.",
    image: "/images/cat-residential.jpg",
    icon: "home",
  },
  {
    type: "commercial",
    title: "Commercial Plots",
    description:
      "Boulevard-frontage plots for offices, showrooms and retail development.",
    image: "/images/cat-commercial.jpg",
    icon: "building",
  },
  {
    type: "investment",
    title: "Investment Plots",
    description:
      "Carefully selected plots on high-growth corridors for long-term value.",
    image: "/images/cat-investment.jpg",
    icon: "trend",
  },
  {
    type: "large",
    title: "Large & Estate Plots",
    description:
      "10+ katha estates for apartments, institutions and larger developments.",
    image: "/images/cat-large.jpg",
    icon: "layers",
  },
];

export const amenities = [
  {
    name: "Wide Roads",
    icon: "road",
    description: "30–120 ft metaled roads with covered drains and street lighting.",
  },
  {
    name: "Central Park & Greens",
    icon: "tree",
    description: "Acres of landscaped parks, walking trails and open lawns.",
  },
  {
    name: "Lake & Waterfront",
    icon: "waves",
    description: "Natural lakescapes with promenades and seating decks.",
  },
  {
    name: "Mosque",
    icon: "mosque",
    description: "Serene prayer spaces at a walkable distance in every zone.",
  },
  {
    name: "School & College Plot",
    icon: "school",
    description: "Reserved land for reputed educational institutions.",
  },
  {
    name: "Hospital Zone",
    icon: "hospital",
    description: "Dedicated healthcare plots with clinic and diagnostic facilities.",
  },
  {
    name: "Children's Playground",
    icon: "play",
    description: "Safe, modern play zones inside every park.",
  },
  {
    name: "Shopping Center",
    icon: "shopping",
    description: "Convenient retail arcades for daily needs and boutiques.",
  },
  {
    name: "24/7 Security",
    icon: "shield",
    description: "Gated communities with CCTV surveillance and trained guards.",
  },
  {
    name: "Community Center",
    icon: "users",
    description: "Elegant spaces for celebrations, gatherings and social events.",
  },
];

export const whyChooseUs = [
  {
    title: "Prime Location",
    icon: "pin",
    description:
      "Every project is selected on a strategically valuable growth corridor — never on speculation.",
  },
  {
    title: "Secure Investment",
    icon: "shield",
    description:
      "Clear titles, approved layouts and registered mutations protect your ownership for the long term.",
  },
  {
    title: "Transparent Process",
    icon: "file",
    description:
      "Fixed pricing, written schedules and honest documents at every step of the buying journey.",
  },
  {
    title: "Planned Development",
    icon: "plan",
    description:
      "Master-planned communities with roads, utilities and green space delivered as promised.",
  },
  {
    title: "Legal Support",
    icon: "scale",
    description:
      "In-house legal team handles due diligence, registration and mutation end-to-end.",
  },
  {
    title: "Trusted Service",
    icon: "heart",
    description:
      "A dedicated relationship manager from your first inquiry to post-handover support.",
  },
];

export const testimonials = [
  {
    name: "Farhan Ahmed",
    location: "Gulshan-2, Dhaka",
    project: "Green Valley Township",
    rating: 5,
    image: "/images/avatar-1.jpg",
    quote:
      "The entire process was transparent and professional. The location planning and road network were exactly what we were looking for — we broke ground on our home six months after registration.",
  },
  {
    name: "Nusrat Jahan",
    location: "Dhanmondi, Dhaka",
    project: "Lakeview City",
    rating: 5,
    image: "/images/avatar-2.jpg",
    quote:
      "We compared four developers before choosing Lakeview City. Bhumi was the only team that walked us through the mutation papers plot by plot, without any pressure to book.",
  },
  {
    name: "Rezaul Karim",
    location: "Uttara Sector 7, Dhaka",
    project: "Green Valley Township",
    rating: 5,
    image: "/images/avatar-3.jpg",
    quote:
      "As an overseas buyer I needed a team I could trust completely. Video site visits, scanned documents, a proper power of attorney process — everything was handled exactly as promised.",
  },
  {
    name: "Sadia Rahman",
    location: "Chattogram",
    project: "Lakeview City",
    rating: 5,
    image: "/images/avatar-4.jpg",
    quote:
      "I bought a lake-facing plot mostly as an investment, and the appreciation in just two years has already outperformed everything else in my portfolio.",
  },
  {
    name: "Mahmud Hasan",
    location: "Toronto, Canada",
    project: "Metro Business Park",
    rating: 5,
    image: "/images/avatar-5.jpg",
    quote:
      "The priority registration for Metro Business Park was seamless. Their advisor understood exactly what an NRB investor needs — documentation first, promises later.",
  },
];

export const homeLocation = {
  eyebrow: "Location",
  heading: "Location That Adds Value",
  description:
    "Our flagship township sits on the Purbachal growth axis — Dhaka's most significant planned urban expansion, built around the 300-feet expressway and the new central business district.",
  mapQuery: "Purbachal New Town, Dhaka",
  coordinates: "23.8103,90.4293",
  points: [
    { name: "300-feet Purbachal Expressway", time: "5 min", icon: "road" },
    { name: "Jamuna Future Park", time: "12 min", icon: "shopping" },
    { name: "North South University", time: "15 min", icon: "school" },
    { name: "United Hospital, Gulshan", time: "18 min", icon: "hospital" },
    { name: "Hazrat Shahjalal Int'l Airport", time: "20 min", icon: "plane" },
    { name: "Gulshan-2 Business District", time: "25 min", icon: "building" },
  ],
};

export const investmentPoints = [
  {
    title: "Location Advantage",
    description: "Land on planned corridors like Purbachal appreciates as the city grows toward it.",
    icon: "pin",
  },
  {
    title: "Development Potential",
    description: "Approved layouts mean you can build, lease or resell whenever you choose.",
    icon: "plan",
  },
  {
    title: "Long-term Value",
    description: "Land in Dhaka's planned townships has historically outpaced most asset classes.",
    icon: "trend",
  },
  {
    title: "Infrastructure Growth",
    description: "Expressways, metro lines and utilities keep compounding the value of nearby land.",
    icon: "road",
  },
  {
    title: "Residential Demand",
    description: "Dhaka needs tens of thousands of new homes every year — and the land to build them.",
    icon: "home",
  },
];

export const gallery = [
  { src: "/images/gallery-boulevard.jpg", caption: "60 ft main boulevard — Green Valley", tag: "Development" },
  { src: "/images/gallery-lake.jpg", caption: "Central lake & promenade", tag: "Landscape" },
  { src: "/images/project-greenvalley.jpg", caption: "Aerial view across Phase 1", tag: "Aerial" },
  { src: "/images/gallery-construction.jpg", caption: "Road works in Block C", tag: "Progress" },
  { src: "/images/gallery-sitevisit.jpg", caption: "Client site visit, 2026", tag: "Events" },
  { src: "/images/gallery-park.jpg", caption: "Sunday morning at the park", tag: "Landscape" },
  { src: "/images/gallery-villa.jpg", caption: "Show home — Lakeview City", tag: "Development" },
  { src: "/images/gallery-plan.jpg", caption: "Planning studio, on site", tag: "Progress" },
  { src: "/images/gallery-city.jpg", caption: "The new eastern skyline", tag: "Aerial" },
  { src: "/images/gallery-forest.jpg", caption: "Green buffers between zones", tag: "Landscape" },
];
