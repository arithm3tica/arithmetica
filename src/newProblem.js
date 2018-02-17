module.exports = function handleCreateProblemClicked(arithmeticaContract, evaluationEditor, assertionEditor) {
    arithmeticaContract.deployed().then(
        (instance) => {
            var _name = document.getElementById("problem-name").value;
            var _evaluation = evaluationEditor.getValue();
            var _assertions = assertionEditor.getValue();
            instance.createProblem(_name, _evaluation, _assertions, "", {from: "0xf17f52151ebef6c7334fad080c5704d77216b732", gas:1000000});
        }
    );
}

