import { View, type ViewStyle } from "react-native";

/**
 * A faint Poké Ball outline drawn with Views (no SVG library), as a
 * watermark behind sprites. The parts are solid and the whole group is made
 * transparent at once, so overlapping strokes don't come out darker.
 */
export function PokeballMark({
  size,
  style,
  opacity = 0.07,
}: {
  size: number;
  /** Where to put it, usually absolute positioning. */
  style?: ViewStyle;
  opacity?: number;
}) {
  const stroke = Math.round(size * 0.1);
  const button = Math.round(size * 0.36);
  const bar = (size - button) / 2;
  return (
    <View
      pointerEvents="none"
      // Android only fades a group as a whole with this; otherwise each
      // child would get the opacity separately.
      needsOffscreenAlphaCompositing
      style={[{ width: size, height: size, opacity }, style]}
    >
      <View
        className="absolute inset-0 border-ink"
        style={{ borderRadius: size / 2, borderWidth: stroke }}
      />
      {/* The band across the middle, interrupted by the button. */}
      <View
        className="absolute left-0 bg-ink"
        style={{ top: (size - stroke) / 2, width: bar, height: stroke }}
      />
      <View
        className="absolute right-0 bg-ink"
        style={{ top: (size - stroke) / 2, width: bar, height: stroke }}
      />
      <View
        className="absolute border-ink"
        style={{
          left: bar,
          top: bar,
          width: button,
          height: button,
          borderRadius: button / 2,
          borderWidth: stroke,
        }}
      />
    </View>
  );
}
