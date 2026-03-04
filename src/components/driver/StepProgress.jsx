import { StyleSheet, Text, View } from "react-native";

export default function StepProgress({ currentStep, totalSteps = 5 }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        return (
          <View key={stepNum} style={styles.stepWrapper}>
            <View style={[
              styles.stepCircle,
              isCompleted && styles.stepCompleted,
              isActive && styles.stepActive,
            ]}>
              <Text style={[
                styles.stepText,
                (isCompleted || isActive) && styles.stepTextActive,
              ]}>
                {isCompleted ? "" : stepNum}
              </Text>
            </View>
            {stepNum < totalSteps && (
              <View style={[styles.stepLine, isCompleted && styles.stepLineActive]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  stepWrapper: { flexDirection: "row", alignItems: "center" },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  stepCompleted: { backgroundColor: "#fff" },
  stepActive: { backgroundColor: "#fff", shadowColor: "#fff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  stepText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.6)" },
  stepTextActive: { color: "#1db95b" },
  stepLine: { width: 28, height: 2, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 4 },
  stepLineActive: { backgroundColor: "#fff" },
});
