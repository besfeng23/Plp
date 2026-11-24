export const REFERRAL_STORAGE_KEY = 'plp_referral_code';

export function normalizeReferralCode(value) {
  const code = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{2,31}$/.test(code) ? code : '';
}

export function captureReferralCode(search = typeof location !== 'undefined' ? location.search : '') {
  const fromUrl = normalizeReferralCode(new URLSearchParams(search).get('ref'));
  try {
    if (fromUrl && typeof sessionStorage !== 'undefined') sessionStorage.setItem(REFERRAL_STORAGE_KEY, fromUrl);
    const stored = typeof sessionStorage !== 'undefined' ? normalizeReferralCode(sessionStorage.getItem(REFERRAL_STORAGE_KEY)) : '';
    return fromUrl || stored;
  } catch {
    return fromUrl;
  }
}
