# Verification evidence

Verified on 2026-10-03 against the local source and actual locally deployed protocol contracts.

## Automated protocol integration

Ten tests on a dedicated disposable Anvil node:

1. Initial real Morpho market balances, pledged collateral and lender shares.
2. Deposit/withdraw/borrow/repay balances; rejection of over-borrowing and illiquid withdrawals.
3. Partial collection conserves NAV, recognizes only earned discount income, and sweeps only into debt repayment.
4. Unauthorized servicing actions, invalid amounts and premature collateral redemption revert.
5. An impaired position can be liquidated through Morpho; a finite backstop spends cash and receives collateral.
6. Actual Pendle factory PT/YT minting, time-based interest accrual, claiming SY and unwrapping to shares.
7. Redemption requires both tokens before expiry and only PT afterwards; minting is blocked after expiry.
8. Total collateral loss causes actual Morpho bad-debt realization and reduces PT's redeemable economic value.
9. A repaid facility closes, releases residual collateral, permits cash-backed redemption and blocks new borrowing.
10. A collection-funded repayment retires borrower collateral shares and preserves the per-share value of collateral already seized by a liquidator; unauthorized callbacks revert.

These are integration tests, not an audit or comprehensive invariant/fuzz suite. They use the demo's fixed rate model and synthetic oracle, not public-network liquidity or real debtors.

## Browser lifecycle

The repeatable browser test uses a separate automated browser session against the running local application. It verifies UI actions, successful API results and actual onchain state changes. The latest machine-readable result is in `browser-verification.json`.

Screenshots in `screenshots/` show the overview, funded PT/YT position, impaired facility and mobile layout. They come from different stages of one run; their balances are not intended to describe one simultaneous snapshot.

Manual browser inspection also checks the console, page errors, form controls, accessible labels, contrast and desktop/mobile rendering. An automated accessibility scan is a partial check, not a claim of complete WCAG conformance.

## Reproduce

```sh
npm ci
npm run check
npm run dev
# In a second terminal, while the series has not expired:
npm run test:browser
```

Restart the stack before presenting a clean demo. The regression deliberately advances time and recognizes losses.
