# Pool: public hackathon release

Status: software implemented and locally rehearsed, 2026-10-04. Public transactions and final source verification await wallet signing. See TESTNET_RUNBOOK.md for execution. This extends the completed local sprint to a public Arbitrum Sepolia demo. It supersedes the local-only deployment scope in SPRINT_SPEC.md; the financial model remains a receivables-backed lending facility.

## Deliverable

A Vercel URL that judges can open without a wallet to inspect the pool, evidence, contract addresses and transaction history. Connecting MetaMask enables role-authorized transactions. The release includes verified contract source, public signed attestations enforced by the pool, one funded secondary trade, and a reproducible submission video.

Synthetic receivables and test currency remain clearly labeled. Public signatures and transactions are real. An attestor signature establishes who made a claim, not whether an external invoice or legal assignment is true.

## Fixed choices

- Network: Arbitrum Sepolia, chain ID 421614.
- Operator/deployer/seed liquidity provider/demo quote buyer: 0xEb3356a0b57e7dcCb9341fD40545a5dCb6239267.
- Attestor: 0x45b16B03CA58Ac4E02e1522c8457F2BfEe4F8790.
- Investor: 0x68C6e946d815E9df17548f822379ADD9D9439530.
- Currency: clearly named, six-decimal test dollars. No Circle USDC dependency for the initial release. Add a bounded faucet for visitors, separate from operator seed minting.
- One pool and one initial attested portfolio. No post-activation invoice additions in this release.
- Keep the existing fixed demo borrowing rate, with clear labeling.
- Use reproducible deployments of the pinned Morpho and Pendle source for the testnet demonstration. Record them as Pool-operated testnet instances; do not describe them as official protocol deployments or listings.
- Three wallets suffice. The operator also funds the demonstration trade/backstop; this is not evidence of independent market demand.
- Browser wallets sign all user writes. The public host holds no wallet private keys.

## 1. Attestation and admission

Build an EIP-712 signed claim and public onchain registry. A custom registry avoids depending on an unverified official EAS deployment. Public verification consists of the registry state, contract source, event/transaction, signer, and downloadable exact evidence bytes.

Claim fields: schema version, target pool, portfolio/document root, invoice identifiers and committed values, aggregate face/book values, currency, valuation timestamp, validity deadline and nonce. The EIP-712 domain binds chain ID and registry address. Define a single deterministic serialization and hashing algorithm, with fixed test vectors shared by frontend and contracts.

Attestor workflow: review the synthetic evidence bundle, sign in MetaMask, export the signed JSON. Operator imports the JSON and submits it to the registry, paying gas. Different devices can use the file handoff; no shared wallet installation is required. Include a similarly authenticated revocation path, with replay protection.

Pool admission verifies the authorized signer, correct pool/domain, live claim, values, document commitments and duplicate invoice IDs. The constructor no longer silently creates the five receivables or mints unverified collateral. For this bounded portfolio, submit all five entries and verify their commitment onchain before activation.

Expired or revoked eligibility prevents activation/new borrowing. It must not disable repayment, collection, withdrawal of available lender liquidity or liquidation. Do not abruptly zero the oracle or revert its reads on expiry. Retain the last explicitly reported valuation, display its freshness, and allow downward impairment. Separate claim expiry from credit loss recognition.

Tests: valid admission; wrong signer/chain/pool; modified fields; expired/revoked claims; nonce reuse; duplicate entries; unauthorized revocation; blocked borrowing with preserved repayment paths.

## 2. Wallet and state layer

Split the reusable contract reads and transaction construction out of the local Anvil orchestration. Public mode reads Arbitrum Sepolia and submits writes via MetaMask; local mode retains the accelerated scenario runner.

- Enforce chain ID and verify configured contract bytecode before enabling actions.
- Handle account/network changes, rejection, insufficient gas, allowance, pending/replaced/reverted transactions and receipt confirmation.
- Role checks must exist in contracts as well as the UI.
- Replace the fake selected demo actor with the connected account.
- Remove public time-travel and unrestricted local operator endpoints.
- Fetch state consistently at a block; scan events from the recorded deployment block in bounded ranges. Display RPC/indexing lag instead of silently showing stale balances as current.
- Keep public evidence fixtures in the release build, keyed by content hash. Verify downloaded bytes against the onchain commitment. No confidential documents are needed.

## 3. Deployment and verification

Generate compiler standard-JSON inputs with complete imported source, compiler versions, optimizer/EVM settings and constructor arguments. Pin compiler dependencies exactly. Preserve these verification inputs with the release artifacts.

Build a resumable MetaMask deployment/setup screen. It estimates each operation, verifies the expected operator and network, waits for success, and records addresses/receipts after each step. Resume only after checking code and initialization state; never blindly redeploy on reload.

Deploy test currency, registry, pool/oracle, lending engine/rate model/vault, Pendle factory infrastructure, SY, PT/YT and routers. Deploy only the final tested versions. Store the chain ID, commit, deployment block, code hashes, owners, market parameters, maturity and explorer links in a public release manifest.

Initialize the market, publish the attestation, admit the portfolio and seed liquidity through authorized transactions. Keep attestor control with the attestor wallet. Verify custom and deployed upstream contracts on a supported source-verification service; report unresolved verification explicitly. Explorer API credentials, if required, go in local or Vercel secret settings, never frontend code or chat.

Before broadcasting, refresh wallet balances and calculate the complete deployment estimate with a buffer. Previously observed balances are not a current funding check.

## 4. Complete the demonstrable instrument

Retain deposit, borrow, collection, debt repayment, PT/YT splitting, claims and redemption. Add one fixed-size signed PT or YT quote with an atomic token-for-test-dollar fill, exact maker/taker/asset/amount binding, deadline, nonce, cancellation and replay protection. Simulate balance/allowance immediately before filling. Label quotes as executable only while funded and valid. No AMM or guaranteed ongoing liquidity is claimed.

Use real testnet timestamps. Prepare a normal unexpired series and a separately seeded short-duration series that actually reaches maturity before recording its redemption. Choose valid expiries from the deployed factory configuration. Display small accrued interest with sufficient precision; do not manufacture yield with time-travel on the public chain.

Run impairment/liquidation on a separate prepared scenario or after recording the healthy flow, so the showcase pool is not accidentally left unusable. Exercise finite backstop liquidity, failed withdrawals and the debt-free closure path.

## 5. Vercel and release evidence

Link/create the Pool project in the authenticated Vercel workspace. Build and host the public frontend; do not deploy the loopback operator API. Keep ABIs and public deployment metadata in the frontend bundle, excluding compiler/deployment bytecode unless explicitly needed by the operator setup screen.

Start with public RPC reads; add a rate-limited read-only RPC proxy only if browser reliability requires it. A provider key remains server-side. A database, paid indexer, IPFS service and automated signing relayer are not initial prerequisites.

Verify the production URL in a clean browser, including deep links, disconnected viewing, wallet/network switching, transaction confirmation, evidence download, explorer links and mobile layout. Confirm the judges can access the intended submission URL without Vercel account authentication.

## Release acceptance

1. A fresh visitor inspects a public pool and verifies a signed evidence bundle against its onchain commitment.
2. The attestor signs; the operator submits; valid admission succeeds and a tampered claim fails.
3. The investor obtains test dollars, deposits and receives lender shares.
4. The operator borrows against the admitted portfolio.
5. The investor splits lender shares and sells a bounded PT/YT amount for actual test dollars.
6. A collection arrives as an actual token transfer and repayment changes the debt without double counting NAV.
7. The prepared matured position redeems using actual testnet time.
8. A failed/unauthorized action produces an understandable error and no state change.
9. Refreshing the public frontend recovers confirmed state; no local API or Anvil is needed.
10. The README, release manifest and video identify the network, public transactions, synthetic inputs and protocol-instance boundaries consistently.

## Submission video

Record approximately 3–5 minutes: financing problem and investor claim; attestation/evidence; deposit and borrow; PT/YT separation and paid trade; collection/repayment; prepared maturity redemption; explorer evidence and limitations. Pre-confirm setup transactions and explain edits/time gaps. Keep a transaction manifest and backup recording for RPC delays.

## Required owner actions

- Connect the operator wallet for deployment/setup confirmations and the attestor wallet for its typed-data signature.
- Have Arbitrum Sepolia ETH in transaction-sending wallets. The attestor needs no ETH if its signed claim/revocation is published by the operator.
- Approve investor and operator demo actions in their respective wallets. Public addresses alone do not grant signing access.
- Vercel authentication is already confirmed. No wallet secret, purchased token, custom domain or paid subscription is required to begin.

Implementation order is 1 → 2 → 3 → 4 → 5, with deployment performed only after affected contracts pass their tests. The contract, wallet, deployment and trading features are implemented; this checklist does not assert a public deployment has occurred.
