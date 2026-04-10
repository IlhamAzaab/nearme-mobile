import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TextInput, View } from "react-native";

export default function FloatingInputField({
  label,
  value,
  onChangeText,
  placeholder,
  style,
  inputStyle,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const hasValue = !!String(value || "").trim();
  const active = focused || hasValue;

  useEffect(() => {
    const toValue = active ? 1 : 0;
    Animated.timing(anim, {
      toValue,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [active, anim]);

  const labelTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -3],
  });

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.Text
        style={[
          styles.label,
          {
            opacity: anim,
            transform: [{ translateY: labelTranslateY }],
          },
        ]}
      >
        {label}
      </Animated.Text>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        style={[
          styles.input,
          active ? styles.inputActive : styles.inputIdle,
          inputStyle,
        ]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  label: {
    position: "absolute",
    left: 14,
    top: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#06C168",
    zIndex: 2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#B8F0D0",
    borderRadius: 10,
    height: 54,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#EDFBF2",
    textAlignVertical: "center",
  },
  inputIdle: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  inputActive: {
    paddingTop: 18,
    paddingBottom: 8,
  },
});
