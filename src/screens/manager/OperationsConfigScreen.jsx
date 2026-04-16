import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_URL } from "../../config/env";

// Helper to format decimal hours to readable time
function formatTime(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

// Helper to parse time string like "5:00 AM" to decimal
function parseTimeToDecimal(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h + m / 60;
}

const OperationsConfigScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Section 1: Driver Earnings
  const [ratePerKm, setRatePerKm] = useState("40");
  const [rtcRateBelow5Km, setRtcRateBelow5Km] = useState("40");
  const [rtcRateAbove5Km, setRtcRateAbove5Km] = useState("40");
  const [maxDTRKm, setMaxDTRKm] = useState("1");
  const [maxDTRAmount, setMaxDTRAmount] = useState("30");
  const [maxRestProximity, setMaxRestProximity] = useState("1");
  const [secondBonus, setSecondBonus] = useState("20");
  const [additionalBonus, setAdditionalBonus] = useState("30");

  // Section 2: Delivery Availability
  const [maxExtraTime, setMaxExtraTime] = useState("10");
  const [maxExtraDistance, setMaxExtraDistance] = useState("3");
  const [maxActiveDeliveries, setMaxActiveDeliveries] = useState("5");

  // Section 3: Service Fee Tiers
  const [serviceFeeTiers, setServiceFeeTiers] = useState([
    { min: 0, max: 300, fee: 0 },
    { min: 300, max: 1000, fee: 31 },
    { min: 1000, max: 1500, fee: 42 },
    { min: 1500, max: 2500, fee: 56 },
    { min: 2500, max: "", fee: 62 },
  ]);

  // Section 4: Delivery Fee Tiers
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState([
    { max_km: 1, fee: 50 },
    { max_km: 2, fee: 80 },
    { max_km: 2.5, fee: 87 },
  ]);
  const [overflowTier, setOverflowTier] = useState({
    base_fee: 87,
    extra_per_100m: 2.3,
    base_km: 2.5,
  });

  // Section 5: Pending Alert
  const [pendingMinutes, setPendingMinutes] = useState("10");

  // Section 6: Working Hours
  const [dayStart, setDayStart] = useState("5:00 AM");
  const [dayEnd, setDayEnd] = useState("7:00 PM");
  const [nightStart, setNightStart] = useState("6:00 PM");
  const [nightEnd, setNightEnd] = useState("6:00 AM");

  // Section 7: Order Distance Constraints
  const [orderDistanceConstraints, setOrderDistanceConstraints] = useState([
    { min_km: 0, max_km: 5, min_subtotal: 300 },
    { min_km: 5, max_km: 10, min_subtotal: 1000 },
    { min_km: 10, max_km: 15, min_subtotal: 2000 },
    { min_km: 15, max_km: 25, min_subtotal: 3000 },
  ]);
  const [maxOrderDistanceKm, setMaxOrderDistanceKm] = useState("25");

  const fetchConfig = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/manager/system-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch config");
      const { config } = await res.json();

      setRatePerKm(String(config.rate_per_km));
      setRtcRateBelow5Km(
        String(config.rtc_rate_below_5km ?? config.rate_per_km),
      );
      setRtcRateAbove5Km(
        String(config.rtc_rate_above_5km ?? config.rate_per_km),
      );
      setMaxDTRKm(String(config.max_driver_to_restaurant_km));
      setMaxDTRAmount(String(config.max_driver_to_restaurant_amount));
      setMaxRestProximity(String(config.max_restaurant_proximity_km));
      setSecondBonus(String(config.second_delivery_bonus));
      setAdditionalBonus(String(config.additional_delivery_bonus));
      setMaxExtraTime(String(config.max_extra_time_minutes));
      setMaxExtraDistance(String(config.max_extra_distance_km));
      setMaxActiveDeliveries(String(config.max_active_deliveries));

      const sft =
        typeof config.service_fee_tiers === "string"
          ? JSON.parse(config.service_fee_tiers)
          : config.service_fee_tiers;
      setServiceFeeTiers(
        sft.map((t) => ({ ...t, max: t.max === null ? "" : t.max })),
      );

      const dft =
        typeof config.delivery_fee_tiers === "string"
          ? JSON.parse(config.delivery_fee_tiers)
          : config.delivery_fee_tiers;
      const fixed = dft.filter((t) => t.max_km !== null);
      const overflow = dft.find((t) => t.max_km === null);
      setDeliveryFeeTiers(fixed);
      if (overflow)
        setOverflowTier({
          base_fee: overflow.base_fee,
          extra_per_100m: overflow.extra_per_100m,
          base_km: overflow.base_km,
        });

      setPendingMinutes(String(config.pending_alert_minutes));
      setDayStart(formatTime(parseFloat(config.day_shift_start)));
      setDayEnd(formatTime(parseFloat(config.day_shift_end)));
      setNightStart(formatTime(parseFloat(config.night_shift_start)));
      setNightEnd(formatTime(parseFloat(config.night_shift_end)));

      if (config.order_distance_constraints) {
        const odc =
          typeof config.order_distance_constraints === "string"
            ? JSON.parse(config.order_distance_constraints)
            : config.order_distance_constraints;
        setOrderDistanceConstraints(odc);
      }
      if (config.max_order_distance_km !== undefined) {
        setMaxOrderDistanceKm(String(config.max_order_distance_km));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await AsyncStorage.getItem("token");
      const sftPayload = serviceFeeTiers.map((t) => ({
        min: parseFloat(t.min) || 0,
        max: t.max === "" || t.max === null ? null : parseFloat(t.max),
        fee: parseFloat(t.fee) || 0,
      }));
      const dftPayload = [
        ...deliveryFeeTiers.map((t) => ({
          max_km: parseFloat(t.max_km),
          fee: parseFloat(t.fee),
        })),
        {
          max_km: null,
          base_fee: parseFloat(overflowTier.base_fee),
          extra_per_100m: parseFloat(overflowTier.extra_per_100m),
          base_km: parseFloat(overflowTier.base_km),
        },
      ];
      const body = {
        rate_per_km: parseFloat(ratePerKm),
        rtc_rate_below_5km: parseFloat(rtcRateBelow5Km),
        rtc_rate_above_5km: parseFloat(rtcRateAbove5Km),
        max_driver_to_restaurant_km: parseFloat(maxDTRKm),
        max_driver_to_restaurant_amount: parseFloat(maxDTRAmount),
        max_restaurant_proximity_km: parseFloat(maxRestProximity),
        second_delivery_bonus: parseFloat(secondBonus),
        additional_delivery_bonus: parseFloat(additionalBonus),
        max_extra_time_minutes: parseInt(maxExtraTime),
        max_extra_distance_km: parseFloat(maxExtraDistance),
        max_active_deliveries: parseInt(maxActiveDeliveries),
        service_fee_tiers: sftPayload,
        delivery_fee_tiers: dftPayload,
        pending_alert_minutes: parseInt(pendingMinutes),
        day_shift_start: parseTimeToDecimal(dayStart),
        day_shift_end: parseTimeToDecimal(dayEnd),
        night_shift_start: parseTimeToDecimal(nightStart),
        night_shift_end: parseTimeToDecimal(nightEnd),
        order_distance_constraints: orderDistanceConstraints.map((c) => ({
          min_km: parseFloat(c.min_km) || 0,
          max_km: parseFloat(c.max_km) || 0,
          min_subtotal: parseFloat(c.min_subtotal) || 0,
        })),
        max_order_distance_km: parseFloat(maxOrderDistanceKm) || 25,
      };

      if (
        body.day_shift_start === null ||
        body.day_shift_end === null ||
        body.night_shift_start === null ||
        body.night_shift_end === null
      ) {
        setError("Invalid time format. Use HH:MM AM/PM (e.g. 5:00 AM)");
        setSaving(false);
        return;
      }

      const res = await fetch(`${API_URL}/manager/system-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Tier handlers
  const updateServiceTier = (idx, field, value) => {
    setServiceFeeTiers((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      return c;
    });
  };
  const addServiceTier = () =>
    setServiceFeeTiers((prev) => [...prev, { min: "", max: "", fee: "" }]);
  const removeServiceTier = (idx) =>
    setServiceFeeTiers((prev) => prev.filter((_, i) => i !== idx));

  const updateDeliveryTier = (idx, field, value) => {
    setDeliveryFeeTiers((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      return c;
    });
  };
  const addDeliveryTier = () =>
    setDeliveryFeeTiers((prev) => [...prev, { max_km: "", fee: "" }]);
  const removeDeliveryTier = (idx) =>
    setDeliveryFeeTiers((prev) => prev.filter((_, i) => i !== idx));

  const updateConstraint = (idx, field, value) => {
    setOrderDistanceConstraints((prev) => {
      const c = [...prev];
      c[idx] = { ...c[idx], [field]: value };
      return c;
    });
  };
  const addConstraint = () =>
    setOrderDistanceConstraints((prev) => [
      ...prev,
      { min_km: "", max_km: "", min_subtotal: "" },
    ]);
  const removeConstraint = (idx) =>
    setOrderDistanceConstraints((prev) => prev.filter((_, i) => i !== idx));

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#13ECB9" />
          <Text style={{ marginTop: 12, color: "#64748B" }}>
            Loading config...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Reusable field component
  const Field = ({
    label,
    value,
    onChangeText,
    hint,
    keyboardType = "decimal-pad",
  }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={String(value)}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#94A3B8"
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banners */}
          {saved && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#06C168" />
              <Text style={styles.successText}>
                Configuration saved successfully!
              </Text>
            </View>
          )}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Ionicons name="close" size={18} color="#F87171" />
              </TouchableOpacity>
            </View>
          )}

          {/* SECTION 1: Driver Earnings */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(19,236,185,0.08)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="card-outline" size={18} color="#13ECB9" />
                <Text style={styles.sectionTitle}>Driver Earnings</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Rate and bonus configuration for drivers
              </Text>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.fieldRow}>
                <Field
                  label="RTC Rate <= 5km (Rs./km)"
                  value={rtcRateBelow5Km}
                  onChangeText={setRtcRateBelow5Km}
                  hint="Paid per km for Restaurant→Customer up to 5km"
                />
                <Field
                  label="RTC Rate > 5km (Rs./km)"
                  value={rtcRateAbove5Km}
                  onChangeText={setRtcRateAbove5Km}
                  hint="Paid per km for Restaurant→Customer above 5km"
                />
              </View>
              <View style={styles.fieldRow}>
                <Field
                  label="Max DTR Distance (km)"
                  value={maxDTRKm}
                  onChangeText={setMaxDTRKm}
                  hint="Max paid distance: Driver→Restaurant"
                />
                <Field
                  label="Rate per KM (Rs.)"
                  value={ratePerKm}
                  onChangeText={setRatePerKm}
                  hint="Used for extra-distance and legacy fallback"
                />
              </View>
              <View style={styles.fieldRow}>
                <Field
                  label="DTR Amount (Rs./km)"
                  value={maxDTRAmount}
                  onChangeText={setMaxDTRAmount}
                  hint="Rate per km for Driver→Restaurant"
                />
                <Field
                  label="Max Rest Proximity (km)"
                  value={maxRestProximity}
                  onChangeText={setMaxRestProximity}
                  hint="Max distance between restaurants"
                />
              </View>
              <View style={styles.fieldRow}>
                <Field
                  label="2nd Delivery Bonus (Rs.)"
                  value={secondBonus}
                  onChangeText={setSecondBonus}
                  hint="Bonus for accepting 2nd delivery"
                />
                <Field
                  label="Additional Bonus (Rs.)"
                  value={additionalBonus}
                  onChangeText={setAdditionalBonus}
                  hint="Bonus for 3rd, 4th, 5th delivery"
                />
              </View>
            </View>
          </View>

          {/* SECTION 2: Delivery Availability */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(59,130,246,0.06)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="options-outline" size={18} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Delivery Availability</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Controls which deliveries are shown to drivers
              </Text>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.fieldRow3}>
                <Field
                  label="Max Extra Time (min)"
                  value={maxExtraTime}
                  onChangeText={setMaxExtraTime}
                  keyboardType="number-pad"
                />
                <Field
                  label="Max Extra Dist (km)"
                  value={maxExtraDistance}
                  onChangeText={setMaxExtraDistance}
                />
                <Field
                  label="Max Active Deliveries"
                  value={maxActiveDeliveries}
                  onChangeText={setMaxActiveDeliveries}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          {/* SECTION 3: Service Fee Tiers */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(147,51,234,0.06)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="receipt-outline" size={18} color="#9333EA" />
                <Text style={styles.sectionTitle}>Service Fee Tiers</Text>
                <View style={[styles.badge, { backgroundColor: "#F3E8FF" }]}>
                  <Text style={[styles.badgeText, { color: "#7C3AED" }]}>
                    Customer Facing
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>
                Fee charged based on order subtotal
              </Text>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.tierHeaderRow}>
                <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                  Min (Rs.)
                </Text>
                <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                  Max (Rs.)
                </Text>
                <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                  Fee (Rs.)
                </Text>
                <View style={{ width: 32 }} />
              </View>
              {serviceFeeTiers.map((tier, idx) => (
                <View key={idx} style={styles.tierRow}>
                  <TextInput
                    style={[styles.tierInput, { flex: 1 }]}
                    value={String(tier.min)}
                    onChangeText={(v) => updateServiceTier(idx, "min", v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                  <TextInput
                    style={[styles.tierInput, { flex: 1 }]}
                    value={String(tier.max)}
                    onChangeText={(v) => updateServiceTier(idx, "max", v)}
                    keyboardType="decimal-pad"
                    placeholder="∞"
                    placeholderTextColor="#94A3B8"
                  />
                  <TextInput
                    style={[styles.tierInput, { flex: 1 }]}
                    value={String(tier.fee)}
                    onChangeText={(v) => updateServiceTier(idx, "fee", v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => removeServiceTier(idx)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={addServiceTier}>
                <Ionicons name="add" size={16} color="#13ECB9" />
                <Text style={styles.addBtnText}>Add Tier</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SECTION 4: Delivery Fee Tiers */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(245,158,11,0.06)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="car-outline" size={18} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Delivery Fee Tiers</Text>
                <View style={[styles.badge, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[styles.badgeText, { color: "#B45309" }]}>
                    Customer Facing
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>
                Fee charged based on delivery distance
              </Text>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.tierHeaderRow}>
                <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                  Up to (km)
                </Text>
                <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                  Fee (Rs.)
                </Text>
                <View style={{ width: 32 }} />
              </View>
              {deliveryFeeTiers.map((tier, idx) => (
                <View key={idx} style={styles.tierRow}>
                  <TextInput
                    style={[styles.tierInput, { flex: 1 }]}
                    value={String(tier.max_km)}
                    onChangeText={(v) => updateDeliveryTier(idx, "max_km", v)}
                    keyboardType="decimal-pad"
                    placeholder="km"
                    placeholderTextColor="#94A3B8"
                  />
                  <TextInput
                    style={[styles.tierInput, { flex: 1 }]}
                    value={String(tier.fee)}
                    onChangeText={(v) => updateDeliveryTier(idx, "fee", v)}
                    keyboardType="decimal-pad"
                    placeholder="Rs."
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => removeDeliveryTier(idx)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={addDeliveryTier}>
                <Ionicons name="add" size={16} color="#13ECB9" />
                <Text style={styles.addBtnText}>Add Tier</Text>
              </TouchableOpacity>

              {/* Overflow tier */}
              <View style={styles.overflowSection}>
                <Text style={styles.overflowLabel}>
                  Beyond max tier (extra distance pricing)
                </Text>
                <View style={styles.fieldRow3}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Base KM</Text>
                    <TextInput
                      style={styles.input}
                      value={String(overflowTier.base_km)}
                      onChangeText={(v) =>
                        setOverflowTier((p) => ({ ...p, base_km: v }))
                      }
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Base Fee (Rs.)</Text>
                    <TextInput
                      style={styles.input}
                      value={String(overflowTier.base_fee)}
                      onChangeText={(v) =>
                        setOverflowTier((p) => ({ ...p, base_fee: v }))
                      }
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Per 100m (Rs.)</Text>
                    <TextInput
                      style={styles.input}
                      value={String(overflowTier.extra_per_100m)}
                      onChangeText={(v) =>
                        setOverflowTier((p) => ({ ...p, extra_per_100m: v }))
                      }
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* SECTION 5: Pending Alert */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(239,68,68,0.06)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color="#EF4444"
                />
                <Text style={styles.sectionTitle}>Pending Delivery Alert</Text>
                <View style={[styles.badge, { backgroundColor: "#FEE2E2" }]}>
                  <Text style={[styles.badgeText, { color: "#DC2626" }]}>
                    Manager Facing
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.sectionBody}>
              <Field
                label="Minutes before showing as pending"
                value={pendingMinutes}
                onChangeText={setPendingMinutes}
                keyboardType="number-pad"
                hint="Deliveries without a driver after this time will appear in Pending Deliveries"
              />
            </View>
          </View>

          {/* SECTION 6: Working Hours */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(79,70,229,0.06)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={18} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Driver Working Hours</Text>
                <View style={[styles.badge, { backgroundColor: "#E0E7FF" }]}>
                  <Text style={[styles.badgeText, { color: "#4F46E5" }]}>
                    Driver Facing
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>
                Shift timings for day and night drivers
              </Text>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.fieldRow}>
                {/* Day Shift */}
                <View
                  style={[
                    styles.shiftCard,
                    {
                      backgroundColor: "rgba(245,158,11,0.06)",
                      borderColor: "#FEF3C7",
                    },
                  ]}
                >
                  <View style={styles.shiftHeader}>
                    <Ionicons name="sunny-outline" size={16} color="#F59E0B" />
                    <Text style={styles.shiftTitle}>Day Shift</Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Start</Text>
                    <TextInput
                      style={styles.input}
                      value={dayStart}
                      onChangeText={setDayStart}
                      placeholder="5:00 AM"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>End</Text>
                    <TextInput
                      style={styles.input}
                      value={dayEnd}
                      onChangeText={setDayEnd}
                      placeholder="7:00 PM"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                {/* Night Shift */}
                <View
                  style={[
                    styles.shiftCard,
                    {
                      backgroundColor: "rgba(79,70,229,0.06)",
                      borderColor: "#E0E7FF",
                    },
                  ]}
                >
                  <View style={styles.shiftHeader}>
                    <Ionicons name="moon-outline" size={16} color="#4F46E5" />
                    <Text style={styles.shiftTitle}>Night Shift</Text>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Start</Text>
                    <TextInput
                      style={styles.input}
                      value={nightStart}
                      onChangeText={setNightStart}
                      placeholder="6:00 PM"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>End</Text>
                    <TextInput
                      style={styles.input}
                      value={nightEnd}
                      onChangeText={setNightEnd}
                      placeholder="6:00 AM"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              </View>
              <Text style={styles.fieldHint}>
                Format: HH:MM AM/PM (e.g. 5:00 AM). Full-time drivers are always
                active.
              </Text>
            </View>
          </View>

          {/* SECTION 7: Order Distance Constraints */}
          <View style={styles.sectionCard}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: "rgba(234,88,12,0.06)" },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="resize-outline" size={18} color="#EA580C" />
                <Text style={styles.sectionTitle}>Order Distance</Text>
                <View style={[styles.badge, { backgroundColor: "#FFEDD5" }]}>
                  <Text style={[styles.badgeText, { color: "#C2410C" }]}>
                    Customer Facing
                  </Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>
                Minimum order subtotal based on distance
              </Text>
            </View>
            <View style={styles.sectionBody}>
              <Field
                label="Max Order Distance (km)"
                value={maxOrderDistanceKm}
                onChangeText={setMaxOrderDistanceKm}
                hint="Customers beyond this distance cannot place orders"
              />

              <View style={styles.overflowSection}>
                <Text style={styles.overflowLabel}>
                  Distance-based minimum subtotal tiers
                </Text>
                <View style={styles.tierHeaderRow}>
                  <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                    From (km)
                  </Text>
                  <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                    To (km)
                  </Text>
                  <Text style={[styles.tierHeaderText, { flex: 1 }]}>
                    Min (Rs.)
                  </Text>
                  <View style={{ width: 32 }} />
                </View>
                {orderDistanceConstraints.map((c, idx) => (
                  <View key={idx} style={styles.tierRow}>
                    <TextInput
                      style={[styles.tierInput, { flex: 1 }]}
                      value={String(c.min_km)}
                      onChangeText={(v) => updateConstraint(idx, "min_km", v)}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={[styles.tierInput, { flex: 1 }]}
                      value={String(c.max_km)}
                      onChangeText={(v) => updateConstraint(idx, "max_km", v)}
                      keyboardType="decimal-pad"
                      placeholder="5"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={[styles.tierInput, { flex: 1 }]}
                      value={String(c.min_subtotal)}
                      onChangeText={(v) =>
                        updateConstraint(idx, "min_subtotal", v)
                      }
                      keyboardType="decimal-pad"
                      placeholder="300"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => removeConstraint(idx)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addBtn} onPress={addConstraint}>
                  <Ionicons name="add" size={16} color="#13ECB9" />
                  <Text style={styles.addBtnText}>Add Constraint</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Spacer */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed Save Button */}
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#111816" />
                <Text style={styles.saveBtnText}>Save All Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, paddingBottom: 120 },

  // Banners
  successBanner: {
    backgroundColor: "#EDFBF2",
    borderWidth: 1,
    borderColor: "#9EEBBE",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  successText: { color: "#166534", fontSize: 13, fontWeight: "500", flex: 1 },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  errorText: { color: "#991B1B", fontSize: 13, fontWeight: "500", flex: 1 },

  // Section Card
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 14,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#111816" },
  sectionDesc: { fontSize: 11, color: "#618980", marginTop: 2 },
  sectionBody: { padding: 14 },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 9, fontWeight: "600" },

  // Fields
  field: { flex: 1, marginBottom: 8 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldRow3: { flexDirection: "row", gap: 8 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#618980",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldHint: { fontSize: 10, color: "#618980", marginTop: 2 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111816",
  },

  // Tier rows
  tierHeaderRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  tierHeaderText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#618980",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tierRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 6,
  },
  tierInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    color: "#111816",
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  addBtnText: { fontSize: 12, fontWeight: "500", color: "#13ECB9" },

  // Overflow section
  overflowSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  overflowLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#618980",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Shift cards
  shiftCard: { flex: 1, borderRadius: 8, padding: 10, borderWidth: 1 },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  shiftTitle: { fontSize: 12, fontWeight: "700", color: "#111816" },

  // Save bar
  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  saveBtn: {
    backgroundColor: "#13ECB9",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  saveBtnDisabled: { backgroundColor: "#E5E7EB" },
  saveBtnText: { color: "#111816", fontWeight: "700", fontSize: 14 },
});

export default OperationsConfigScreen;
