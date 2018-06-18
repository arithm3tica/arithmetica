var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "feature recycle sick flee erosion void cigar alien reward divert disorder sentence"
var DefaultBuilder = require("truffle-default-builder");
module.exports = {
  build: new DefaultBuilder({
  }),
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    ropsten: {
      provider: function() {
      	return new HDWalletProvider(mnemonic, "https://ropsten.infura.io/pjGrGJqwcpjegBodfps5")
      },
      network_id: 3,
      gas: 4000000
    }
  }
};
