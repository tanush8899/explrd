import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { SavedPlace } from "@explrd/shared";
import { NOTES_MAX } from "@/lib/api";
import { countryFlag } from "@/lib/flags";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { colors, radius, shadow, space, type as t } from "@/lib/theme";

type Props = {
  /** The place being edited, or null when the sheet is closed. */
  place: SavedPlace | null;
  onClose: () => void;
  /** Persist the note (already normalized server-side). */
  onSave: (placeId: string, notes: string | null) => Promise<void>;
  /** Optional quick-delete. When provided, a Delete button appears (with its own
   *  confirmation). After a successful delete the sheet closes. */
  onDelete?: (placeId: string) => Promise<void>;
};

/**
 * A bottom-anchored editor for a single city's private note, with an optional
 * quick-delete. Shared by the places list (edit after the fact) and the map
 * (tap a pin → notes + delete).
 */
export default function CityNoteSheet({ place, onClose, onSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Seed the field whenever a new place opens.
  useEffect(() => {
    setText(place?.notes ?? "");
  }, [place?.place_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = place?.name ?? place?.city ?? place?.formatted ?? "";
  const subtitle = [place?.state, place?.country].filter(Boolean).join(", ");
  const dirty = (place?.notes ?? "") !== text.trim();
  const remaining = NOTES_MAX - text.length;

  const handleSave = async () => {
    if (!place || saving) return;
    setSaving(true);
    try {
      hapticSelection();
      const next = text.trim();
      await onSave(place.place_id, next.length === 0 ? null : next);
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save note", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!place || !onDelete) return;
    Alert.alert("Remove Place", `Remove “${label}” from your passport?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            hapticLight();
            await onDelete(place.place_id);
            onClose();
          } catch (e) {
            Alert.alert("Couldn't remove", e instanceof Error ? e.message : "Please try again.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={place !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View style={[styles.island, { marginBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={styles.header}>
            <View style={styles.flagWell}>
              <Text style={styles.flag}>{countryFlag(place?.country ?? "")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{label}</Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={(v) => setText(v.slice(0, NOTES_MAX))}
              placeholder="Add a note about this place: a memory, a tip, who you were with…"
              placeholderTextColor={colors.faint}
              multiline
              scrollEnabled
              maxLength={NOTES_MAX}
              autoFocus
              textAlignVertical="top"
            />
          </View>
          <Text style={[styles.counter, remaining <= 20 && styles.counterLow]}>
            {remaining}
          </Text>

          <View style={styles.actions}>
            {onDelete ? (
              <TouchableOpacity
                style={[styles.btn, styles.deleteBtn]}
                onPress={handleDelete}
                disabled={deleting || saving}
                activeOpacity={0.7}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={styles.deleteText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, styles.saveBtn, !dirty && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!dirty || saving || deleting}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save note</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  kav: { flex: 1, justifyContent: "flex-end" },
  // Floating island — inset from every edge, all four corners rounded.
  island: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    marginHorizontal: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    ...shadow.sheet,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: space.lg },
  flagWell: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { fontSize: 24, lineHeight: 28 },
  title: { ...t.title3 },
  subtitle: { ...t.footnote, marginTop: 1 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  // Fixed height: the note scrolls internally instead of growing the island.
  fieldWrap: {
    backgroundColor: colors.fillSecondary,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    height: 150,
  },
  input: {
    ...t.body,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  counter: {
    ...t.caption,
    alignSelf: "flex-end",
    marginTop: space.xs,
  },
  counterLow: { color: colors.danger },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  btn: {
    height: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteBtn: {
    paddingHorizontal: space.lg,
    backgroundColor: colors.dangerSoft,
  },
  deleteText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: colors.blue },
  saveBtnDisabled: { backgroundColor: colors.faint },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
