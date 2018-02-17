module.exports = function handleCreateProblemClicked(arithmeticaContract) {
    arithmeticaContract.deployed().then(
        (instance) => {
            var _name = document.getElementById("problem-name").innerHTML;
            var _evaluation = document.getElementById("evaluation-input").innerHTML;
            var _assertions = document.getElementById("assertion-input").innerHTML;
            instance.createProblem(_name, _evaluation, _assertions, "");
        }
    );
}

