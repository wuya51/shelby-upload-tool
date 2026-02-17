import { confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import truncate from "./truncate"
import type { ShelbyConfig } from "./types"

export default async function accountConfig(config: ShelbyConfig): Promise<
	| {
			account_name: string
			address: string
			private_key: string
	  }
	| undefined
> {
	const accounts = config.accounts || {}
	const accountNames = Object.keys(accounts)
	if (!accountNames || accountNames.length === 0) {
		return undefined
	}
	if (accountNames.length === 1) {
		console.log(
			chalk.green("✔"),
			chalk.bold.whiteBright(
				"Found profile for",
				chalk.cyan(accountNames[0]),
				"in Shelby CLI config",
			),
		)
		const account_name = accountNames[0]
		const address = accounts[account_name].address
		const private_key = accounts[account_name].private_key
		return {
			account_name,
			address,
			private_key,
		}
	}
	const defaultAccount = config.default_account || undefined
	if (defaultAccount && accountNames.includes(defaultAccount)) {
		const address = accounts[defaultAccount].address
		const private_key = accounts[defaultAccount].private_key
		const useDefault = await confirm({
			message: `Would you like to use the default account ${chalk.cyan(defaultAccount)} (${truncate(address)}) from Shelby CLI config?`,
			default: true,
		})
		if (useDefault) {
			return {
				account_name: defaultAccount,
				address,
				private_key,
			}
		}
	}
	const choices = accountNames.map((name) => ({
		name: `${name} (${truncate(accounts[name].address)})`,
		value: name,
		default: name === defaultAccount,
	}))
	const selected = await select({
		message: "Which account do you want to use?",
		choices,
	})
	return {
		account_name: selected,
		address: accounts[selected].address,
		private_key: accounts[selected].private_key,
	}
}
