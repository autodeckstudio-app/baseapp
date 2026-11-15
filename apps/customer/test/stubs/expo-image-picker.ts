// Live harness stub: the no-photo flow never opens the picker.
export const MediaTypeOptions = { Images: "Images" };
export const requestMediaLibraryPermissionsAsync = async () => ({ granted: false });
export const launchImageLibraryAsync = async () => { throw new Error("image picker not available in the live harness"); };
