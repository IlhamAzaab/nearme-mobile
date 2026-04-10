import { StyleSheet, Text, View } from "react-native";

const DEFAULT_LABELS = ["Personal", "Vehicle", "Documents", "Bank", "Contract"];

export default function StepProgress({
  currentStep,
  totalSteps = 5,
  labels = DEFAULT_LABELS,
}) {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepInfoText}>
          Step {currentStep} of {totalSteps}
        </Text>
        <Text style={styles.percentText}>{percentage}% Complete</Text>
      </View>

      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${percentage}%` }]} />
      </View>

      <View style={styles.stepsRow}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <View key={stepNum} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCompleted,
                  isActive && styles.stepActive,
                  stepNum > currentStep && styles.stepPending,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text
                    style={[styles.stepText, isActive && styles.stepTextActive]}
                  >
                    {stepNum}
                  </Text>
                )}
              </View>
              <Text style={styles.stepLabel}>
                {labels[i] || `Step ${stepNum}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepInfoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  percentText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#06C168",
  },
  barContainer: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#06C168",
    borderRadius: 5,
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCompleted: {
    backgroundColor: "#06C168",
  },
  stepActive: {
    backgroundColor: "#06C168",
    borderWidth: 4,
    borderColor: "#9EEBBE",
  },
  stepPending: {
    backgroundColor: "#d1d5db",
  },
  checkmark: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  stepText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  stepTextActive: {
    color: "#ffffff",
  },
  stepLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
});
