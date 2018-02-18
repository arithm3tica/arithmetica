module.exports = function handleCreateProblemClicked(arithmeticaContract, evaluationEditor, assertionEditor) {
    arithmeticaContract.deployed().then(
        (instance) => {
            var _name = document.getElementById("problem-name").value;
            var _evaluation = evaluationEditor.getValue();
            var _assertions = assertionEditor.getValue();
            instance.createProblem(_name, _evaluation, _assertions, "", {from: web3.eth.accounts[0]});
        }
    );
}

