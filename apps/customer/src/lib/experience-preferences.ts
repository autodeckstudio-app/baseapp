import AsyncStorage from "@react-native-async-storage/async-storage";

const activeVehicleKey = (customerId: string) =>
  `autodeck:customer:${customerId}:active-vehicle`;

export async function getActiveVehicleId(
  customerId: string,
): Promise<string | null> {
  return AsyncStorage.getItem(activeVehicleKey(customerId));
}

export async function setActiveVehicleId(
  customerId: string,
  vehicleId: string,
): Promise<void> {
  await AsyncStorage.setItem(activeVehicleKey(customerId), vehicleId);
}
