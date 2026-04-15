import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import SkeletonBlock from "../common/SkeletonBlock";
import DriverScreenSection from "./DriverScreenSection";
import DriverScreenHeader from "./DriverScreenHeader";

export function DriverHistoryFullScreenSkeleton() {
  return (
    <SafeAreaView style={[styles.container, { flex: 1 }]}>
      <View style={{ flex: 1 }}>
        <DriverScreenSection screenKey="DeliveryHistory" sectionIndex={0}>
          <DriverScreenHeader title="Delivery History" />
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DeliveryHistory"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <View style={styles.listWrap}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={`history-skeleton-${i}`} style={styles.simpleListCard}>
                <View style={styles.listRow}>
                  <SkeletonBlock width={40} height={40} borderRadius={20} />
                  <View style={styles.flex1}>
                    <SkeletonBlock width={140} height={14} borderRadius={6} />
                    <SkeletonBlock
                      width="100%"
                      height={12}
                      borderRadius={6}
                      style={styles.mt6}
                    />
                    <SkeletonBlock
                      width="70%"
                      height={12}
                      borderRadius={6}
                      style={styles.mt6}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </DriverScreenSection>
      </View>
    </SafeAreaView>
  );
}

export function DriverNotificationsFullScreenSkeleton() {
  return (
    <SafeAreaView style={[styles.container, { flex: 1 }]}>
      <View style={{ flex: 1 }}>
        <DriverScreenSection screenKey="DriverNotifications" sectionIndex={0}>
          <DriverScreenHeader title="Notifications" />
        </DriverScreenSection>

        <DriverScreenSection
          screenKey="DriverNotifications"
          sectionIndex={1}
          style={{ flex: 1 }}
        >
          <View style={styles.listWrap}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={`notif-skeleton-${i}`} style={styles.simpleListCard}>
                <View style={styles.listRow}>
                  <SkeletonBlock width={40} height={40} borderRadius={20} />
                  <View style={styles.flex1}>
                    <SkeletonBlock width={140} height={14} borderRadius={6} />
                    <SkeletonBlock
                      width="100%"
                      height={12}
                      borderRadius={6}
                      style={styles.mt6}
                    />
                    <SkeletonBlock
                      width="70%"
                      height={12}
                      borderRadius={6}
                      style={styles.mt6}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </DriverScreenSection>
      </View>
    </SafeAreaView>
  );
}

export function DriverDashboardLoadingSkeleton() {
  return (
    <View style={styles.dashboardWrap}>
      <View style={styles.headerRow}>
        <SkeletonBlock width={40} height={40} borderRadius={20} />
        <SkeletonBlock width={120} height={22} borderRadius={8} />
        <SkeletonBlock width={40} height={40} borderRadius={20} />
      </View>

      <View style={styles.card}>
        <SkeletonBlock width={140} height={16} borderRadius={8} />
        <SkeletonBlock
          width={180}
          height={28}
          borderRadius={10}
          style={styles.mt8}
        />
        <SkeletonBlock
          width="100%"
          height={54}
          borderRadius={12}
          style={styles.mt12}
        />
      </View>

      <View style={styles.row2}>
        <View style={styles.smallCard}>
          <SkeletonBlock width={80} height={12} borderRadius={6} />
          <SkeletonBlock
            width={96}
            height={20}
            borderRadius={8}
            style={styles.mt8}
          />
        </View>
        <View style={styles.smallCard}>
          <SkeletonBlock width={80} height={12} borderRadius={6} />
          <SkeletonBlock
            width={96}
            height={20}
            borderRadius={8}
            style={styles.mt8}
          />
        </View>
      </View>

      <SkeletonBlock
        width={150}
        height={20}
        borderRadius={8}
        style={styles.mt4}
      />

      {[0, 1, 2, 3].map((i) => (
        <View key={`dash-skeleton-${i}`} style={styles.listCard}>
          <View style={styles.listRow}>
            <SkeletonBlock width={42} height={42} borderRadius={21} />
            <View style={styles.flex1}>
              <SkeletonBlock width={120} height={14} borderRadius={6} />
              <SkeletonBlock
                width={90}
                height={12}
                borderRadius={6}
                style={styles.mt6}
              />
              <SkeletonBlock
                width={160}
                height={12}
                borderRadius={6}
                style={styles.mt6}
              />
            </View>
            <View>
              <SkeletonBlock width={56} height={14} borderRadius={6} />
              <SkeletonBlock
                width={44}
                height={12}
                borderRadius={6}
                style={styles.mt6}
              />
            </View>
          </View>
          <View style={styles.listActionsRow}>
            <SkeletonBlock width={58} height={44} borderRadius={10} />
            <SkeletonBlock
              width="100%"
              height={44}
              borderRadius={10}
              style={styles.flex1}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DriverMapSheetLoadingSkeleton() {
  return (
    <View style={styles.mapWrap}>
      <SkeletonBlock
        width="100%"
        height="100%"
        borderRadius={0}
        style={styles.mapBackdrop}
      />
      <View style={styles.mapTopRow}>
        <SkeletonBlock width={40} height={40} borderRadius={20} />
        <SkeletonBlock width={84} height={34} borderRadius={18} />
      </View>

      <View style={styles.sheetWrap}>
        <SkeletonBlock
          width={56}
          height={6}
          borderRadius={4}
          style={styles.selfCenter}
        />
        <SkeletonBlock
          width={120}
          height={20}
          borderRadius={8}
          style={styles.mt12}
        />
        <SkeletonBlock
          width={170}
          height={14}
          borderRadius={7}
          style={styles.mt8}
        />
        <SkeletonBlock
          width="100%"
          height={72}
          borderRadius={14}
          style={styles.mt12}
        />
        <SkeletonBlock
          width="100%"
          height={52}
          borderRadius={26}
          style={styles.mt12}
        />
      </View>
    </View>
  );
}

export function DriverListLoadingSkeleton({ count = 5 }) {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={`list-skeleton-${i}`} style={styles.simpleListCard}>
          <View style={styles.listRow}>
            <SkeletonBlock width={40} height={40} borderRadius={20} />
            <View style={styles.flex1}>
              <SkeletonBlock width={140} height={14} borderRadius={6} />
              <SkeletonBlock
                width="100%"
                height={12}
                borderRadius={6}
                style={styles.mt6}
              />
              <SkeletonBlock
                width="70%"
                height={12}
                borderRadius={6}
                style={styles.mt6}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function DriverProfileLoadingSkeleton() {
  return (
    <View style={styles.profileWrap}>
      <View style={styles.headerRow}>
        <SkeletonBlock width={40} height={40} borderRadius={20} />
        <SkeletonBlock width={130} height={22} borderRadius={8} />
        <SkeletonBlock width={40} height={40} borderRadius={20} />
      </View>

      <View style={styles.profileHero}>
        <SkeletonBlock width={84} height={84} borderRadius={42} />
        <View style={styles.flex1}>
          <SkeletonBlock width={160} height={18} borderRadius={8} />
          <SkeletonBlock
            width={120}
            height={14}
            borderRadius={7}
            style={styles.mt8}
          />
        </View>
      </View>

      <View style={styles.card}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock
            key={`profile-row-${i}`}
            width="100%"
            height={48}
            borderRadius={12}
            style={i ? styles.mt10 : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
  },
  dashboardWrap: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 96,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
  },
  row2: {
    flexDirection: "row",
    gap: 10,
  },
  smallCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginTop: 2,
  },
  listRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  listActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  mapWrap: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  mapBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#D1D5DB",
  },
  mapTopRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  listWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
  },
  simpleListCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  profileWrap: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 12,
  },
  profileHero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex1: { flex: 1 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  selfCenter: { alignSelf: "center" },
});
