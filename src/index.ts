import "dotenv/config"
import { createWriteStream, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream } from "node:stream/web"
import {
	Account,
	AccountAddress,
	type AptosApiError,
	Ed25519PrivateKey,
	Network,
} from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import { filesize } from "filesize"

const UPLOAD_FILE = join(process.cwd(), "assets", "whitepaper.pdf")
const TIME_TO_LIVE = 60 * 60 * 1_000_000
const BLOB_NAME = "whitepaper.pdf"

const SHELBY_ACCOUNT_PRIVATE_KEY = process.env.SHELBY_ACCOUNT_PRIVATE_KEY
const SHELBY_ACCOUNT_ADDRESS = process.env.SHELBY_ACCOUNT_ADDRESS as string
const SHELBY_API_KEY = process.env.SHELBY_API_KEY

if (!SHELBY_ACCOUNT_ADDRESS) {
	process.exit(1)
}
if (!SHELBY_ACCOUNT_PRIVATE_KEY) {
	process.exit(1)
}
if (!SHELBY_API_KEY) {
	process.exit(1)
}

const client = new ShelbyNodeClient({
	network: Network.SHELBYNET,
	apiKey: SHELBY_API_KEY,
})

const signer = Account.fromPrivateKey({
	privateKey: new Ed25519PrivateKey(SHELBY_ACCOUNT_PRIVATE_KEY),
})
const account = AccountAddress.fromString(SHELBY_ACCOUNT_ADDRESS)

async function main() {
	try {
		const upload = await client.upload({
			blobData: readFileSync(UPLOAD_FILE),
			signer,
			blobName: BLOB_NAME,
			expirationMicros: Date.now() * 1000 + TIME_TO_LIVE,
		})

		const blobs = await client.coordination.getAccountBlobs({
			account: AccountAddress.fromString(SHELBY_ACCOUNT_ADDRESS),
		})

		const download = await client.download({ account, blobName: BLOB_NAME })
		const outPath = join(process.cwd(), "downloads", BLOB_NAME)

		mkdirSync(dirname(outPath), { recursive: true })
		const webStream = download.readable as ReadableStream<Uint8Array>
		await pipeline(Readable.fromWeb(webStream), createWriteStream(outPath))
	} catch (e: unknown) {
		const err = e as AptosApiError
		if (err.message.includes("EBLOB_WRITE_CHUNKSET_ALREADY_EXISTS")) {
			return
		}
		if (err.message.includes("INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE")) {
			return
		}
		if (err.message.includes("EBLOB_WRITE_INSUFFICIENT_FUNDS")) {
			return
		}
		if (e instanceof Error && e.message.includes("429")) {
			return
		}
		const msg = e instanceof Error ? e.message : String(e)
		if (/500|internal server error/i.test(msg)) {
			process.exit(1)
		}
		process.exit(1)
	}
}

main()
