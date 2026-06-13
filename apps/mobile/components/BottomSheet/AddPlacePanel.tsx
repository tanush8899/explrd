import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SheetScrollContext } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { searchPlaces, savePin, type GeoResult } from "@/lib/api";
import type { SavedPlace } from "@explrd/shared";

const BLUE = "#0a84ff";

type Props = {
  places: SavedPlace[];
  onSaved: (place: SavedPlace) => void;
  onDelete: (placeId: string) => Promise<void>;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSelectPlace: (result: GeoResult) => void;
  onDeselectPlace: () => void;
};

export default function AddPlacePanel({
  places,
  onSaved,
  onDelete,
  onSearchFocus,
  onSearchBlur,
  onSelectPlace,
  onDeselectPlace,
}: Props) {
  const { session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      setKbHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      setKbHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    setSelected(null);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setSearching(true);
      try {
        const res = await searchPlaces(text, abortRef.current.signal);
        setResults(res);
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") {
          setError("Search failed. Check your connection and try again.");
        }
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleSelectResult = (item: GeoResult) => {
    Keyboard.dismiss();
    setSelected(item);
    onSelectPlace(item);
  };

  const handleDeselect = () => {
    setSelected(null);
    setError(null);
    onDeselectPlace();
  };

  const handleSave = async () => {
    if (!selected || !session?.access_token) return;
    setSaving(true);
    setError(null);
    try {
      await savePin(session.access_token, {
        place_id: selected.place_id,
        display_name: selected.display_name,
        lat: selected.lat,
        lng: selected.lng,
        address: selected.address,
      });
      onSaved({
        place_id: selected.place_id,
        name: selected.display_name,
        lat: selected.lat,
        lng: selected.lng,
        formatted: selected.display_name,
        city: null,
        state: null,
        country: null,
        continent: null,
        normalized_city: null,
        normalized_state: null,
        normalized_country: null,
        normalized_continent: null,
        city_boundary: null,
        state_boundary: null,
        country_boundary: null,
        continent_boundary: null,
      } satisfies SavedPlace);
      // Clear selection and go back to search
      setSelected(null);
      setQuery("");
      setResults([]);
      onDeselectPlace();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSelected(null);
    setError(null);
  };

  const { onScrollEndDragAtTop, scrollEnabled } = useContext(SheetScrollContext);

  // ── Place card (shown after selecting a result) ───────────────────────────
  if (selected) {
    const parts = selected.display_name.split(",");
    const primaryName = parts[0].trim();
    const locationDetail = parts.slice(1).join(",").trim();
    const alreadySaved = places.some((p) => p.place_id === selected.place_id);

    const handleRemove = async () => {
      setDeleting(true);
      setError(null);
      try {
        await onDelete(selected.place_id);
      } catch (e: unknown) {
        setError((e as Error)?.message ?? "Failed to remove. Try again.");
      } finally {
        setDeleting(false);
      }
    };

    return (
      <View style={styles.placeCard}>
        {/* Back row */}
        <TouchableOpacity onPress={handleDeselect} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={BLUE} />
          <Text style={styles.backLabel}>Results</Text>
        </TouchableOpacity>

        {/* Place info */}
        <View style={styles.placeInfo}>
          <View style={styles.placeIconCircle}>
            <Ionicons name="location" size={22} color={BLUE} />
          </View>
          <View style={styles.placeTextBlock}>
            <Text style={styles.placeName} numberOfLines={2}>{primaryName}</Text>
            {locationDetail ? (
              <Text style={styles.placeLocation} numberOfLines={2}>{locationDetail}</Text>
            ) : null}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* CTA */}
        {alreadySaved ? (
          <TouchableOpacity
            onPress={handleRemove}
            disabled={deleting}
            style={styles.removeBtn}
            activeOpacity={0.7}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#ff453a" />
            ) : (
              <Text style={styles.removeBtnText}>Remove from Passport</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.addBtn}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Add to Passport</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Search view ───────────────────────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: Math.max(48, kbHeight + 20) }]}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollEnabled}
      scrollEventThrottle={16}
      onScrollEndDrag={(e) => {
        const { contentOffset, velocity } = e.nativeEvent;
        if (contentOffset.y <= 0 && (velocity?.y ?? 0) < -0.3) {
          onScrollEndDragAtTop(Math.abs(velocity?.y ?? 0));
        }
      }}
    >
      <Text style={styles.subtitle}>Enter a city, landmark, or country</Text>

      {/* Search input — Flighty's flat grey capsule field */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Search city, landmark, university, park…"
          placeholderTextColor="#868c94"
          value={query}
          onChangeText={handleSearch}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          clearButtonMode="never"
        />
        {searching ? (
          <ActivityIndicator size="small" color="#9aa0a6" style={styles.inputEndSlot} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtnWrapper} hitSlop={6}>
            <View style={styles.clearBtnCircle}>
              <Ionicons name="close" size={13} color="#ffffff" />
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Results */}
      {results.length > 0 && (
        <View style={styles.resultsList}>
          {results.map((item) => {
            const parts = item.display_name.split(",");
            const primary = parts[0].trim();
            const secondary = parts.slice(1).join(",").trim();
            return (
              <TouchableOpacity
                key={item.place_id}
                onPress={() => handleSelectResult(item)}
                style={styles.resultRow}
                activeOpacity={0.6}
              >
                <View style={styles.resultIconCircle}>
                  <Ionicons name="location-sharp" size={16} color={BLUE} />
                </View>
                <View style={styles.resultText}>
                  <Text style={styles.resultPrimary} numberOfLines={1}>{primary}</Text>
                  {secondary ? (
                    <Text style={styles.resultSecondary} numberOfLines={1}>{secondary}</Text>
                  ) : null}
                  {item.landmark_name ? (
                    <Text style={styles.resultLandmark} numberOfLines={1}>
                      Near {item.landmark_name}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={15} color="#c6c9ce" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Empty state */}
      {!searching && query.length > 2 && results.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={26} color="#c6c9ce" />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyDesc}>Try a city, landmark, or country name</Text>
        </View>
      )}

      {/* Hint when idle */}
      {!selected && query.length === 0 && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            Search by city, country, landmark, university, or national park. We'll find the nearest city for you.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Search view ────────────────────────────────────────────────────────────
  container: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "#85898f",
    marginTop: -8,
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#eff1f3",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 17,
    color: "#0b0c0e",
  },
  inputEndSlot: {
    marginLeft: 8,
  },
  clearBtnWrapper: {
    padding: 4,
    marginLeft: 4,
  },
  clearBtnCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#c6c9ce",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: "#ff453a",
  },

  // Results — Flighty's icon rows
  resultsList: {
    marginTop: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 13,
  },
  resultIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(10,132,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  resultText: {
    flex: 1,
  },
  resultPrimary: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0b0c0e",
    letterSpacing: -0.2,
  },
  resultSecondary: {
    fontSize: 12,
    color: "#868c94",
    marginTop: 2,
  },
  resultLandmark: {
    fontSize: 11,
    color: "#a0a7b0",
    marginTop: 2,
    fontStyle: "italic",
  },
  hintBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#f7f8f9",
    borderRadius: 12,
  },
  hintText: {
    fontSize: 13,
    color: "#85898f",
    marginTop: 1,
  },

  // Empty state
  emptyState: {
    marginTop: 48,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0b0c0e",
    marginTop: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: "#85898f",
  },

  // ── Place card ─────────────────────────────────────────────────────────────
  placeCard: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 32,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 16,
    gap: 2,
  },
  backLabel: {
    fontSize: 16,
    color: BLUE,
    fontWeight: "500",
  },
  placeInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 28,
  },
  placeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(10,132,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  placeTextBlock: {
    flex: 1,
  },
  placeName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0b0c0e",
    letterSpacing: -0.6,
    lineHeight: 31,
  },
  placeLocation: {
    fontSize: 14,
    color: "#85898f",
    marginTop: 4,
    lineHeight: 19,
  },
  addBtn: {
    backgroundColor: BLUE,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  removeBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,69,58,0.10)",
  },
  removeBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff453a",
  },
});
