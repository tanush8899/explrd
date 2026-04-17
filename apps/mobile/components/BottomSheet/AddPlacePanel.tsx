import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSession } from "@/lib/SessionContext";
import { geocode, savePin, type GeoResult } from "@/lib/api";
import type { SavedPlace } from "@explrd/shared";

type Props = {
  onSaved: (place: SavedPlace) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
};

export default function AddPlacePanel({
  onSaved,
  onSearchFocus,
  onSearchBlur,
}: Props) {
  const { session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
        const res = await geocode(text, abortRef.current.signal);
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
      showToast("Place saved!");
      // Optimistic update — parent will full-refresh in background
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
      setQuery("");
      setResults([]);
      setSelected(null);
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

  return (
    <BottomSheetScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Add a Place</Text>

      {/* Search input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Search city, country…"
          placeholderTextColor="#868c94"
          value={query}
          onChangeText={handleSearch}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching ? (
          <ActivityIndicator size="small" color="#868c94" style={styles.inputIcon} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={clearSearch} style={styles.inputIcon} hitSlop={8}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Error */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Selected preview + confirm */}
      {selected && (
        <View style={styles.selectedBox}>
          <Text style={styles.selectedName} numberOfLines={2}>
            {selected.display_name}
          </Text>
          <Text style={styles.selectedCoords}>
            {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Place</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results list */}
      {!selected && results.length > 0 && (
        <View style={styles.resultsList}>
          {results.map((item) => {
            const parts = item.display_name.split(",");
            const primary = parts[0].trim();
            const secondary = parts.slice(1).join(",").trim();
            return (
              <TouchableOpacity
                key={item.place_id}
                onPress={() => setSelected(item)}
                style={styles.resultRow}
              >
                <Text style={styles.resultPrimary} numberOfLines={1}>
                  {primary}
                </Text>
                {secondary ? (
                  <Text style={styles.resultSecondary} numberOfLines={1}>
                    {secondary}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Empty state */}
      {!selected && !searching && query.length > 2 && results.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      )}

      {/* Hint when idle */}
      {!selected && query.length === 0 && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            Type a city or country name to search. Only city-level results can be saved.
          </Text>
        </View>
      )}
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111214",
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e6e8",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111214",
  },
  inputIcon: {
    marginLeft: 8,
  },
  clearBtn: {
    fontSize: 12,
    color: "#868c94",
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#dc2626",
  },
  toast: {
    marginTop: 10,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#166534",
  },
  selectedBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    padding: 14,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111214",
  },
  selectedCoords: {
    fontSize: 12,
    color: "#868c94",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: "#111214",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelBtn: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    color: "#868c94",
  },
  resultsList: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#f0f1f2",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f7f8f9",
  },
  resultPrimary: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111214",
  },
  resultSecondary: {
    fontSize: 12,
    color: "#868c94",
    marginTop: 2,
  },
  emptyState: {
    marginTop: 32,
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
});
