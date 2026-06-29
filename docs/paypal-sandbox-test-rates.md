# PayPal sandbox test rates

This branch temporarily lowers server-side booking rates so PayPal sandbox checkout can be tested with small PHP amounts.

Temporary nightly rates:

- Smart Room Premium: PHP 30 / night
- Sunset Suite: PHP 40 / night
- Grand Ocean Villa: PHP 50 / night

The booking API still applies the existing 30% deposit rule. A one-night sandbox payment will therefore be approximately:

- Smart Room Premium: PHP 9 deposit
- Sunset Suite: PHP 12 deposit
- Grand Ocean Villa: PHP 15 deposit

This is for sandbox testing only and must be reverted before real/public booking use.
