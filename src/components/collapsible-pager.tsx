import { useCallback, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Swipeable pages under a header that collapses as you scroll (the Pokémon
 * page). Each page scrolls on its own, but they share one scroll position,
 * `scrollY`, which the header animates from on the UI thread.
 *
 * Every page starts with `headerHeight` of empty space, so its content
 * begins below the expanded header; scrolling the first `collapse` pixels
 * collapses the header. (No snapping: snapping to collapsed after a small
 * drag felt abrupt; the header follows the finger exactly.)
 *
 * Switching pages keeps the header still: if it's partly open, the new page
 * is scrolled to the same offset; if it's collapsed, the new page keeps its
 * own position (but at least `collapse`). The pager publishes those target
 * offsets in a shared value and each page scrolls itself on the UI thread.
 */
export type PagerHeaderProps = {
  /** The active page's vertical scroll offset. */
  scrollY: SharedValue<number>;
  /** The pager's horizontal offset, for an animated tab indicator. */
  pagerX: SharedValue<number>;
  index: number;
  goTo: (index: number) => void;
};

export function CollapsiblePager({
  pages,
  width,
  headerHeight,
  collapse,
  renderHeader,
}: {
  pages: { key: string; content: ReactNode }[];
  width: number;
  /** Height of the expanded header, tab bar included. */
  headerHeight: number;
  /** How far the header shrinks. */
  collapse: number;
  renderHeader: (props: PagerHeaderProps) => ReactNode;
}) {
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollY = useSharedValue(0);
  const pagerX = useSharedValue(0);
  const active = useSharedValue(0);
  const offsets = useSharedValue(pages.map(() => 0));
  // Where each page should be scrolled to; pages watch this (see Page).
  const targets = useSharedValue<number[]>([]);
  const pager = useAnimatedRef<Animated.ScrollView>();

  /** Lines the other pages up with the header; returns each page's offset. */
  const alignPages = useCallback(() => {
    const header = Math.min(Math.max(scrollY.get(), 0), collapse);
    const next = offsets.get().map((offset, page) => {
      if (page === active.get()) return offset;
      return header < collapse ? header : Math.max(offset, collapse);
    });
    targets.set(next);
    return next;
  }, [active, collapse, offsets, scrollY, targets]);

  const activate = useCallback(
    (page: number, targets: number[]) => {
      setIndex(page);
      active.set(page);
      scrollY.set(targets[page] ?? 0);
    },
    [active, scrollY],
  );

  // Tab presses set the page to show; this scrolls the pager there.
  const pageTarget = useSharedValue(0);
  useAnimatedReaction(
    () => pageTarget.get(),
    (page, before) => {
      if (before !== null && page !== before)
        scrollTo(pager, page * width, 0, true);
    },
  );

  const goTo = useCallback(
    (page: number) => {
      activate(page, alignPages());
      pageTarget.set(page);
    },
    [activate, alignPages, pageTarget],
  );

  const onPagerScroll = useAnimatedScrollHandler((e) => {
    pagerX.set(e.contentOffset.x);
  });

  // Page changes come from the pager's position, not from swipe events
  // (those don't fire for every kind of scroll, e.g. on web): line the
  // pages up as soon as it leaves a page, switch when it settles on one.
  const swiped = useCallback(
    (page: number) => {
      activate(page, offsets.get());
      pageTarget.set(page);
    },
    [activate, offsets, pageTarget],
  );
  const moving = useSharedValue(false);
  useAnimatedReaction(
    () => pagerX.get(),
    (x, before) => {
      // Only real movement: the reaction also runs when it's re-created on
      // a re-render, and that must not undo a tab press.
      if (before === null || x === before) return;
      const page = Math.round(x / width);
      const settled = Math.abs(x - page * width) < 1;
      if (!settled && !moving.get()) {
        moving.set(true);
        scheduleOnRN(alignPages);
      } else if (settled) {
        moving.set(false);
        if (page !== active.get()) scheduleOnRN(swiped, page);
      }
    },
  );

  return (
    <View
      className="flex-1"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onPagerScroll}
      >
        {height > 0 &&
          pages.map((page, i) => (
            <Page
              key={page.key}
              index={i}
              width={width}
              height={height}
              headerHeight={headerHeight}
              collapse={collapse}
              active={active}
              scrollY={scrollY}
              offsets={offsets}
              targets={targets}
            >
              {page.content}
            </Page>
          ))}
      </Animated.ScrollView>
      {renderHeader({ scrollY, pagerX, index, goTo })}
    </View>
  );
}

function Page({
  index,
  width,
  height,
  headerHeight,
  collapse,
  active,
  scrollY,
  offsets,
  targets,
  children,
}: {
  index: number;
  width: number;
  height: number;
  headerHeight: number;
  collapse: number;
  active: SharedValue<number>;
  scrollY: SharedValue<number>;
  offsets: SharedValue<number[]>;
  targets: SharedValue<number[]>;
  children: ReactNode;
}) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  // Scroll to the pager's target for this page when it changes.
  useAnimatedReaction(
    () => targets.get()[index],
    (target) => {
      if (target !== undefined && target !== offsets.get()[index])
        scrollTo(ref, 0, target, false);
    },
  );
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    offsets.modify((all) => {
      "worklet";
      all[index] = y;
      return all;
    });
    if (active.get() === index) scrollY.set(y);
  });
  return (
    <Animated.ScrollView
      ref={ref}
      style={{ width, height }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: headerHeight,
        // Short pages can still collapse the header all the way.
        minHeight: height + collapse,
      }}
    >
      {children}
    </Animated.ScrollView>
  );
}
