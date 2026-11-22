import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  View,
  type ImageStyle,
} from "react-native";
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { TOWN_MAP_IMAGES } from "@/generated/town-map-images";
import { TOWN_MAPS, type TownMapId } from "@/lib/town-map";
import { useColors } from "@/theme/theme";

const PIXELATED =
  Platform.OS === "web"
    ? ({ imageRendering: "pixelated" } as unknown as ImageStyle)
    : null;

const MAX_ZOOM = 5;

export type MapRect = { x: number; y: number; width: number; height: number };

/**
 * A Town Map picture you can pinch, drag and tap. Rectangles are in the
 * picture's tiles: `marked` are filled with the accent (e.g. where a
 * Pokémon lives), `selected` is outlined. Tapping reports the tile.
 */
export function TownMap({
  map,
  marked = [],
  selected = [],
  onTapTile,
}: {
  map: TownMapId;
  marked?: MapRect[];
  selected?: MapRect[];
  onTapTile?: (col: number, row: number) => void;
}) {
  const colors = useColors();
  const { cols, rows } = TOWN_MAPS[map];
  const [width, setWidth] = useState(0);
  const height = (width * rows) / cols;
  const tile = width / cols;

  // Picture position: screen point = translate + scale × picture point.
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 1, tx: 0, ty: 0 });

  /** Keeps the picture covering the frame. */
  const clamp = (s: number, x: number, y: number) => {
    "worklet";
    return {
      x: Math.min(0, Math.max(width - width * s, x)),
      y: Math.min(0, Math.max(height - height * s, y)),
    };
  };
  const zoomAround = (s: number, fx: number, fy: number, animate: boolean) => {
    "worklet";
    const next = Math.min(MAX_ZOOM, Math.max(1, s));
    const ratio = next / scale.get();
    const { x, y } = clamp(
      next,
      fx - (fx - tx.get()) * ratio,
      fy - (fy - ty.get()) * ratio,
    );
    if (animate) {
      scale.set(withTiming(next));
      tx.set(withTiming(x));
      ty.set(withTiming(y));
    } else {
      scale.set(next);
      tx.set(x);
      ty.set(y);
    }
  };
  const remember = () => {
    "worklet";
    start.set({ scale: scale.get(), tx: tx.get(), ty: ty.get() });
  };

  const pinch = usePinchGesture({
    onBegin: remember,
    onUpdate: (e) => {
      "worklet";
      const s0 = start.get();
      const next = Math.min(MAX_ZOOM, Math.max(1, s0.scale * e.scale));
      const ratio = next / s0.scale;
      const { x, y } = clamp(
        next,
        e.focalX - (e.focalX - s0.tx) * ratio,
        e.focalY - (e.focalY - s0.ty) * ratio,
      );
      scale.set(next);
      tx.set(x);
      ty.set(y);
    },
  });
  const pan = usePanGesture({
    minDistance: 4,
    onBegin: remember,
    onUpdate: (e) => {
      "worklet";
      const s0 = start.get();
      const { x, y } = clamp(
        scale.get(),
        s0.tx + e.translationX,
        s0.ty + e.translationY,
      );
      tx.set(x);
      ty.set(y);
    },
  });
  const tap = useTapGesture({
    maxDistance: 8,
    onActivate: (e) => {
      "worklet";
      if (!onTapTile || tile === 0) return;
      const col = Math.floor((e.x - tx.get()) / scale.get() / tile);
      const row = Math.floor((e.y - ty.get()) / scale.get() / tile);
      scheduleOnRN(onTapTile, col, row);
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      "worklet";
      zoomAround(scale.get() < 2 ? 2.5 : 1, e.x, e.y, true);
    },
  });
  const gestures = useSimultaneousGestures(pinch, pan, doubleTap, tap);

  const picture = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: scale.get() },
    ],
  }));

  const rect = (r: MapRect) => ({
    position: "absolute" as const,
    left: r.x * tile,
    top: r.y * tile,
    width: r.width * tile,
    height: r.height * tile,
  });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="overflow-hidden rounded-card bg-sunken"
      style={{ height: height || undefined, aspectRatio: cols / rows }}
    >
      {width > 0 && (
        <GestureDetector gesture={gestures}>
          <View style={{ width, height }}>
            <Animated.View
              style={[{ width, height, transformOrigin: "0 0" }, picture]}
            >
              <Image
                source={TOWN_MAP_IMAGES[map]}
                style={[{ width, height }, PIXELATED]}
                accessibilityIgnoresInvertColors
              />
              {marked.map((r, i) => (
                <View
                  key={`m${i}`}
                  pointerEvents="none"
                  style={[
                    rect(r),
                    {
                      // The accent can be close to the map's own colours
                      // (Emerald's green on grass), so a light ring and a
                      // dark edge keep it visible.
                      backgroundColor: colors.accent,
                      opacity: 0.85,
                      borderWidth: 1.5,
                      borderColor: "#fff",
                      borderRadius: Math.min(4, tile / 3),
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.55)",
                    },
                  ]}
                />
              ))}
              {selected.map((r, i) => (
                <View
                  key={`s${i}`}
                  pointerEvents="none"
                  style={[
                    rect(r),
                    {
                      borderWidth: 2,
                      borderColor: "#fff",
                      borderRadius: Math.min(4, tile / 3),
                      // Readable on light and dark map colours alike.
                      boxShadow: "0 0 0 1.5px rgba(0,0,0,0.6)",
                    },
                  ]}
                />
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
      )}
      {/* Zoom buttons, for a mouse (web) and for anyone who can't pinch. */}
      <View className="absolute bottom-2 right-2 flex-row gap-1.5">
        {(
          [
            ["minus", "remove", 1 / 1.6, "Zoom out"],
            ["plus", "add", 1.6, "Zoom in"],
          ] as const
        ).map(([ios, android, factor, label]) => (
          <Pressable
            key={label}
            onPress={() =>
              zoomAround(scale.get() * factor, width / 2, height / 2, true)
            }
            accessibilityLabel={label}
            role="button"
            className="h-9 w-9 items-center justify-center rounded-full bg-surface/90 active:opacity-60"
          >
            <SymbolView
              name={{ ios, android, web: android }}
              tintColor={colors.ink}
              size={20}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
