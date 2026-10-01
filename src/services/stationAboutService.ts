import { LOCAL_DEMO } from '@/config/appMode';
import { getSupabase, throwIfError } from '@/lib/supabase';
import {
  defaultStationAbout,
  mergeStationAbout,
  type StationAboutProfile,
} from '@/utils/stationAboutDefaults';
import { demoGetStationAbout, demoSaveStationAbout } from '@/localDemo/demoBackend';

const STATION_ABOUT_DOC_ID = 'about';

let cachedDisplayName = defaultStationAbout().displayName;

export type { StationAboutProfile };

/** Sync pump name for PDF/CSV headers (updated whenever profile is loaded or saved). */
export function getCachedPumpDisplayName(): string {
  return cachedDisplayName;
}

function rememberProfile(profile: StationAboutProfile): StationAboutProfile {
  cachedDisplayName = profile.displayName;
  return profile;
}

export async function getStationAbout(): Promise<StationAboutProfile> {
  if (LOCAL_DEMO) {
    return rememberProfile(mergeStationAbout(demoGetStationAbout()));
  }
  const { data, error } = await getSupabase()
    .from('station_settings')
    .select('data')
    .eq('id', STATION_ABOUT_DOC_ID)
    .maybeSingle();
  throwIfError(error, 'Load station about');
  if (!data) {
    return rememberProfile(defaultStationAbout());
  }
  return rememberProfile(mergeStationAbout(data.data as Partial<StationAboutProfile>));
}

export async function saveStationAbout(input: StationAboutProfile, updatedBy: string): Promise<StationAboutProfile> {
  const merged = mergeStationAbout(input);
  if (!merged.displayName.trim()) {
    throw new Error('Station name is required.');
  }
  if (LOCAL_DEMO) {
    demoSaveStationAbout(merged);
    return rememberProfile(merged);
  }
  const { error } = await getSupabase().from('station_settings').upsert(
    {
      id: STATION_ABOUT_DOC_ID,
      data: merged,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  throwIfError(error, 'Save station about');
  return rememberProfile(merged);
}
