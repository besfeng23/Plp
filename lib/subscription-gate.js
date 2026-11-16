export function subscriptionGateEnabled() {
  return process.env.PLP_SUBSCRIPTION_GATE_ENABLED === 'true';
}
