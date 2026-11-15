// Dev-only: the REAL booking detail screen with sample data (?mock=1&id=sample). No network.
import BookingDetailScreen from "./(tabs)/bookings/[id]";

export default function PreviewBooking() {
  if (!__DEV__) return null;
  return <BookingDetailScreen />;
}
