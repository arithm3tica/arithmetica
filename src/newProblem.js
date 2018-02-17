module.exports = function handleCreateProblemClicked(arithmeticaContract) {
    arithmeticaContract.deployed().then(
        (instance) => {
            var _name = document.getElementById("problemNameField").innerHTML;
            var _evaluation = document.getElementById("evaluationField").innerHTML;
            var _assertions = document.getElementById("assertionsField").innerHTML;
            instance.createProblem(_name, _evaluation, _assertions, "");
        }
    );
}

