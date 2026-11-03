import { Platform } from "react-native";
import { GoogleOneTapSignIn } from "react-native-nitro-google-signin";
import { googleClientIds, signInWithGoogleIdToken } from "./auth-service";
import { runNativeGoogleSignIn } from "./native-google-flow";
export function signInWithNativeGoogle() {
  return runNativeGoogleSignIn(GoogleOneTapSignIn, googleClientIds(), Platform.OS, signInWithGoogleIdToken);
}
