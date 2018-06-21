pragma solidity ^0.4.17;
contract Arithmetica {
    address owner;

    function Arithmetica() public {
        owner = msg.sender;
    }

    struct MathTemplate {
        address owner;
        string evaluation;
        string assertions;

        bytes32 checksum;
        string resultsLocation;
        uint index;
    }
    mapping(string => MathTemplate) mathProblems;
    string[] problems;

    //////////////////////////////////////////////////////////////////////////////////
    function createProblem(string name, string evaluation, string assertions, string resultsLocation) public {
        require(!problemExists(name));

        problems.push(name);
        mathProblems[name].owner = msg.sender;
        mathProblems[name].evaluation = evaluation;
        mathProblems[name].assertions = assertions;

        mathProblems[name].checksum = sha256(evaluation, assertions);
        mathProblems[name].resultsLocation = resultsLocation;
        mathProblems[name].index = problems.length-1;
    }

    function updateProblem(string name, string evaluation, string assertions, string resultsLocation) public {
        require(problemExists(name));
        require(msg.sender==mathProblems[name].owner);

        mathProblems[name].evaluation = evaluation;
        mathProblems[name].assertions = assertions;
        mathProblems[name].resultsLocation = resultsLocation;
        mathProblems[name].checksum = sha256(evaluation, assertions);
    }

    function deleteProblem(string name) public {
        require(problemExists(name));
        require(msg.sender==mathProblems[name].owner);
        uint index = mathProblems[name].index;
        delete mathProblems[name];
        removeProblem(index);
    }

    //////////////////////////////////////////////////////////////////////////////////

    function getProblemCount() public constant returns (uint) {
        return problems.length;
    }

    function getProblemName(uint index) public constant returns (string) {
        require(index >= 0);
        require(index < problems.length);
        return problems[index];
    }

    //////////////////////////////////////////////////////////////////////////////////

    function getOwner(string name) public view returns (address) {
        return mathProblems[name].owner;
    }

    function getEvaluation(string name) public view returns (string) {
        require(problemExists(name));
        return mathProblems[name].evaluation;
    }

    function getAssertions(string name) public view returns (string) {
        require(problemExists(name));
        return mathProblems[name].assertions;
    }

    function getChecksum(string name) public view returns (bytes32) {
        require(problemExists(name));
        return mathProblems[name].checksum;
    }

    function getResultsLocation(string name) public view returns (string) {
        require(problemExists(name));
        return mathProblems[name].resultsLocation;
    }

    /////////////////////////////////////////////////////////////////////////////////

    function problemExists(string name) private view returns (bool) {
        return (mathProblems[name].owner!=0x0);
    }

    function removeProblem(uint index) private {
        for (uint i = index; i<problems.length-1; i++){
            problems[i] = problems[i+1];
        }
        delete problems[problems.length-1];
        problems.length--;
    }
}

