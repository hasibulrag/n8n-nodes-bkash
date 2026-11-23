# n8n-nodes-bkash

An n8n community node for the [bKash](https://www.bkash.com/) Payment Gateway, built on the **Tokenized Checkout API (v1.2.0-beta)**. Use it to create, execute, query and refund bKash payments, and to manage wallet agreements, from your n8n workflows.

> **Unofficial.** bKash Limited did not make this package and does not endorse or support it. "bKash" is a trademark of bKash Limited. Test everything in the sandbox before you take real money.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Payment flow](#the-callback-payment-flow) · [Sandbox testing](#sandbox-testing) · [Development](#development) · [Disclaimer](#disclaimer)

## Installation

On a self-hosted n8n instance:

1. Go to **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-bkash` and confirm that you understand the risks of installing unverified community nodes.
4. Select **Install**. The **bKash** node then shows up in the nodes panel.

For queue mode or Docker setups, see n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

You need merchant API credentials from bKash. For the sandbox, request them on the [bKash developer portal](https://developer.bka.sh/). For production, bKash sends them after you sign a merchant agreement.

In n8n, create a **bKash API** credential:

| Field | Description |
| --- | --- |
| Environment | **Sandbox** (`https://tokenized.sandbox.bka.sh/v1.2.0-beta`) or **Production** (`https://tokenized.pay.bka.sh/v1.2.0-beta`) |
| Username | Merchant API username |
| Password | Merchant API password |
| App Key | `app_key` for your merchant app |
| App Secret | `app_secret` for your merchant app |

### How the token is handled

bKash `id_token` values live for **3600 seconds**. bKash also blocks a merchant app for an hour if grant or refresh is called **more than twice in one hour**. This node calls the grant endpoint as rarely as possible:

- The token is kept in a hidden, `expirable` credential field that n8n stores encrypted along with the credential.
- The token is granted (`POST /tokenized/checkout/token/grant`) only when no token is stored yet, or when bKash rejects the stored one with HTTP 401. That works out to about one grant per hour of activity.
- Every request sends `Authorization: <id_token>` and `X-APP-Key: <app_key>`.

Things to know:

- **Test connection** can use up one grant call when no token is stored yet. Don't click it over and over.
- If many executions run in parallel just as the token expires, each of them may request a new token. For high-volume production use, run your bKash calls in a sub-workflow with low concurrency.

## Operations

| Resource | Operation | bKash endpoint | What it does |
| --- | --- | --- | --- |
| Payment | Create | `POST /tokenized/checkout/create` | Creates a payment (mode `0011` checkout, or `0001` with an agreement) and returns `paymentID` and the `bkashURL` to send the customer to. |
| Payment | Execute | `POST /tokenized/checkout/execute` | Completes the payment after the customer approves it. Returns `trxID` and `transactionStatus`. **Use Query only if Execute fails or times out.** |
| Payment | Query | `POST /tokenized/checkout/payment/status` | Gets the current status of a payment. |
| Agreement | Create | `POST /tokenized/checkout/create` (mode `0000`) | Starts linking a customer wallet and returns a `bkashURL`. |
| Agreement | Execute | `POST /tokenized/checkout/execute` | Finishes linking the wallet and returns the `agreementID`. |
| Agreement | Query | `POST /tokenized/checkout/agreement/status` | Gets the status of an agreement. |
| Agreement | Cancel | `POST /tokenized/checkout/agreement/cancel` | Cancels an agreement. |
| Transaction | Search | `POST /tokenized/checkout/general/searchTransaction` | Looks up a transaction by `trxID`. |
| Transaction | Refund | `POST /tokenized/checkout/payment/refund` | Refunds all or part of a payment (`paymentID`, `trxID`, `amount`, `reason`, `sku`). |

Behaviour that applies to every operation:

- Each request times out after **30 seconds**.
- bKash returns most business errors with HTTP 200. If the body has a `statusCode` other than `"0000"` (or an `errorCode`), the node throws an error that includes bKash's `statusMessage`.
- **Continue On Fail** is supported. A failed item comes out with `error`, `statusCode` and `statusMessage`, and the remaining items are still processed.
- Every input item is processed, and each output is paired with its input item.
- The node can be used as an AI Agent tool (`usableAsTool`).

## The callback payment flow

bKash checkout is a redirect flow, so it needs two workflows, or two branches with separate triggers:

```
1. Your app / trigger ──► bKash: Payment → Create
                           callbackURL = <your n8n Webhook URL>
                           ◄── returns bkashURL
2. Send the customer to bkashURL. They enter their wallet number, OTP and PIN.
3. bKash redirects the customer to:
       <callbackURL>?paymentID=TR0011...&status=success|failure|cancel
4. Webhook node (GET) receives paymentID and status
       └─ IF status == "success" ──► bKash: Payment → Execute (paymentID)
                                        └─ check transactionStatus == "Completed"
       └─ otherwise ──► show the customer a failed/cancelled message
```

Tips:

- Use the **Production URL** of a Webhook node (method `GET`) as `callbackURL`. The test URL only works while the editor is listening.
- In Execute, set **Payment ID** to `{{ $json.query.paymentID }}`.
- Run Execute **only** when `status` is `success`. Never trust the redirect alone: confirm that `transactionStatus` is `Completed` in the Execute response.
- If Execute fails or times out, call **Payment → Query** to see whether the payment already went through **before** retrying. A paymentID can be executed only once.
- Store `paymentID`, `trxID` and your `merchantInvoiceNumber`. Refunds and searches need them.

A ready-to-import example is in [`examples/payment-flow.json`](examples/payment-flow.json). In n8n, select **⋯ → Import from File**, pick a bKash credential on both bKash nodes, and replace `YOUR-N8N-HOST` in the Create node's callback URL.

## Sandbox testing

- Set the credential environment to **Sandbox** and use the sandbox credentials from developer.bka.sh.
- bKash publishes sandbox test wallets, along with their OTP and PIN, on the developer portal. They have changed over time, so take the current values from the portal or from your onboarding email. This README doesn't repeat them.
- Sandbox payments move no real money, but the grant limit of two calls per hour applies there too.
- To test errors, try an invalid paymentID with Query, or Execute the same payment twice. Both return non-`0000` status codes.

## Development

```bash
npm install
npm run lint      # n8n community node lint rules
npm run build     # compile to dist/
npm test          # offline tests: mocked HTTP, checks request shapes
npm run dev       # starts a local n8n at http://localhost:5678 with this node loaded
```

To test against the live sandbox, run `npm run dev`, open http://localhost:5678, create a **bKash API** credential with your sandbox keys, and build a flow like the example above. For the redirect step, n8n has to be reachable by the customer's browser. On `localhost` that's your own browser, so the redirect works on the same machine.

### Releasing

Releases are published to npm with provenance by GitHub Actions (`.github/workflows/publish.yml`) when a GitHub release is published. n8n requires this for verified community nodes. Don't run `npm publish` from your own machine.

## Compatibility

- Built and tested with n8n node API version 1 and `@n8n/node-cli` 0.57.
- Requires Node.js 20.15 or later.
- Has no runtime dependencies. All HTTP goes through n8n's built-in request helpers.

## Resources

- [bKash developer portal](https://developer.bka.sh/)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Disclaimer

This is an **unofficial**, community-maintained integration. bKash Limited is not affiliated with it and does not endorse it. It is provided "as is", without warranty of any kind (see [LICENSE](LICENSE)). You are responsible for complying with your bKash merchant agreement, for keeping your credentials secret, and for checking every payment before you fulfil an order.

## License

[MIT](LICENSE)
