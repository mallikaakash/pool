# Pool — trade credit, composed

## Product

A local, test-funds demonstration of a receivables-backed funding facility. An originator pledges an already-owned, assigned portfolio. Lenders supply disposable tUSD through a vault into an isolated Morpho Blue market. Pendle splits lender vault shares into principal and yield. The intended real instrument would target eligible professional investors; the demo does not enforce investor qualification.

## Trust boundary

All invoices, debtors, legal assignment, collections, dates advanced by the operator, originator decisions and cash funding are synthetic. InvoiceNow, TradeTrust, TFR, banking and registry integrations are not connected. No claim of endorsement, licensing, live assets or production liquidity. The local demo uses disposable unlocked Anvil accounts, never a real wallet key.

## Scope

- One pool, one currency, five synthetic receivables, roles separated by local wallets.
- Real Morpho Blue source dependency, collateral market, supply, borrow, interest, repay and liquidation.
- ERC-4626 lender vault with available-liquidity-limited withdrawals. Shares are claims on a lending position, not cash guarantees.
- Real Pendle core PT/YT factory and custom SY adapter where integration can be verified. Clearly distinguish any unavailable secondary AMM market from functional token splitting.
- Controlled collections: receipt into the collateral portfolio, servicing can sweep only into repayment of its configured debt while retiring the borrower's matching collateral shares. This preserves per-share NAV for other collateral holders. Pool holder redemption only against available cash and after the credit facility closes.
- Losses reduce collateral NAV. Oracle quotes are valuation inputs, not executable bids. A funded local liquidator demonstrates finite backstop capacity, not insurance.
- Interest belongs to lenders via Morpho accounting. Pendle splits that lending yield, not invoice discount income directly.
- Maturity redeems to lender vault shares; stablecoin withdrawal remains constrained by available Morpho liquidity. PT is not capital protected.
- Responsive web UI: pool, portfolio, yield lab, servicing and transaction receipts; all balances fetched from local contracts.

## Acceptance

Verify deposits and borrow/repay, authorised loss recognition, NAV conservation during collections, access control, insufficient-liquidity withdrawal behaviour, a real Morpho liquidation after impairment, Pendle mint and maturity redemption, and refresh persistence. Commit tests and an explicit production gap list. Public deployment and real money are out of scope for this sprint.
