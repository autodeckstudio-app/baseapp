import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { signOut } from "../../lib/auth-service";
import { useAuth } from "../../hooks/useAuth";

export default function ProfileScreen() {
  const auth = useAuth();

  async function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of AutoDeck?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  if (auth.status !== "ready") return null;

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{auth.user.displayName ?? "Customer"}</Text>
      <Text style={styles.phone}>{auth.user.phoneNumber}</Text>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  name: { fontSize: 24, fontWeight: "700", marginTop: 32, marginBottom: 4 },
  phone: { fontSize: 16, color: "#666", marginBottom: 32 },
  signOutButton: { padding: 16, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, alignItems: "center" },
  signOutText: { color: "#c00", fontWeight: "500" },
});
