import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";

export default function AccountScreen() {
  const authState = useAuth();

  function handleSignOut() {
    Alert.alert("Sign Out", "Sign out of AutoDeck Studio?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => void signOut(auth),
      },
    ]);
  }

  if (authState.status !== "ready") {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.email}>{authState.user.email}</Text>
      <Text style={styles.role}>{authState.claims.role}</Text>
      {authState.claims.studioId && <Text style={styles.studio}>Studio: {authState.claims.studioId}</Text>}

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  centered: { justifyContent: "center", alignItems: "center" },
  email: { fontSize: 20, fontWeight: "700", marginTop: 32, marginBottom: 4 },
  role: { fontSize: 14, color: "#666", textTransform: "capitalize" },
  studio: { fontSize: 13, color: "#888", marginTop: 4, marginBottom: 32 },
  signOutButton: {
    marginTop: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
  },
  signOutText: { color: "#c00", fontWeight: "500" },
});
