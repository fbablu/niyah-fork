import React, { useEffect, useRef } from "react";
import { Animated, type TextStyle, type StyleProp } from "react-native";

interface AnimatedNoteProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

/**
 * A one-line text note that fades + slides in when it mounts — used for
 * validation hints (e.g. "deposit up to $500") so they appear with a little
 * polish instead of popping in. Mount it conditionally; the entrance plays each
 * time it appears. Native-driven (opacity + translateY only).
 */
export const AnimatedNote: React.FC<AnimatedNoteProps> = ({
  children,
  style,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [anim]);

  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.Text>
  );
};
