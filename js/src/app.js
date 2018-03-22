'use strict'
var web3Provider;
var Web3 = require('web3');
var contract = require('truffle-contract');
var web3Type = "";

if (typeof web3 !== 'undefined') {
  // This user has MetaMask, or another Web3 browser installed!
    web3Type = "MetaMask/Mist";
    web3Provider = web3.currentProvider;
    window.web3 = web3;
}
else
{
    web3Type = "localhost";
    var web3 = new Web3();
    web3.setProvider(new Web3.providers.HttpProvider('http://localhost:9545'));
    //If the user doesn't have a node running locally, then use infura
    if(!web3.isConnected()){
        web3.setProvider(new Web3.providers.HttpProvider("https://ropsten.infura.io/pjGrGJqwcpjegBodfps5"));
        web3Type = "Infura";
    }
    web3Provider = web3.currentProvider;
    window.web3 = web3
}

//participant-table-body

const Worker = require('./worker');
var handleCreateProblemClicked = require('./newProblem');
var handleLoadProblemClicked = require('./loadProblem');

var arithmeticaArtifact = require('../../sol/build/contracts/Arithmetica.json');
var arithmeticaContract = contract(arithmeticaArtifact);
arithmeticaContract.setProvider(web3Provider);

var evaluationEditor;
var assertionEditor;
var setupEditor = require('./setupEditor');

var contributeDDItems = [];
var currentProblem = "";

document.addEventListener("DOMContentLoaded", function() {
    if($("#submit-problem-ui").is(":visible")) {
        $("#add-problem-button").hide();
        $("#contribute-problem-ui").hide();
    }
    evaluationEditor = setupEditor("evaluation-input");
    assertionEditor = setupEditor("assertion-input");
    document.getElementById("submit-problem").addEventListener("click", () => {
        handleCreateProblemClicked(arithmeticaContract, evaluationEditor, assertionEditor)}
    );
    document.getElementById("add-problem-button").addEventListener("click", () => {
        switchToAdd();}
    );
    getProblems().then((problemsList) => {
        $("#problem-dropdown-menu").html(buildProblemDropdown(problemsList));
        contributeDDItems = buildDDItemList();
        for(let item of contributeDDItems) {
           item.addEventListener("click", () => {
              currentProblem = item.innerText;
              handleLoadProblemClicked(arithmeticaContract,currentProblem,workerEvent)
              switchToContribute(); 
            });
        }

        var problemLink = decodeURIComponent(location.hash.slice(1))
        if(problemLink.indexOf(currentProblem) >= 0){
            for(let item of contributeDDItems){
                if(item.innerText === problemLink){
                    item.click();
                }
            }
        }
    });



}, false);

function switchToContribute() {
    $("#submit-problem-ui").hide();
    $("#add-problem-button").show();
    $("#contribute-problem-ui").show();
    document.getElementById("problem-name").value = currentProblem;
    $("#problem-name").prop('disabled', true);
}

function switchToAdd() {
    $("#submit-problem-ui").show();
    $("#add-problem-button").hide();
    $("#contribute-problem-ui").hide();
    currentProblem = "";
    document.getElementById("problem-name").value = currentProblem;
    $("#problem-name").prop('disabled', false);
}

function buildDDItemList() {
    let tempList = [];
    for(let entry of contributeDDItems) {        
        tempList.push(document.getElementById(entry));
    }
    return tempList;
}

function buildProblemDropdown(problemsList) {
    let innerHTML = "";
    let counter = 1;
    for(let problem of problemsList) {
        innerHTML = innerHTML + "<a id=\"contribute-dd-item" + counter + "\" class=\"dropdown-item\" href=\"#" + problem + "\">" + problem + "</a>";
        contributeDDItems.push("contribute-dd-item" + counter);
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











