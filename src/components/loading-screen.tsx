import { ActivityIndicator, View } from "react-native";

import { useColors } from "@/theme/theme";

export function LoadingScreen() {
  const colors = useColors();
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
