import Svg, { Circle, Path } from "react-native-svg";

import type { DamageClass } from "@/lib/damage-class";

/** Physical (burst), special (rings) or status (half circle), like the mockup. */
export function CategoryIcon({
  cls,
  size = 18,
}: {
  cls: DamageClass;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-label={cls}>
      {cls === "physical" ? (
        <Path
          fill="#E8553E"
          d="M12 1l2.6 6.2L21 5l-2.2 6.4L23 14l-6.4.9L17 22l-5-4.3L7 22l.4-7.1L1 14l4.2-2.6L3 5l6.4 2.2z"
        />
      ) : cls === "special" ? (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9.5}
            fill="none"
            stroke="#4F7CF0"
            strokeWidth={2.6}
          />
          <Circle
            cx={12}
            cy={12}
            r={4.5}
            fill="none"
            stroke="#4F7CF0"
            strokeWidth={2.6}
          />
        </>
      ) : (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9.5}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth={2.6}
          />
          <Path d="M12 2.5a9.5 9.5 0 0 1 0 19z" fill="#9CA3AF" />
        </>
      )}
    </Svg>
  );
}
