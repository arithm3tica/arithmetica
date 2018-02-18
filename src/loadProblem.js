const Worker = require('./worker');

module.exports = function handleLoadProblemClicked(arithmeticaContract) {
    arithmeticaContract.deployed().then(
        (instance) => {return instance.getEvaluation("Collatz Conjecture");}
    ).then(
        (code) => {return buildCode(code);}
    ).then(
        (arbitraryCode) => {return eval(arbitraryCode)}
    ).then(
        (Problem) => {return new Problem();}
    ).then(
        (worker) => {worker.start();}
    );
}

function buildCode(_code) {
    return "class Problem extends Worker { constructor(){ super(\'OP2\'); }" + _code + "} module.exports = Problem;"
}

