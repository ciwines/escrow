const Escrow = artifacts.require("Escrow");
const Token = artifacts.require("Token");

const isTestnet = true;

module.exports = function (deployer, network, accounts) {

    const seller = accounts[0];
    const buyer = accounts[1];
    let tokenAddress;

	deployer.then(async () => {
		// If we are on a testnet env, we have to deploy the
		// test token first
		if (isTestnet) {
			await deployer.deploy(Token);
            token = await Token.deployed();
            tokenAddress = token.address;
		}
        else {
            tokenAddress = "0x428aC1de3FC08c0F3A47745C964f7d677716981F";
        }

        await deployer.deploy(Escrow, seller, buyer, tokenAddress);
	});
};