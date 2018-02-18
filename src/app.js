'use strict'
var web3Provider;
var Web3 = require('web3');
var contract = require('truffle-contract');
if (typeof web3 !== 'undefined') {
  // This user has MetaMask, or another Web3 browser installed!
    console.log("MetaMask");
    web3Provider = web3.currentProvider;
    window.web3 = web3;
}
else
{
    web3Provider = new Web3.providers.HttpProvider('http://localhost:9545');
    window.web3 = Web3
}

const Worker = require('./worker');
var handleCreateProblemClicked = require('./newProblem');
var handleLoadProblemClicked = require('./loadProblem');

var arithmeticaArtifact = require('../build/contracts/Arithmetica.json');
var arithmeticaContract = contract(arithmeticaArtifact);
arithmeticaContract.setProvider(web3Provider);

var evaluationEditor;
var assertionEditor;
var setupEditor = require('./setupEditor');

document.addEventListener("DOMContentLoaded", function() {
    if($("#submit-problem-ui").is(":visible")) {
        $("#add-problem-button").hide()
    }
    evaluationEditor = setupEditor("evaluation-input");
    assertionEditor = setupEditor("assertion-input");
    document.getElementById("submit-problem").addEventListener("click", () => {
        handleCreateProblemClicked(arithmeticaContract, evaluationEditor, assertionEditor)}
    );
    //TODO: Renable this once dashboard is created.
    document.getElementById("load-problem").addEventListener("click", () => {
        handleLoadProblemClicked(arithmeticaContract,workerEvent)}
    );
    getProblems().then((problemsList) => {
        $("#problem-dropdown-menu").html(buildProblemDropdown(problemsList));}
    );

}, false);

function buildProblemDropdown(problemsList) {
    let innerHTML = "";
    for(let problem of problemsList) {
        innerHTML = innerHTML + "<a class=\"dropdown-item\" href=\"#\">" + problem + "</a>";
    }
    return innerHTML;
}

function getProblems() {
    var instance;
    var problems = []
    var promises = [];
    return arithmeticaContract.deployed().then(
        (_instance) => {instance = _instance; return _instance.getProblemCount();}
    ).then(
        (count) => {
            for(var i = 0; i < count; ++i) {
                promises.push(instance.getProblemName(i).then((result)=>{problems.push(result);}));
            }
        }
    ).then(
        () => {return Promise.all(promises).then(() => {return problems;});}
    );
}

function workerEvent(data){
    console.log(data);
}

