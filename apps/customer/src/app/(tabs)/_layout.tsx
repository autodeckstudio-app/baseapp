import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#1a1a1a" }}>
      <Tabs.Screen
        name="vehicles"
        options={{ title: "My Cars", tabBarLabel: "Cars" }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{ title: "Services", tabBarLabel: "Services" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Me" }}
      />
    </Tabs>
  );
}
