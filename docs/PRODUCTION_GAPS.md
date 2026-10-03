# Production gaps and economic assumptions

## Scope of the instrument

Pool demonstrates financing **existing assets**. The originator has already paid for or otherwise legally acquired the initial $485,000 book-value portfolio. A separately capitalized lending vault supplies $400,000 to Morpho and the originator draws $250,000 against collateral. The $250,000 is released to the originator; it is not counted again in the portfolio's NAV.

The investor owns a lending claim, not the receivables outright. Origination capital, debtor credit risk, asset title and enforceability have not been solved by tokenization.

## Before accepting capital

1. **Asset and legal rights:** an enforceable assignment, actual SPV or equivalent legal structure, debtor acknowledgment where needed, payment instructions, insolvency treatment, claim priority, transfer restrictions and recovery rights. A hash or an ERC-20 is not proof of these rights.
2. **Underwriting and servicing:** eligibility criteria, concentration limits, duplicate-pledge controls, cash reconciliation, repayment attestation, independent administration and a process for disputes and delinquency. This prototype trusts the servicer and does not automatically impair overdue invoices.
3. **Valuation:** independently governed, freshness-aware collateral values with conservative haircuts. The demo accepts downward book-value updates and actual cash receipts. Neither resulting NAV nor the onchain token is an executable liquidation offer.
4. **Capital and liquidation:** committed lender capital and funded buyers allowed to hold the collateral. Model finite backstop capacity, debt interest, liquidation discounts, insolvency, and what happens after all collateral is seized. Test no-bid and partial-fill scenarios. No guaranteed exit is claimed here.
5. **Permissioning:** eligible investor and issuer onboarding, compliance review, and transfer-policy compatibility across Morpho, SY, PT/YT, liquidators and any AMM. The demo collateral and lender tokens are unrestricted. Do not add a restrictive token whitelist without testing whether it strands a protocol position.
6. **Protocol integration:** choose the actual network, stablecoin, live deployment addresses, permitted IRM/LLTV, market configuration, oracle, fee policy and upgrades. Replace the fixed demo IRM if a different rate mechanism is selected. A local deployment of upstream source is not an approved market on the public protocol.
7. **Pendle:** verify the SY adapter against the target deployment, reward semantics, exchange-rate losses and maturity indexing. Provide or explicitly exclude secondary liquidity. PT is not a cash-equivalent or insured principal claim. The demonstration splits lender interest rather than direct invoice yield.
8. **Operational and contract security:** independent review/audits, fuzz and invariant testing, pause/incident procedures, privileged-key governance, least-privilege roles, resilient RPCs, transaction indexing, monitoring and reconciliation. The local server controls every demo role and must not be reused as a public signing service.
9. **User disclosures and availability:** realized versus estimated returns, valuation timestamps, debtor concentrations, loss allocation, exit constraints and cash versus accounting balances. NAV may fall only when the servicer recognizes a loss; the lender vault suffers loss when Morpho realizes bad debt. Those are different events.

## Important accounting edges

- For a $120,000 face / $116,400 book receivable, a $60,000 collection removes $58,200 of receivable book value and adds $60,000 of cash. NAV rises only by $1,800, not $60,000.
- Sweeping $60,000 then reduces both portfolio assets and facility debt. The repayment callback retires the corresponding borrower-owned collateral shares at the pre-payment NAV, preserving per-share value for external collateral holders. Excess collections remain in the pool.
- A sweep needs enough repayment to permit Morpho's collateral withdrawal. If the position would remain unhealthy, the transaction reverts atomically; collateral liquidation or a separate originator repayment must restore sufficient health first. The prototype does not provide an asynchronous redemption queue.
- Interest accrues into Morpho lender assets but is not necessarily withdrawable cash. The vault caps withdrawals at available market liquidity.
- A pre-expiry Pendle redemption needs both PT and YT. After expiry, PT alone returns the corresponding SY backing, which the router unwraps into vault shares.
- A vault loss reduces SY's underlying value. Pendle's nondecreasing index does not insure PT and can suspend further yield until the rate recovers.
- Redemption of seized receivables collateral requires a closed debt-free facility and sufficient cash collections. If assets remain unpaid, the collateral holder may have to wait.

## Dependencies

As verified on 2026-10-03, `npm audit --omit=dev` reports zero runtime dependency advisories. The full development tree reports **36 advisories: 13 low, 20 high and 3 critical**, primarily inherited through Pendle's upstream source/tooling package, with compiler-tooling advisories also present. The runtime application uses viem; it does not import Pendle's ethers or deployment tooling into the frontend or API.

The source package and compiler dependencies are deliberately pinned and isolated as development dependencies. This separation is not a fix for their advisories. Do not use the inherited tooling to handle sensitive keys. A production build process needs a reviewed dependency set, patched tooling, reproducible contract artifacts and a fresh audit; blindly accepting the suggested major downgrade of Pendle would change the protocol being demonstrated.
