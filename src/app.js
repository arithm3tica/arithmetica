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

var evaluationEditor;
var assertionEditor;
var setupEditor = require('./setupEditor');

document.addEventListener("DOMContentLoaded", function() {
    evaluationEditor = setupEditor("evaluation-input");
    assertionEditor = setupEditor("assertion-input");
    document.getElementById("submit-problem").addEventListener("click", () => {
        handleCreateProblemClicked(arithmeticaContract, evaluationEditor, assertionEditor)}
    );
    document.getElementById("load-problem").addEventListener("click", () => {
        handleLoadProblemClicked(arithmeticaContract, evaluationEditor, assertionEditor)}
    );
    //document.getElementById("evaluation-input").addEventListener("click", handleLoadProblemClicked(arithmeticaContract));
    getProblems().then((v) => console.log(v));
}, false);

function getProblems() {
    var instance;
    return Promise.resolve(
        arithmeticaContract.deployed().then(
            (_instance) => {instance = _instance; return _instance.getProblemCount();}
        ).then(
            (count) => {
                var problems = [];
                for(var i = 0; i < count; ++i) {
                    instance.getProblemName(i).then((result)=>{problems.push(result);});
                }
                return problems;
            }
        )
    );
}

