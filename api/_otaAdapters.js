const ADAPTERS = {
  agoda: { channelKey: 'agoda', channelName: 'Agoda', supportsInventory: true },
  airbnb: { channelKey: 'airbnb', channelName: 'Airbnb', supportsInventory: true },
  expedia: { channelKey: 'expedia', channelName: 'Expedia', supportsInventory: true },
  booking_com: { channelKey: 'booking_com', channelName: 'Booking.com', supportsInventory: true },
  direct_website: { channelKey: 'direct_website', channelName: 'Direct Website', supportsInventory: true },
  google_hotel_ads: { channelKey: 'google_hotel_ads', channelName: 'Google Hotel Ads', supportsInventory: false },
  trip_com: { channelKey: 'trip_com', channelName: 'Trip.com', supportsInventory: true },
};

export function assertLiveSyncDisabled() {
  if (process.env.PLP_ENABLE_LIVE_OTA_SYNC === 'true') {
    throw new Error('Live OTA sync is intentionally disabled in Phase 2A.');
  }
}

export function getOtaAdapter(channelKey) {
  assertLiveSyncDisabled();
  const adapter = ADAPTERS[String(channelKey || '').trim()];
  if (!adapter) return null;
  return {
    ...adapter,
    phase: '2A',
    mode: 'dry_run_only',
    liveWritesSupported: false,
    sendInventoryUpdate() {
      throw new Error('Live OTA sync is intentionally disabled in Phase 2A.');
    },
  };
}

export function buildInventoryPayload(channelKey, dryRunItem) {
  assertLiveSyncDisabled();
  const adapter = getOtaAdapter(channelKey);
  if (!adapter) throw new Error(`Unsupported OTA channel: ${channelKey}`);
  return {
    mode: 'dry_run',
    channelKey: adapter.channelKey,
    channelName: adapter.channelName,
    accommodationName: dryRunItem?.internalAccommodationName || dryRunItem?.accommodationName || null,
    otaRoomId: dryRunItem?.otaRoomId || null,
    otaRatePlanId: dryRunItem?.otaRatePlanId || null,
    date: dryRunItem?.date || null,
    available: Boolean(dryRunItem?.available),
    proposedAction: dryRunItem?.proposedAction || 'skip_mapping_not_ready',
    reason: dryRunItem?.reason || 'dry_run_payload_only',
    dryRunOnly: true,
  };
}
