const Worker = require('./worker');

module.exports = function handleLoadProblemClicked(arithmeticaContract,problemName,callback) {
    var instance;
    var code = "";

    arithmeticaContract.deployed().then(
        (_instance) => {instance = _instance; return _instance.getEvaluation(problemName);}
    ).then(
        (_code) => {code = code + _code; return instance.getAssertions(problemName);}
    ).then(
        (_code) => {code = code + " " + _code; return buildCode(code,problemName);}
    ).then(
        (arbitraryCode) => {return eval(arbitraryCode)}
    ).then(
        (Problem) => {return new Problem();}
    ).then(
        (worker) => {
             worker.on('InitCompleted',(data) => {
                callback('InitCompleted',data);
            });           
            worker.on('PeerJoined',(data) => {
                callback('PeerJoined',data);
            });
            worker.on('PeerLeft',(data) => {
                callback('PeerLeft',data);
            });
            worker.on('CompletedWork',(data) => {
                callback('CompletedWork',data);
            });
            worker.on('LeadPeerSelected',(data) => {
                callback('LeadPeerSelected',data);
            });
            worker.start();


        }
    );
}

function buildCode(_code, problemName) {
    _code = "evaluation(items) {\
    var number = items[0];\
    var iterations = items[1];\
    var flag = items[2];\
    if(number % 2 == 0){\
      number /= 2;\
    }\
    else{\
      number = 3 * number + 1;\
    }\
    if(this._completedWork.hasOwnProperty(number)){\
     iterations += this._completedWork[number];\
     flag = false;\
    }\
    return [number,iterations,flag];\
} assertions(original, number, iterations) {\
  if(iterations > 500) return true;\
}"
    return "class Problem extends Worker { constructor(){ super(\'" + problemName + "\'); }" + _code + "} module.exports = Problem;"
}
