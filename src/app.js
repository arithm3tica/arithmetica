'use strict'

var Problem;
const Worker = require('./worker');

var url = new URL(location);
var problem_param = url.searchParams.get("problem");

if(problem_param){
  //pull down custom code that defines the problem to be solved
  var code = 'class Problem extends Worker { constructor(){ super(\'OP2\'); } evaluation(input){if(input % 2 == 0){ input /= 2; }else{input = 3 * input + 1;}return input;} } module.exports = Problem;';
  Problem = eval(code);
}
else{
  Problem = Worker;
}

let  worker = new Problem();
worker.start();

