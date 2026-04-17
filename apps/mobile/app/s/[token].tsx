import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchPublicShare, type PublicSharePayload } from "@/lib/api";
import PassportCard from "@/components/PassportCard";

// ─── Sub-component ────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PublicShareScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();

  const [payload, setPayload] = useState<PublicSharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicShare(token);
      setPayload(data);
    } catch {
      setError("This passport link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#111214" />
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !payload) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>Link expired</Text>
        <Text style={styles.errorDesc}>
          {error ?? "Something went wrong. Please try again."}
        </Text>
        <TouchableOpacity onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 48 },
      ]}
    >
      <Text style={styles.eyebrow}>EXPLR PASSPORT</Text>
      <Text style={styles.heading} numberOfLines={2}>
        {payload.displayName}
      </Text>

      <View style={styles.cardWrapper}>
        <PassportCard displayName={payload.displayName} stats={payload.stats} />
      </View>

      <View style={styles.statsRow}>
        <StatPill label="Cities" value={payload.stats.uniqueCities} />
        <StatPill label="Countries" value={payload.stats.uniqueCountries} />
        <StatPill label="Continents" value={payload.stats.uniqueContinents} />
      </View>

      <Text style={styles.cta}>Explore the world with Explr</Text>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#fafbfc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111214",
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 14,
    color: "#868c94",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#111214",
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },

  container: {
    backgroundColor: "#fafbfc",
    paddingHorizontal: 20,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#868c94",
    marginBottom: 6,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#111214",
    marginBottom: 20,
  },

  cardWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 16,
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  statPill: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0f1f2",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: "#111214" },
  statLabel: { fontSize: 11, color: "#868c94", marginTop: 2 },

  cta: {
    fontSize: 13,
    color: "#868c94",
    textAlign: "center",
  },
});
