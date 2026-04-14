import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, TextInput, View } from "react-native";

export default function FloatingLabelInput({
  label,
  value,
  onChangeText,
  inactivePlaceholder,
  activePlaceholder,
  leftIcon,
  rightAccessory,
  containerStyle,
  inputStyle,
  labelLeft,
  onFocus,
  onBlur,
  ...inputProps
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = Boolean(String(value ?? "").length);
  const isActive = isFocused || hasValue;

  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isActive ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, isActive]);

  const resolvedPlaceholder = hasValue
    ? ""
    : isFocused
      ? activePlaceholder || inactivePlaceholder || label
      : inactivePlaceholder || label;

  const labelOffset =
    typeof labelLeft === "number" ? labelLeft : leftIcon ? 50 : 16;

  return (
    <View style={[styles.inputGroup, containerStyle]}>
      <View
        style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}
      >
        {leftIcon ? <View style={styles.leftIconWrap}>{leftIcon}</View> : null}

        <Animated.Text
          pointerEvents="none"
          style={[
            styles.inputLabel,
            {
              left: labelOffset,
              top: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 7],
              }),
              fontSize: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 12],
              }),
              color: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["#9ca3af", "#374151"],
              }),
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          {label}
        </Animated.Text>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={resolvedPlaceholder}
          placeholderTextColor="#9ca3af"
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightAccessory && styles.inputWithRightAccessory,
            isActive && styles.inputActive,
            inputStyle,
          ]}
          {...inputProps}
        />

        {rightAccessory ? (
          <View style={styles.rightAccessoryWrap}>{rightAccessory}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 14,
  },
  inputWrapper: {
    borderWidth: 2,
    borderColor: "#f1f1f1",
    borderRadius: 12,
    backgroundColor: "#f3f3f3",
    minHeight: 58,
    justifyContent: "center",
    overflow: "hidden",
  },
  inputWrapperFocused: {
    borderColor: "#06C168",
  },
  inputLabel: {
    position: "absolute",
    fontWeight: "500",
    zIndex: 2,
  },
  leftIconWrap: {
    position: "absolute",
    left: 14,
    zIndex: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  rightAccessoryWrap: {
    position: "absolute",
    right: 14,
    zIndex: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
  },
  inputWithLeftIcon: {
    paddingLeft: 50,
  },
  inputWithRightAccessory: {
    paddingRight: 52,
  },
  inputActive: {
    paddingTop: 23,
    paddingBottom: 9,
  },
});
