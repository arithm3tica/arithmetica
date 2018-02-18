const Worker = require('./worker');

module.exports = function handleLoadProblemClicked(arithmeticaContract) {
    var instance;
    var code;

    arithmeticaContract.deployed().then(
        (_instance) => {instance = _instance; return _instance.getEvaluation("Collatz Conjecture");}
    ).then(
        (_code) => {code += _code; return instance.getAssertions("Collatz Conjecture");}
    ).then(
        (_code) => {code += _code; return buildCode(code);}
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

