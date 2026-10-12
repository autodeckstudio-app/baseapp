// Dev-only: the real Studio screen without a session.
import StudioScreen from "./(tabs)/studio";
export default function PreviewStudio() { return __DEV__ ? <StudioScreen /> : null; }
