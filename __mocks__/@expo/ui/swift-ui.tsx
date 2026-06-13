/**
 * Jest mock for `@expo/ui/swift-ui` (wired via jest.config.js moduleNameMapper).
 *
 * The real entry calls `requireNativeView("ExpoUI", ...)` at import time,
 * which throws under jest (the `expo` mock in jest.setup.ts has no
 * requireNativeView). BalanceSection additionally gates the SwiftUI path on
 * iOS 26+, so suites exercise the RN fallback pill — this mock only has to
 * keep a lazy `require()` of the module from crashing, while rendering
 * something queryable (testID `expo-ui-host`) if the glass branch is forced.
 */
import * as React from "react";
import {
  Text as RNText,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface MockHostProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  matchContents?: boolean | { vertical?: boolean; horizontal?: boolean };
}

export function Host({ children, style }: MockHostProps) {
  return (
    <View style={style} testID="expo-ui-host">
      {children}
    </View>
  );
}

interface MockStackProps {
  children?: React.ReactNode;
  onPress?: () => void;
  modifiers?: unknown[];
  spacing?: number;
  alignment?: string;
}

export function HStack({ children, onPress }: MockStackProps) {
  return (
    <View
      accessibilityRole="button"
      onTouchEnd={onPress}
      testID="expo-ui-hstack"
    >
      {children}
    </View>
  );
}

export function VStack({ children, onPress }: MockStackProps) {
  return (
    <View onTouchEnd={onPress} testID="expo-ui-vstack">
      {children}
    </View>
  );
}

interface MockTextProps {
  children?: React.ReactNode;
  color?: string;
  modifiers?: unknown[];
}

export function Text({ children }: MockTextProps) {
  return <RNText>{children}</RNText>;
}
