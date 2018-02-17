'use strict'

var Web3 = require('web3');
var contract = require('truffle-contract');
var web3Provider = new Web3.providers.HttpProvider('http://localhost:9545');
var web3 = new Web3(web3Provider);

const Worker = require('./worker');
var handleCreateProblemButtonClicked = require('./newProblem');

var arithmeticaArtifact = require('../build/contracts/Arithmetica.json');
var arithmeticaContract = contract(arithmeticaArtifact);
arithmeticaContract.setProvider(web3Provider);
arithmeticaContract.deployed().then(
    //Do Stuff Here?
    (instance) => {return instance;}
).then(
    (arithmetica) => {return arithmetica.getEvaluation("Collatz");}
).then(
    (code) => {return buildCode(code);}
).then(
    (arbitraryCode) => {return eval(arbitraryCode);}
).then(
    (Problem) => {return new Problem();}
).then(
    (worker) => {worker.start();}
);

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("createProblemButton").addEventListener("click", handleCreateProblemButtonClicked(arithmeticaContract));
}, false);

