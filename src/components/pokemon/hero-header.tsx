import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { PagerHeaderProps } from "@/components/collapsible-pager";
import { GamePicker } from "@/components/game-picker";
import { PokeballMark } from "@/components/pokeball-mark";
import { dexNumber } from "@/components/pokemon-row";
import { Sprite } from "@/components/sprite";
import { TypeBadge } from "@/components/type-badge";
import { IconButton, Label, TABULAR } from "@/components/ui";
import type { PokemonDetail } from "@/db/queries";
import { captureChance } from "@/lib/catch-rate";
import { formatHeight, formatWeight } from "@/lib/pokemon-format";
import { hexToRgb, mix, typeColor } from "@/theme/colors";
import { useColors, usePalette } from "@/theme/theme";

// NativeWind classes don't reach Reanimated's Animated.View, so animated views
// use plain style objects.

// Layout of the expanded header, in dp below the status bar.
const BAR = 56; // the collapsed bar
const SPRITE = 192;
const SPRITE_TOP = 36;
const NAME_TOP = 232;
const NAME_HEIGHT = 40;
const DETAILS_TOP = 278;
const HERO = 470; // expanded height, without the tabs
const TABS = 44;

/** Header sizes for a status bar of `top` dp. */
export function heroMetrics(top: number) {
  return { height: top + HERO + TABS, collapse: HERO - BAR };
}

/** 0 → 1 over [from, to], clamped (inside worklets). */
function progress(value: number, from: number, to: number) {
  "worklet";
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/**
 * The Pokémon page's header. Expanded: big sprite, name, types, facts, game
 * picker. As the page scrolls it collapses into a bar: the sprite is
 * cropped by the shrinking header and fades, the name slides up into a
 * centred title, the details fade, and a thumbnail appears. The tabs ride
 * along at its bottom edge.
 */
export function HeroHeader({
  pokemon,
  tabs,
  top,
  scrollY,
  pagerX,
  index,
  goTo,
  width,
}: PagerHeaderProps & {
  pokemon: PokemonDetail;
  tabs: string[];
  /** Status bar height. */
  top: number;
  width: number;
}) {
  const { canvas } = usePalette();
  const [shiny, setShiny] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { collapse } = heroMetrics(top);
  const toggleShiny = () => setShiny((s) => !s);

  // Only the visible controls take touches (state, so React re-renders).
  useAnimatedReaction(
    () => scrollY.get() > collapse / 2,
    (now, before) => {
      if (now !== before) scheduleOnRN(setCollapsed, now);
    },
  );

  const shift = (y: number) => {
    "worklet";
    return Math.min(Math.max(y, 0), collapse);
  };
  const container = useAnimatedStyle(() => ({
    transform: [{ translateY: -shift(scrollY.get()) }],
  }));
  // Things that stay put on screen while the header slides up.
  const pinned = useAnimatedStyle(() => ({
    transform: [{ translateY: shift(scrollY.get()) }],
  }));
  const sprite = useAnimatedStyle(() => {
    const c = shift(scrollY.get());
    return {
      opacity: 1 - progress(c / collapse, 0.3, 0.85),
      transform: [{ translateY: c * 0.5 }],
    };
  });
  const name = useAnimatedStyle(() => {
    const c = shift(scrollY.get());
    const p = c / collapse;
    const from = top + NAME_TOP + NAME_HEIGHT / 2;
    const to = top + BAR / 2;
    return {
      transform: [
        { translateY: interpolate(p, [0, 1], [from, to]) - from + c },
        { scale: interpolate(p, [0, 1], [1, 0.6]) },
      ],
    };
  });
  const details = useAnimatedStyle(() => ({
    opacity: 1 - progress(shift(scrollY.get()) / collapse, 0, 0.22),
  }));
  const fadeOut = useAnimatedStyle(() => ({
    opacity: 1 - progress(shift(scrollY.get()) / collapse, 0, 0.4),
  }));
  const fadeIn = useAnimatedStyle(() => ({
    opacity: progress(shift(scrollY.get()) / collapse, 0.7, 1),
  }));

  const gradient = [
    mix(hexToRgb(typeColor(pokemon.type1)), canvas, 0.38),
    mix(hexToRgb(typeColor(pokemon.type2 ?? pokemon.type1)), canvas, 0.16),
  ] as const;
  const catchPct = (captureChance(pokemon.catchRate) * 100).toFixed(1);

  return (
    <Animated.View
      // Touches outside the controls fall through to the page below, so
      // dragging anywhere on the header scrolls.
      pointerEvents="box-none"
      style={[
        { position: "absolute", left: 0, overflow: "hidden" },
        { top: 0, width, height: top + HERO + TABS },
        container,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: top + HERO,
        }}
        pointerEvents="none"
      />

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
          },
          {
            top: top + SPRITE_TOP,
            left: (width - SPRITE) / 2,
            width: SPRITE,
            height: SPRITE,
          },
          sprite,
        ]}
      >
        <PokeballMark
          size={220}
          opacity={0.045}
          style={{ position: "absolute" }}
        />
        <Sprite id={pokemon.id} size={SPRITE} shiny={shiny} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 10,
          },
          { top: top + NAME_TOP, height: NAME_HEIGHT },
          name,
        ]}
      >
        <Text className="text-xl font-semibold text-ink-subtle" style={TABULAR}>
          {dexNumber(pokemon.id)}
        </Text>
        <Text
          className="text-[32px] font-bold tracking-tight text-ink"
          numberOfLines={1}
        >
          {pokemon.name}
        </Text>
      </Animated.View>

      <Animated.View
        pointerEvents={collapsed ? "none" : "box-none"}
        style={[
          {
            position: "absolute",
            left: 16,
            right: 16,
            alignItems: "center",
            gap: 12,
          },
          { top: top + DETAILS_TOP },
          details,
        ]}
      >
        <Text className="text-callout text-ink-muted">
          {pokemon.category} Pokémon
          {pokemon.formName ? ` · ${pokemon.formName}` : ""}
        </Text>
        <View className="flex-row gap-2">
          <TypeBadge type={pokemon.type1} />
          {pokemon.type2 && <TypeBadge type={pokemon.type2} />}
        </View>
        <View className="w-full flex-row gap-2">
          <Fact label="Height" value={formatHeight(pokemon.heightDm)} />
          <Fact label="Weight" value={formatWeight(pokemon.weightHg)} />
          <Fact label="Catch" value={`${catchPct}%`} />
        </View>
        <View className="w-full">
          <GamePicker />
        </View>
      </Animated.View>

      {/* The bar: back button, shiny switch, thumbnail. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
          },
          { top, height: BAR },
          pinned,
        ]}
      >
        <BackButton />
        <Animated.View
          style={fadeOut}
          pointerEvents={collapsed ? "none" : "auto"}
        >
          <ShinyToggle shiny={shiny} onPress={toggleShiny} />
        </Animated.View>
        <Animated.View
          style={[{ position: "absolute", right: 12 }, fadeIn]}
          pointerEvents={collapsed ? "auto" : "none"}
        >
          <Pressable
            onPress={toggleShiny}
            aria-label="Shiny"
            role="switch"
            aria-checked={shiny}
          >
            <Sprite id={pokemon.id} size={48} shiny={shiny} />
          </Pressable>
        </Animated.View>
      </Animated.View>

      <TabBar
        tabs={tabs}
        index={index}
        goTo={goTo}
        pagerX={pagerX}
        width={width}
        top={top + HERO}
      />
    </Animated.View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center rounded-tile bg-surface/70 py-2">
      <Text className="text-headline font-bold text-ink" style={TABULAR}>
        {value}
      </Text>
      <Label>{label}</Label>
    </View>
  );
}

function BackButton() {
  return (
    <IconButton
      name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
      label="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      translucent
    />
  );
}

function ShinyToggle({
  shiny,
  onPress,
}: {
  shiny: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      // aria-* props work on native and, unlike accessibilityState, reach
      // the HTML on web.
      role="switch"
      aria-checked={shiny}
      aria-label="Shiny"
      hitSlop={8}
      className={`h-10 flex-row items-center gap-1.5 rounded-full pl-3 pr-3.5 active:opacity-60 ${shiny ? "bg-accent" : "bg-surface/70"}`}
    >
      <SymbolView
        name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
        tintColor={shiny ? colors["on-accent"] : colors.ink}
        size={16}
      />
      <Text
        className={`text-callout font-semibold ${shiny ? "text-on-accent" : "text-ink"}`}
      >
        Shiny
      </Text>
    </Pressable>
  );
}

/** Section tabs; the underline follows the pager as you swipe. */
function TabBar({
  tabs,
  index,
  goTo,
  pagerX,
  width,
  top,
}: {
  tabs: string[];
  index: number;
  goTo: (index: number) => void;
  pagerX: SharedValue<number>;
  width: number;
  top: number;
}) {
  const colors = useColors();
  const tabWidth = (width - 16) / tabs.length;
  const underline = useAnimatedStyle(() => ({
    transform: [{ translateX: (pagerX.get() / width) * tabWidth }],
  }));
  return (
    <View
      className="absolute left-0 right-0 flex-row border-b border-line bg-canvas px-2"
      style={{ top, height: TABS }}
    >
      {tabs.map((title, i) => (
        <Pressable
          key={title}
          onPress={() => goTo(i)}
          role="tab"
          aria-selected={i === index}
          className="flex-1 items-center justify-center"
        >
          <Text
            numberOfLines={1}
            className={`text-callout font-semibold ${i === index ? "text-ink" : "text-ink-subtle"}`}
          >
            {title}
          </Text>
        </Pressable>
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            bottom: 0,
            height: 2,
            borderRadius: 2,
            backgroundColor: colors.accent,
          },
          { left: 8 + tabWidth * 0.25, width: tabWidth * 0.5 },
          underline,
        ]}
      />
    </View>
  );
}
