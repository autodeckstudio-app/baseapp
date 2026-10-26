// One shared LocalBusiness schema for the homepage and the shared layout, so
// the two can never drift. Deliberately held back until owner-confirmed:
// geo coordinates (wait for the verified map pin), priceRange and any prices
// (the services sheet still marks prices unconfirmed).
export const localBusiness = {
  '@context': 'https://schema.org',
  '@type': 'AutoRepair',
  '@id': 'https://www.autodeck.in/#business',
  name: 'AutoDeck',
  url: 'https://www.autodeck.in',
  image: 'https://www.autodeck.in/assets/og.png',
  logo: 'https://www.autodeck.in/assets/logo-horizontal.svg',
  telephone: '+91 98986 79711',
  email: 'autodeckstudio@gmail.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge',
    addressLocality: 'Ahmedabad',
    addressRegion: 'Gujarat',
    postalCode: '380006',
    addressCountry: 'IN',
  },
  areaServed: { '@type': 'City', name: 'Ahmedabad' },
  hasMap: 'https://www.google.com/maps/search/?api=1&query=Sunbeam+Complex+Old+Sharda+Mandir+Rd+Ellisbridge+Ahmedabad',
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '10:00', closes: '21:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '10:00', closes: '19:00' },
  ],
  sameAs: ['https://instagram.com/autodeck.studio'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Car care services',
    itemListElement: ['Washing', 'Detailing', 'Ceramic coating', 'Paint protection film', 'Garage and repairs', 'Modifications'].map((name) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name, areaServed: { '@type': 'City', name: 'Ahmedabad' } },
    })),
  },
};
