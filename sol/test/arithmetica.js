const Arithmetica = artifacts.require("Arithmetica") 

contract('Arithmetica', (accounts) => {
    const [bob, alice, ralph] = accounts
    const name = "Collatz Conjecture"
    const evaluation = "/////////.com";
    const assertions = "//////////.net";
    const resultsLocation = "http://reddit.com/r/spacedicks";

    it("instantiates a new problem and validates it is stored in contract storage", async () => {
        const arithmetica = await Arithmetica.new()

        await arithmetica.createProblem(name, evaluation, assertions, resultsLocation);
        const owner = await arithmetica.getOwner.call(name);

        const evaluationValue = await arithmetica.getEvaluation.call(name);
        const assertionsValue = await arithmetica.getAssertions.call(name);
        const checksum = await arithmetica.getChecksum.call(name);
        const resultsLocationValue = await arithmetica.getResultsLocation.call(name);

        assert.equal(bob, owner, "owner does not match the callers address");
        assert.equal(evaluation, evaluationValue, "evaluation does not match the submitted value");
        assert.equal(assertions, assertionsValue, "assertions does not match the submitted value");
        assert.notEqual(0x0, checksum, "checksum value has not been properly assigned");
        assert.equal(resultsLocation, resultsLocationValue, "resultsLocation does not match the submitted value");
    })
    it("instantiates a new problem, updates and validates contract storage", async () => {
        const arithmetica = await Arithmetica.new()

        await arithmetica.createProblem(name, evaluation, assertions, resultsLocation);
        const checksum = await arithmetica.getChecksum.call(name);

        await arithmetica.updateProblem(name, evaluation.split("").reverse("").join(""), assertions.split("").reverse("").join(""), resultsLocation.split("").reverse("").join(""));

        const owner = await arithmetica.getOwner.call(name);
        const evaluationValue = await arithmetica.getEvaluation.call(name);
        const assertionsValue = await arithmetica.getAssertions.call(name);
        const checksumUpdate = await arithmetica.getChecksum.call(name);
        const resultsLocationValue = await arithmetica.getResultsLocation.call(name);

        assert.equal(bob, owner, "owner does not match the callers address");
        assert.equal(evaluation.split("").reverse("").join(""), evaluationValue, "evaluation does not match the submitted value");
        assert.equal(assertions.split("").reverse("").join(""), assertionsValue, "assertions does not match the submitted value");
        assert.notEqual(checksumUpdate, checksum, "checksum value has not been properly changed on update");
        assert.equal(resultsLocation.split("").reverse("").join(""), resultsLocationValue, "resultsLocation does not match the submitted value");
    })
})
