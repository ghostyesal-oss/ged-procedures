/** Configuration partagée GED + BRAGATEST */
export const SUPABASE_URL = "https://bkjdvdngadytbzgdcuik.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_vICsnv_IS83BB8us5uUGyA_fY3bA_1d";
export const TABLE = "ged_items";
export const EVENTS_TABLE = "bragatest_events";

/** Navigation interne (pas d’href GED exposé dans le HTML) */
const ADMIN_PATH = ".";
const BRAGATEST_PATH = "bragatest.html";

export function goToAdmin() {
  location.assign(ADMIN_PATH);
}

export function goToBragatest() {
  location.assign(BRAGATEST_PATH);
}