/**
 * Jest mock for `@expo/ui/swift-ui/modifiers` (wired via moduleNameMapper).
 * Real modifiers are inert config objects consumed by the native host, so
 * the mock just returns tagged plain objects.
 */
type ModifierConfig = Record<string, unknown>;

export const accessibilityLabel = (label: string): ModifierConfig => ({
  $type: "accessibilityLabel",
  label,
});

export const font = (params: Record<string, unknown>): ModifierConfig => ({
  $type: "font",
  ...params,
});

export const frame = (params: Record<string, unknown>): ModifierConfig => ({
  $type: "frame",
  ...params,
});

export const glassEffect = (
  params?: Record<string, unknown>,
): ModifierConfig => ({
  $type: "glassEffect",
  ...params,
});
