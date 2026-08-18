import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#1a1a1a" }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarLabel: "Home" }}
      />
      <Tabs.Screen
        name="garage"
        options={{ title: "Garage", tabBarLabel: "Garage" }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{ title: "Services", tabBarLabel: "Services" }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "My Bookings", tabBarLabel: "Bookings" }}
      />
      <Tabs.Screen
        name="membership"
        options={{ title: "Membership", tabBarLabel: "Club" }}
      />
      <Tabs.Screen
        name="book"
        options={{ href: null }} // booking flow, hidden from tab bar
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Notifications", href: null }} // accessed via Home bell icon, hidden from tab bar
      />
      <Tabs.Screen
        name="approvals"
        options={{ title: "Approval", href: null }} // accessed via notification tap, hidden from tab bar
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Me" }}
      />
    </Tabs>
  );
}
