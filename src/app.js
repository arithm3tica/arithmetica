'use strict'

var Web3 = require('web3');
var contract = require('truffle-contract');
var web3Provider = new Web3.providers.HttpProvider('http://localhost:9545');
var web3 = new Web3(web3Provider);

const Worker = require('./worker');
var handleCreateProblemClicked = require('./newProblem');
var handleLoadProblemClicked = require('./loadProblem');

var arithmeticaArtifact = require('../build/contracts/Arithmetica.json');
var arithmeticaContract = contract(arithmeticaArtifact);
arithmeticaContract.setProvider(web3Provider);

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("createProblemButton").addEventListener("click", handleCreateProblemClicked(arithmeticaContract));
    document.getElementById("loadProblemButton").addEventListener("click", handleLoadProblemClicked(arithmeticaContract));
}, false);

