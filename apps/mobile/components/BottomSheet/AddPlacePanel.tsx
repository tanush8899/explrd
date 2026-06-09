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
import { SheetScrollContext } from "@/components/Sheet";
import { useSession } from "@/lib/SessionContext";
import { searchPlaces, savePin, type GeoResult } from "@/lib/api";
import type { SavedPlace } from "@explrd/shared";

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
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Back to results</Text>
        </TouchableOpacity>

        {/* Place info */}
        <View style={styles.placeInfo}>
          <View style={styles.pinDot} />
          <View style={styles.placeTextBlock}>
            <Text style={styles.placeName} numberOfLines={2}>{primaryName}</Text>
            {locationDetail ? (
              <Text style={styles.placeLocation} numberOfLines={1}>{locationDetail}</Text>
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
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={styles.removeBtnText}>Remove from Explr</Text>
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
              <Text style={styles.addBtnText}>Add to Explr</Text>
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
      {/* Search input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Search city, landmark, country…"
          placeholderTextColor="#adb1b8"
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
          <ActivityIndicator size="small" color="#adb1b8" style={styles.inputEndSlot} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtnWrapper} hitSlop={4}>
            <View style={styles.clearBtnCircle}>
              <Text style={styles.clearBtnText}>✕</Text>
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
                activeOpacity={0.7}
              >
                <View style={styles.resultPin} />
                <View style={styles.resultText}>
                  <Text style={styles.resultPrimary} numberOfLines={1}>{primary}</Text>
                  {secondary ? (
                    <Text style={styles.resultSecondary} numberOfLines={1}>{secondary}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Empty state */}
      {!searching && query.length > 2 && results.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      )}

      {/* Idle hint */}
      {query.length === 0 && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            Search for a city, landmark, or country to add it to your map.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ── Search view ────────────────────────────────────────────────────────────
  container: {
    padding: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e4e6e8",
    borderRadius: 16,
    backgroundColor: "#f7f8f9",
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111214",
  },
  inputEndSlot: {
    marginLeft: 8,
  },
  clearBtnWrapper: {
    padding: 6,
    marginLeft: 4,
  },
  clearBtnCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#c7c7cc",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 1,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: "#dc2626",
  },
  resultsList: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f0f1f2",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f7f8f9",
    gap: 12,
  },
  resultPin: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#c7c7cc",
    flexShrink: 0,
    marginTop: 1,
  },
  resultText: {
    flex: 1,
  },
  resultPrimary: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111214",
  },
  resultSecondary: {
    fontSize: 12,
    color: "#868c94",
    marginTop: 2,
  },
  emptyState: {
    marginTop: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#868c94",
  },
  hintBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#f7f8f9",
    borderRadius: 12,
  },
  hintText: {
    fontSize: 13,
    color: "#868c94",
    lineHeight: 19,
  },

  // ── Place card ─────────────────────────────────────────────────────────────
  placeCard: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 32,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 20,
    gap: 2,
  },
  backArrow: {
    fontSize: 22,
    color: "#007aff",
    lineHeight: 26,
    fontWeight: "300",
  },
  backLabel: {
    fontSize: 15,
    color: "#007aff",
    fontWeight: "400",
  },
  placeInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 28,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2563eb",
    marginTop: 5,
    flexShrink: 0,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },
  placeTextBlock: {
    flex: 1,
  },
  placeName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111214",
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  placeLocation: {
    fontSize: 14,
    color: "#868c94",
    marginTop: 4,
    lineHeight: 19,
  },
  addBtn: {
    backgroundColor: "#111214",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  removeBtn: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "#fecaca",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#fff5f5",
  },
  removeBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#dc2626",
  },
});
