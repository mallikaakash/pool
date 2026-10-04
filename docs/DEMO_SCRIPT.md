# Pool — speak-along demo script

Open https://pool-omega-five.vercel.app in the browser with MetaMask. Keep this guide beside it.

**All amounts below go into Pool’s forms. MetaMask is used to approve, sign and confirm the resulting requests.** tUSD means Pool Test Dollar: a valueless test token, not real USD or TrueUSD. ETH on Arbitrum Sepolia pays transaction fees.

## Before recording

- Network: **Arbitrum Sepolia**, chain ID **421614**.
- Investor / lender: **0x68C6e946d815E9df17548f822379ADD9D9439530**.
- Financier / operator: **0xEb3356a0b57e7dcCb9341fD40545a5dCb6239267**.
- Attestor: **0x45b16B03CA58Ac4E02e1522c8457F2BfEe4F8790**. Its attestation is already published. We reuse this wallet as the YT buyer; those purchase actions are separate from attestation.
- Buyer funding: the attestor wallet needs tUSD for its bid and Arbitrum Sepolia ETH for gas. A 5,000 tUSD transfer from the investor is enough for the chosen 1 tUSD bid; it changes only wallet cash balances. The operator wallet can alternatively act as buyer.
- After every account switch in MetaMask, click **Connect MetaMask** in Pool again. Check the address before acting.
- Keep the same browser tab throughout. Save the signed offer file when downloaded.
- Wait for each confirmation before continuing. Approval and the actual action can be separate MetaMask requests.

Starting state checked from the public contracts on **4 October 2026, 7:41 PM IST**, block **315697483**: 375,000 tUSD supplied; zero borrowed; active attestation; investor has 85,000 tUSD and no pCREDIT/PT/YT. These amounts describe the starting state, not a reset button. Transactions persist. If you have already performed a step, check its result before repeating it.

## 0. Explain the problem — Home / participant diagram

**Show:** the homepage, or [the participant diagram](diagrams/pool-participants-flow.png).

**Say:**

> A supplier can finish a job today and wait sixty days to get paid. Receivables financiers pay that supplier early, but then their own capital is tied up in the invoices. Pool lets those financiers borrow against an existing portfolio. Lenders fund that borrowing and can separate their lending position into principal and future income.

> This demonstration uses synthetic invoices and test dollars on Arbitrum Sepolia. The contract transactions and signatures are real.

Move into the product after this introduction. The launch film is optional; it does not replace the wallet demonstration.

## 1. Show the financing basis — Portfolio, then Proof

**Wallet:** any; no wallet is needed to inspect these screens.

**Click:**

1. **Portfolio**. Show the five synthetic receivables, their values and due dates.
2. **Proof → Evidence**. Show the active attestation and evidence/contract links.

**Enter:** nothing.

**Say:**

> The financier brings this portfolio. The attestor signs a claim tied to its data and evidence. We can inspect the signer and the deployed contracts here. The signature identifies the claim; underwriting and legal ownership still need real-world verification.

The demo's financier, investor, attestor and buyer roles are controlled by us. Do not describe the attestation as an independent institution's approval.

## 2. Become the lender — deposit 25,000 tUSD

**Wallet:** investor **0x68C6…9530**.

**Click / enter:**

1. Select the investor account in MetaMask.
2. Click **Connect MetaMask** in Pool.
3. Open **Invest → Overview**.
4. In **Put capital to work**, select **Deposit**.
5. In **Deposit amount**, replace the existing value with **25000**.
6. Click **Deposit test dollars**.
7. Confirm the token allowance if requested, then the deposit transaction.

**Expected result:** the investor has about 25,000 pCREDIT shares. Total supplied capital becomes approximately 400,000 tUSD. The investor's remaining tUSD balance is 60,000, assuming the verified starting state above and no intervening transfers. If the investor funded the buyer with 5,000 tUSD first, its remaining cash would instead be 55,000 tUSD.

**Say:**

> I’m acting as the lender. I deposit twenty-five thousand test dollars into the lending vault and receive pCREDIT shares. Those shares represent my interest in the vault. The vault supplies the funds into the facility’s Morpho market.

## 3. Become the financier — borrow 250,000 tUSD

**Wallet:** operator **0xEb33…9267**.

**Click / enter:**

1. Switch to the operator account; reconnect in Pool.
2. Open **Operator → Servicing**.
3. Expand **Additional facility controls** near the bottom.
4. In **Additional draw**, enter **250000**.
5. Click **Borrow test dollars** and confirm.
6. Open **Invest → Overview** to show the changed utilisation and yield estimate.

**Expected result:** approximately 250,000 tUSD borrowed against the existing collateral. With about 400,000 supplied, utilisation is roughly 62.5%. At the fixed 12% demo borrowing APR, the indicative lender APR is about 7.5%, or about 7.79% APY before the stated simplifications. These are annualised rates; they are not cash already earned.

**Say:**

> Now I’m the financier. The portfolio is already admitted as collateral, so I draw two hundred and fifty thousand test dollars. This releases working capital before the invoices are paid. The loan now accrues interest, which is the source of lender income.

This amount is an **additional draw**, not a target total. If the loan has already been drawn, show its existing state instead of borrowing another 250,000.

## 4. Split the lending position — 5,000 shares

**Wallet:** investor **0x68C6…9530**.

**Click / enter:**

1. Switch back to the investor; reconnect.
2. Open **Invest → Yield lab**.
3. In **Shape your position**, select **Split shares**.
4. Enter **5000** in **Shares to split**. This field uses **pCREDIT shares**, not tUSD.
5. Click **Mint PT + YT**.
6. Confirm the allowance if requested, then the split transaction.

**Expected result:** about 20,000 pCREDIT shares remain unsplit, with PT and YT created from the other 5,000 shares. Exact PT/YT units depend on the exchange rate at execution. Both token balances should now be visible.

**Say:**

> Back as the lender, I split five thousand lending shares using Pendle’s mechanics. PT holds the principal component; YT holds the income generated until expiry. The same underlying exposure now has two separately held components. Splitting it does not create extra money or remove credit risk.

## 5. Create a genuine test-token offer — buyer wallet

**Wallet:** attestor **0x45b1…8790**, now playing the buyer for this demo.

**Click / enter:**

1. Switch to the attestor / buyer; reconnect.
2. Open **Market**.
3. In **Create a bid to buy**, fill all four fields:

| Field                | Exact input                                    |
| -------------------- | ---------------------------------------------- |
| Token                | **YT**                                         |
| Seller wallet        | **0x68C6e946d815E9df17548f822379ADD9D9439530** |
| Token amount         | **1000**                                       |
| Total payment (tUSD) | **1**                                          |

4. Click **Review offer**.
5. Check that the summary says **1,000 YT for 1 tUSD total**.
6. Click **Approve payment & sign bid**.
7. Confirm the allowance if requested, then sign the typed-data offer.
8. Keep the downloaded **pool-bid.json** file.

**Expected result:** a signed offer is displayed. No sale has happened yet. The bid expires one hour after signing; create a fresh one if the recording happens later.

**Say:**

> I’m using the attestor wallet as the buyer for this demonstration. Buying YT is a separate action from signing the portfolio claim. As the buyer, I offer one test dollar for a thousand YT. This is a chosen test quote, not a discovered market price. The signed offer is funded by the buyer and names the seller who can accept it.

The payment field is the **total** price for all 1,000 tokens, not the price per token.

## 6. Accept the offer — sell YT while keeping PT

**Wallet:** investor **0x68C6…9530**.

**Click / enter:**

1. Switch to the investor; reconnect. Stay on **Market**.
2. Under **Review and fill a bid**, check the existing offer.
3. If no offer is loaded, choose **Load bid file** and select the downloaded **pool-bid.json**.
4. Check the buyer, seller, YT token and total payment.
5. Click **Sell tokens for test dollars**.
6. Confirm the YT allowance if requested, then the trade transaction.

**Enter:** no new amount; the offer already fixes the amount and price.

**Expected result:** the investor transfers 1,000 YT to the buyer and receives 1 tUSD. PT stays with the investor. The remaining YT balance is roughly 4,000, depending on the initial mint amount.

**Say:**

> The lender accepts. In one transaction, the buyer receives YT and the lender receives the agreed payment. My principal tokens stay with me. This demonstrates selling future income separately from the principal component, with an actual counterparty rather than an assumed exit.

## 7. Bring collections back — record 1,000 tUSD, then repay

**Wallet:** operator **0xEb33…9267**.

**Click / enter:**

1. Switch to the operator; reconnect.
2. Open **Operator → Servicing**.
3. In **Record a collection**, select the first invoice: **SG-001**.
4. Replace the default value in **Received payment** with **1000**.
5. Click **Record settled test payment**.
6. Confirm the allowance if requested, then the collection transaction.
7. In **Route the collections**, click **Sweep into repayment** and confirm.

**Expected result:** the invoice records 1,000 tUSD collected. Collection cash first enters the portfolio contract, then is swept into its Morpho debt. The debt decreases by the repayment amount, with interest continuing to accrue over time.

**Say:**

> Finally, I record a customer collection. In this testnet demo, the operator supplies the test-token payment; no bank integration is being claimed. The collection enters the portfolio and is swept into its configured loan. Debt falls and lending liquidity becomes available again.

These are **two actions**: recording the collection and sweeping it into repayment. The second action needs no amount field.

## 8. Show proof and close

**Click:** **Proof → Activity → Refresh public event history**. Open one transaction on the explorer. Use **Proof → Evidence** for the attestation and source links.

**Say:**

> We’ve shown the full cycle: evidence, financing, principal and yield separation, a funded trade, and collection-driven repayment. The proposed primitive is an attested credit position with separately held principal and future income. This release demonstrates one test facility. The next product step is letting receivables financiers configure and publish their own facilities.

> Judges can inspect the facility without a wallet, or connect their own Arbitrum Sepolia wallet, claim test dollars and try depositing and splitting a position.

## Optional: demonstrate redemption without waiting for expiry

Use this after the main narrative if time permits.

- Investor wallet → **Invest → Yield lab → Shape your position → Redeem**.
- **PT to redeem: 500**.
- Click **Redeem to vault shares**. Before expiry this consumes matching PT **and** YT; confirm their allowances and the redemption transaction.
- The result is pCREDIT shares, not immediate cash.
- Then **Invest → Overview → Withdraw**. Enter **100** in **Withdrawal amount** and click **Withdraw test dollars**. This withdrawal requires available vault liquidity.

**Say:**

> Before expiry I can recombine matching principal and yield tokens into vault shares. Converting shares to cash is a separate withdrawal, subject to available liquidity.

The current regular series expires on **11 October 2026 at 1:30 PM IST**. The optional step above is early recombination, not a maturity demonstration. A true near-term maturity recording needs a separately prepared short-expiry series.

## Recording notes

- Plan around 3–4 minutes of edited narration and outcomes; follow the event's actual video limit.
- Cut wallet loading and confirmation waits. Keep the entered amounts, connected role, and confirmed result visible.
- Perform one step at a time. Public transactions are persistent, so rehearsing changes the starting balances for the next take.
- For the main story, use the healthy flow above. Leave impairment, liquidation, closure and attestation revocation for a separate recording so the shared judge facility remains usable.
- A judge's independent happy path is: connect → claim tUSD → deposit → split. Their wallet needs Arbitrum Sepolia ETH for gas. Borrowing/servicing require the operator; a paid trade needs a second funded wallet.
- This script is a first-run sequence from the verified state at the top. If balances or borrowing differ, use the current position instead of repeating completed setup actions.
