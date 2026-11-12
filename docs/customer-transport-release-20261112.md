# Customer transport release, 12 November 2026

Approved confirmation delegated by Meet to Gauri. Immutable tariff base20-road12-v2: up to 3000m free; above 3000m through 5000m 2000paise; beyond 5000m 2000 + round((metres-5000)*1200/1000), per independently directed leg then sum. No peak tariff. Existing unversioned quotes use road25-v1 through original expiry; unknown ID fails closed. Existing bookings remain unchanged.

Five scoped UI fixes: honest quote-required pending states and subtotal, disabled visible payment choices until quote, default helper removed, strictly earlier pickup preference without focus-as-selection, full-width centered priced Book now and Continue. No global button mutation. No provider or paid routing tests. Backend artifacts use each deployed source closure with only audited transport patch.
{
  "getPickupQuote": {
    "sha256": "7f13da83cb3168e02fce639331304758075b0161bf8dc944da12222396341979",
    "bundleSha256": "bb1bad94d62ec85262ebbfa36b593087bbcc1c52101ef24d9c76fdf93a1b6522"
  },
  "createBooking": {
    "sha256": "91d7bfe3e5da4c4bb65c7bf5408e8345b9cd67852de9c9ea247ff373729e97c7",
    "bundleSha256": "c88ef11dcbb98aa9a18e43ad74d40d43ddc61b99f4122f27b43fdb3f46672295"
  },
  "requestPickupDrop": {
    "sha256": "918160f56d8ac77e4728c8d3eddcab1a186c62a4165951637c36985ff97875fd",
    "bundleSha256": "04a2ffd03bfa339a1a53d1244be399a579cf374f256cf2f75c52821c42a81180"
  }
}
