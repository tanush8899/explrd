import React from "react";
import { useRouter } from "expo-router";
import PhotoSyncView from "@/components/photos/PhotoSyncView";

/** Profile "Sync from Photos" — re-scan the library and confirm new cities. */
export default function PhotoSyncModal() {
  const router = useRouter();
  return <PhotoSyncView mode="resync" onClose={() => router.back()} />;
}
