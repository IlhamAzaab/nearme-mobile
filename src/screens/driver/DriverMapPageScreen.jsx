import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DriverScreenSection from "../../components/driver/DriverScreenSection";
import { DriverMapSheetLoadingSkeleton } from "../../components/driver/DriverAppLoadingSkeletons";

/**
 * DriverMapPageScreen - Full map view for driver navigation
 */
const DriverMapPageScreen = ({ navigation, route }) => {
  useEffect(() => {
    const params = route?.params || {};
    const timer = setTimeout(() => {
      navigation.replace("DriverMap", params);
    }, 80);

    return () => clearTimeout(timer);
  }, [navigation, route?.params]);

  return (
    <SafeAreaView style={styles.container}>
      <DriverScreenSection
        screenKey="DriverMapPage"
        sectionIndex={0}
        style={styles.content}
      >
        <DriverMapSheetLoadingSkeleton />
      </DriverScreenSection>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flex: 1 },
});

export default DriverMapPageScreen;
