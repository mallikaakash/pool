# Public testnet release runbook

The initial deployment, signed attestation, portfolio admission and 375,000 tUSD seed deposit are complete on Arbitrum Sepolia. The steps below document setup recovery and the remaining public lifecycle rehearsal. Use the existing public/deployment.json; a new deployment is unnecessary.

## Wallets

- Operator: `0xEb3356a0b57e7dcCb9341fD40545a5dCb6239267`
- Attestor: `0x45b16B03CA58Ac4E02e1522c8457F2BfEe4F8790`
- Investor: `0x68C6e946d815E9df17548f822379ADD9D9439530`

All transaction-sending wallets use Arbitrum Sepolia (421614). Transfer approximately 0.001 test ETH to the investor for gas. Test dollars are minted during setup or claimed from the application. The attestor can sign admission/revocation offchain and let the operator publish it.

## Deploy through MetaMask

1. Open the hosted frontend in the browser containing MetaMask, choose **Setup**, and connect the operator account.
2. Choose **Prepare / resume deployment**. Review each MetaMask transaction. The application deploys the test currency, attestation registry, receivable pool, Morpho engine and market, lender vault, Pendle infrastructure, SY/PT/YT and trading routers. It stops before portfolio admission.
3. Export the deployment bundle. Keep this public JSON backup; it contains no private keys. Completed transaction receipts are also saved in this browser's local storage. If a transaction is pending, resume in the same browser so it can resolve the saved transaction hash.
4. Connect the attestor wallet, open **Evidence**, and import the bundle if using a different browser/device. Review the claim and download the five exact synthetic invoice documents. Choose **Sign reviewed portfolio**. MetaMask requests a typed-data signature, not a gas transaction. Exported signed JSON can be passed back to the operator.
5. In the operator browser, import the signed bundle on **Setup**, reconnect the operator and choose **Publish attestation & finish setup**. The registry authenticates the attestor; the pool admits the committed portfolio and activates the lending facility. The operator seeds 375,000 tUSD; the investor receives 75,000 tUSD.
6. Export `pool-deployment.json`. Preserve the bundle after each major setup operation.

Switching accounts always disconnects the displayed position until **Connect MetaMask** is clicked again. No private signing key is stored in the application, repository or Vercel.

## Publish the shared state and verify source

On the development machine, install the exported manifest only after checking live bytecode and admission:

```sh
npm run publish:manifest -- /absolute/path/to/pool-deployment.json
npm run verify:source -- public/deployment.json
npm run build:release
npx vercel deploy --prod --yes --scope mallikaakashs-projects
```

The verifier submits complete compiler standard JSON and creation transaction hashes to Sourcify v2. Results are written to `docs/source-verification.json`; a submitted job is not treated as successful verification. Source verification may require follow-up if the public service is unavailable. Arbiscan transaction links and Sourcify source links are separate services; a Sourcify result does not automatically imply an Arbiscan verification badge.

The checked-in release manifest makes the same pool discoverable to every visitor without importing a file. Until this publication, only browsers that imported the bundle can see the activated pool. Local deployment bundles take precedence over the hosted manifest.

## Rehearse the healthy lifecycle

1. **Investor / Overview:** deposit 25,000 tUSD. Approval and deposit are separate wallet confirmations.
2. **Operator / Servicing / Additional facility controls:** draw 250,000 tUSD. The attestation must still be active.
3. **Investor / Yield lab:** split 5,000 lender shares into PT/YT. Execution has a 0.5% minimum-output tolerance based on a fresh simulation.
4. **Operator / Trade:** create a bid for 1,000 YT with a total payment of 5 tUSD, naming the investor as seller. Approve the payment and sign the bid. This is a deliberately selected demo quote, not an externally discovered market price.
5. **Investor / Trade:** import the signed bid (or retain it in the same browser), review its exact amounts and fill it. The atomic transaction transfers YT to the operator and tUSD to the investor. Bids expire after one hour and may be cancelled by their maker.
6. **Operator / Servicing:** collect 1,000 tUSD on SG-001, then sweep the received cash into debt repayment. Inspect changed NAV, pool cash and debt.
7. **Evidence / Activity:** inspect the registry, exact evidence bytes, confirmed receipts and public explorer links. Refresh public event history when showing transactions from another browser. This history view fetches at most the latest 10,000 blocks plus release setup receipts.

## Real-time maturity

After initial setup, the operator can choose **Prepare real-time maturity demo**. This creates a separate series expiring at an hourly boundary, approximately 5–65 minutes ahead. It splits 1,000 operator-owned lender shares and transfers 500 PT and 500 YT to the investor. Setup transactions must finish before that expiry.

Export and republish the updated manifest so other browsers can select the same series. In **Yield lab**, select **View prepared short-maturity series**. Wait for actual testnet time to pass its displayed expiry; then redeem PT into lender shares. A later cash withdrawal still depends on Morpho liquidity. No public time-travel mechanism exists. The normal series lasts approximately seven days and remains separately available.

Prepare this series before recording the video. Explain the time gap rather than implying instant maturity.

## Revocation and downside

The attestor can sign a revocation in **Evidence**, export it, and have the operator import/publish it. Borrowing then reverts while collections, repayment and liquidation remain possible. Keep this demonstration for the end or a separate deployment: this version intentionally does not renew a revoked portfolio.

For liquidation, use the operator's remaining test dollars as the disclosed finite backstop. Write down collateral only after recording the healthy flow. This is not evidence of independent buyer demand.

## Verification commands

```sh
npm run check
npm run dev:testnet
# In another terminal while the frontend runs on port 5174:
npm run test:browser:testnet
```

The browser test creates a separate Anvil chain and injects a test wallet provider only in an isolated test browser. It exercises the public frontend and wallet adapter, including deployment, separate signatures, admission, deposit, borrowing, minting, trade and repayment. It does not sign with the owner's wallets, send public transactions or prove compatibility with every MetaMask extension version.

## Submission checklist

- Publish the final manifest and verify every custom contract and deployed protocol implementation.
- Rehearse actual MetaMask prompts on Arbitrum Sepolia.
- Open the final URL in a fresh, disconnected browser; verify evidence, balances and contract links without local services.
- Capture a 3–5 minute video: problem → attestation → financing → yield split and paid trade → collection and repayment → prepared maturity → public receipts.
- Label synthetic invoices, test currency, fixed demo rate and Pool-operated protocol deployments consistently.
- Include the public URL, repository URL, release manifest, transaction links and video in the submission.
