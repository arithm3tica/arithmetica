var Arithmetica = artifacts.require("./Arithmetica.sol");

module.exports = function(deployer) {
  deployer.deploy(Arithmetica);
}
