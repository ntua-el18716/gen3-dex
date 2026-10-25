import { useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from "react-native";

export type SwipeTab = { title: string; content: ReactNode };

/**
 * Pages side by side in a horizontal, paging ScrollView, with a tab bar on
 * top. Swiping changes the tab; tapping a tab scrolls to its page.
 */
export function SwipeTabs({ tabs }: { tabs: SwipeTab[] }) {
  // Each page gets the exact size of the area below the tab bar. The width
  // matters on big screens (narrower than the window); the height on web,
  // where a page's own vertical ScrollView otherwise grows to fit its
  // content and never scrolls. Start with the window size until measured.
  const window = useWindowDimensions();
  const [size, setSize] = useState({
    width: window.width,
    height: window.height,
  });
  // ScrollView is a function component since RN 0.88: refs get the instance type.
  const pager = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    setIndex(i);
    pager.current?.scrollTo({ x: i * size.width, animated: true });
  };

  return (
    <View className="flex-1">
      <View className="flex-row border-b border-line px-2">
        {tabs.map((tab, i) => (
          <Pressable
            key={tab.title}
            onPress={() => goTo(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === index }}
            className={`flex-1 items-center border-b-2 py-3 ${
              i === index ? "border-accent" : "border-transparent"
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-sm font-bold ${
                i === index ? "text-ink" : "text-ink-subtle"
              }`}
            >
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        className="flex-1"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ width, height });
        }}
      >
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / size.width))
          }
        >
          {tabs.map((tab) => (
            <View key={tab.title} style={size}>
              {tab.content}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
