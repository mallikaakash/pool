# Pool demo usability pass — 4 October 2026

The homepage now explains the payment gap before the protocol components: a business delivers work before customers pay, financing releases working capital, collections repay debt, and lenders receive borrower interest subject to liquidity and credit losses. The proposed primitive is an attested credit position with separately held principal and income claims. This is not a verified first-of-its-kind claim. The demo still operates one fixed synthetic portfolio; continuous origination is future work.

## Implemented

- Separate marketing navigation and app navigation: Invest, Portfolio, Market and Proof, plus operator controls. Existing hash URLs remain valid.
- Four-step investor guide driven by wallet and position state. Disconnected example balances are explicitly labeled. Connecting clears the preview while the new account loads.
- tUSD currency labels and a persistent testnet disclosure; source publication is distinguished from an independent audit.
- Contextual zero-APY explanation, utilization calculation, and distinction between annualized yield, earned interest and withdrawable liquidity.
- PT/YT explanations and a lending-position prerequisite for first-time visitors.
- Offer review before approving/signing; readable buyer/seller/token summary; raw JSON behind expandable sections. Loading a signed file verifies its signature before presenting it.
- Human-readable attestation summary and separate technical/signing controls. Revocation consequences are described.
- Portfolio concentration and overdue-payment summary; compact mobile invoice table with detailed evidence view.
- Larger secondary text, semantic states, keyboard focus rings, table column scopes, disclosure dialog with Escape dismissal, pending-request messages, and loading placeholders.

## Verification

- TypeScript and production build pass.
- Public read-only browser verification checks real Arbitrum Sepolia data, evidence hashes, navigation, investor onboarding, film and disclosures.
- Disposable-chain wallet rehearsal passes deployment, separate attestation, deposit, borrow, split, review/sign/fill a yield offer, collection and repayment.
- At 390px, Overview, Receivables, Yield lab, Trade and Evidence had no horizontal page overflow.
- Sampled visible form hints, eyebrow labels, table headers, badges, notes, guide text and copy controls met 4.5:1 calculated text/background contrast. Gradient backgrounds were excluded. This is a targeted check, not a complete WCAG audit or certification.

## Deliberately outside this pass

- Multi-wallet provider discovery: the supported connection remains explicitly labeled MetaMask.
- Migration from existing hash links to new /app paths. Marketing and app chrome are separated without breaking current bookmarked routes.
- Mainnet readiness, independent security audit, independent attestor/buyer demand, legal asset rights, and real invoice integrations.

No contract, rate model, wallet role, deployment address or public manifest was changed.

## About page

The public `#about` route explains the financier's capital bottleneck, participant responsibilities, the cash path, and the distinction between borrower collateral and lender shares. A six-step interactive walkthrough accompanies the money-flow diagram. The principal/yield illustration explains whole shares, PT and YT separately, including redemption and liquidity constraints. An educational utilisation slider shows how borrower interest produces lender APR, with constant-balance assumptions stated next to it.

The page distinguishes the implemented single-facility testnet from the planned institution-facing launcher and future portfolio replacement. It includes an original invoice illustration, responsive diagrams, keyboard controls, reduced-motion chapter navigation, and links to public evidence and protocol documentation. About is accessible from the marketing header, homepage footer and app context bar without a connected wallet.

The public browser verifier covers the About deep link and title, all six financing stages, PT/YT explanations, the calculator's zero and maximum endpoints, keyboard disclosure interaction, and overflow at 320, 390 and 768px. The existing release checks continue to cover the live manifest, evidence hashes and financial workspace navigation. This UI pass does not submit transactions or change financial contracts.
