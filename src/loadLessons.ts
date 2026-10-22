import type { Lang } from "./content/types";
import { buildTracks, bundledRegistry, defsForTrack } from "./courseRegistry";

/** @deprecated use courseRegistry + state */
export function loadAllTracks(lang: Lang) {
  return buildTracks(bundledRegistry(), lang);
}

/** @deprecated use defsForTrack(registry, track) */
export function lessonDefsForTrack(track: string) {
  return defsForTrack(bundledRegistry(), track);
}

export { buildTracks, bundledRegistry, defsForTrack } from "./courseRegistry";
