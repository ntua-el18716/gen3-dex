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
  const { width } = useWindowDimensions();
  // ScrollView is a function component since RN 0.88: refs get the instance type.
  const pager = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    setIndex(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <View className="flex-1">
      <View className="flex-row border-b border-neutral-200">
        {tabs.map((tab, i) => (
          <Pressable
            key={tab.title}
            onPress={() => goTo(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === index }}
            className={`flex-1 items-center border-b-2 py-3 ${
              i === index ? "border-neutral-900" : "border-transparent"
            }`}
          >
            <Text
              className={`font-semibold ${
                i === index ? "text-neutral-900" : "text-neutral-500"
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
