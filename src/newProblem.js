module.exports = function handleCreateProblemClicked(arithmeticaContract) {
    arithmeticaContract.deployed().then(
        (instance) => {
            var _name = document.getElementById("problemNameField");
            var _evaluation = document.getElementById("evaluationField");
            var _assertions = document.getElementById("assertionsField");
            instance.createProblem(_name, _evaluation, _assertions, "");
        }
    );
}

