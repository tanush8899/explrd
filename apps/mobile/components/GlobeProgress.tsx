import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Rect,
} from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const VB = 100;
const CX = 50;
const CY = 50;
const R = 44;
const TOP = CY - R; // 6
const BOTTOM = CY + R; // 94
const SPAN = BOTTOM - TOP; // 88

type Props = {
  /** 0–100 — how much of the globe fills from the bottom up. */
  percent: number;
  size?: number;
  /** Waterline / fill color. */
  color?: string;
  /** Wireframe stroke color — brighten it to use the globe as a logo mark. */
  strokeColor?: string;
  strokeWidth?: number;
};

/** The explrd globe mark, filling like a liquid gauge with `percent`.
 *  The fill is clipped to the globe circle and sits behind the wireframe so the
 *  meridians/parallels read over the "water". */
export default function GlobeProgress({
  percent,
  size = 92,
  color = "#3b82f6",
  strokeColor = "rgba(255,255,255,0.24)",
  strokeWidth = 2,
}: Props) {
  const frac = Math.max(0, Math.min(percent / 100, 1));
  const fillH = SPAN * frac;

  // Animate the waterline rising from the bottom on mount / when frac changes.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = Animated.timing(anim, {
      toValue: fillH,
      duration: 800,
      delay: 120,
      useNativeDriver: false,
    });
    t.start();
    return () => t.stop();
  }, [fillH, anim]);

  const waterY = anim.interpolate({
    inputRange: [0, SPAN],
    outputRange: [BOTTOM, TOP],
  });

  // Straight latitude chords at ±22 from the equator.
  const half = Math.sqrt(Math.max(R * R - 22 * 22, 0));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Defs>
        <ClipPath id="globeClip">
          <Circle cx={CX} cy={CY} r={R} />
        </ClipPath>
      </Defs>

      {/* Water fill, clipped to the globe and sitting behind the wireframe. */}
      <G clipPath="url(#globeClip)">
        <AnimatedRect x={0} y={waterY} width={VB} height={SPAN} fill={color} opacity={0.9} />
      </G>

      {/* Wireframe globe — the explrd mark. */}
      <Circle cx={CX} cy={CY} r={R} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
      <Ellipse cx={CX} cy={CY} rx={22} ry={R} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
      <Line x1={CX} y1={TOP} x2={CX} y2={BOTTOM} stroke={strokeColor} strokeWidth={strokeWidth} />
      <Line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke={strokeColor} strokeWidth={strokeWidth} />
      <Line x1={CX - half} y1={CY - 22} x2={CX + half} y2={CY - 22} stroke={strokeColor} strokeWidth={strokeWidth} />
      <Line x1={CX - half} y1={CY + 22} x2={CX + half} y2={CY + 22} stroke={strokeColor} strokeWidth={strokeWidth} />
    </Svg>
  );
}
