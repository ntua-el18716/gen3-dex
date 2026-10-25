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
  // Pages are as wide as this component, which is narrower than the window
  // on big screens; start with the window width until it's measured.
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  // ScrollView is a function component since RN 0.88: refs get the instance type.
  const pager = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    setIndex(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <View
      className="flex-1"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View className="flex-row border-b border-line px-4">
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
              className={`font-bold ${
                i === index ? "text-ink" : "text-ink-subtle"
              }`}
            >
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {tabs.map((tab) => (
          <View key={tab.title} style={{ width }}>
            {tab.content}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
