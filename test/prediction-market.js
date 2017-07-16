let Promise = require('bluebird')
let PredictionMarket = artifacts.require('./PredictionMarket.sol')
let helpers = require('./helpers')
let expectThrow = helpers.expectThrow
let { wait, waitUntilBlock } = require('@digix/tempo')(web3)

if (typeof web3.eth.getAccountsPromise !== 'function') {
    Promise.promisifyAll(web3.eth, { suffix: 'Promise' })
}


const question = 'Is Chewbacca a wookie?'
const questionID = web3.sha3(question)

contract('PredictionMarket', accounts => {
    let predictionMkt
    beforeEach(async () => {
        predictionMkt = await PredictionMarket.new([ accounts[0] ], { from: accounts[0] })
    })

    //
    // .isAdmin()
    //

    describe('.isAdmin()', async () => {
        it('should know that accounts[0] is an admin', async () => {
            let isAdmin = await predictionMkt.isAdmin(accounts[0])
            assert.isTrue(isAdmin, `Expected accounts[0] to be an admin`)
        })

        it('should know that accounts[1] is not an admin', async () => {
            let isAdmin = await predictionMkt.isAdmin(accounts[1])
            assert.isFalse(isAdmin, `Expected accounts[1] to NOT be an admin`)
        })
    })

    //
    // .addQuestion()
    //

    describe('.addQuestion()', async () => {
        it('should prevent a non-admin from adding a question', async () => {
            let blockNumber = await web3.eth.getBlockNumberPromise()
            let betDeadlineBlock = blockNumber + 5
            let voteDeadlineBlock = betDeadlineBlock + 5
            await expectThrow( predictionMkt.addQuestion('Is Chewbacca a wookie?', betDeadlineBlock, voteDeadlineBlock, { from: accounts[1] }) )
        })

        it('should not allow the same question twice', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await expectThrow( predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] }) )
        })

        it('should not allow a question with a betDeadlineBlock in the past', async () => {
            let betDeadlineBlock = await web3.eth.getBlockNumberPromise()
            let voteDeadlineBlock = betDeadlineBlock + 5

            await expectThrow( predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] }) )
        })

        it('should not allow a question with a voteDeadlineBlock less than or equal to betDeadlineBlock', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock

            await expectThrow( predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] }) )

            voteDeadlineBlock = betDeadlineBlock - 1
            await expectThrow( predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] }) )
        })

        describe('when an admin adds a new question with valid bet and vote deadlines', async () => {
            it('should not throw', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            })

            it('should emit one LogAddQuestion event', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                let addTx = await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
                assert.lengthOf(addTx.logs, 1, `addTx.logs`)

                let log = addTx.logs[0]
                assert.equal(log.event, 'LogAddQuestion', `log.event`)
                assert.equal(log.args.whoAdded, accounts[0], `log.args.whoAdded`)
                assert.equal(log.args.questionID, questionID, `log.args.questionID`)
                assert.equal(log.args.betDeadlineBlock, betDeadlineBlock, `log.args.betDeadlineBlock`)
                assert.equal(log.args.voteDeadlineBlock, voteDeadlineBlock, `log.args.voteDeadlineBlock`)
            })

            it('should add the question to the .questionsByID mapping', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })

                let [ _exists, _question, _betDeadlineBlock, _voteDeadlineBlock, _yesVotes, _noVotes, _yesFunds, _noFunds ] = await predictionMkt.questionsByID(questionID)
                assert.equal(_exists, true, `questionsByID[...].exists`)
                assert.equal(_question, question, `questionsByID[...].question`)
                assert.equal(_betDeadlineBlock, betDeadlineBlock, `questionsByID[...].betDeadlineBlock`)
                assert.equal(_voteDeadlineBlock, voteDeadlineBlock, `questionsByID[...].voteDeadlineBlock`)
                assert.equal(_yesVotes, 0, `questionsByID[...].yesVotes`)
                assert.equal(_noVotes, 0, `questionsByID[...].noVotes`)
                assert.equal(_yesFunds, 0, `questionsByID[...].yesFunds`)
                assert.equal(_noFunds, 0, `questionsByID[...].noFunds`)
            })

            it('should add the question ID to the .questionIDs array', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })

                let numQuestions = await predictionMkt.numQuestions()
                assert.equal(numQuestions, 1, '.numQuestions()')

                let _questionID = await predictionMkt.questionIDs(0)
                assert.equal(_questionID, questionID, '.questionIDs(0)')
            })
        })
    })

    //
    // .addTrustedSource()
    //

    describe('.addTrustedSource()', async () => {
        let admin = accounts[0]
        let trustedSource = accounts[1]

        it('should not allow the same trusted source to be added twice', async () => {
            await predictionMkt.addTrustedSource(trustedSource, { from: admin })
            await expectThrow( predictionMkt.addTrustedSource(trustedSource, { from: admin }) )
        })

        it('should not allow a non-admin to add a trusted source', async () => {
            let notAdmin = accounts[1]
            let trustedSource = accounts[2]

            await expectThrow( predictionMkt.addTrustedSource(trustedSource, { from: notAdmin }) )
        })

        describe('when an admin adds a new trusted source', async () => {
            it('should not throw', async () => {
                await predictionMkt.addTrustedSource(trustedSource, { from: admin })
            })

            it('should emit one LogAddTrustedSource event', async () => {
                let addTx = await predictionMkt.addTrustedSource(trustedSource, { from: admin })

                assert.lengthOf(addTx.logs, 1, `addTx.logs`)

                let log = addTx.logs[0]
                assert.equal(log.event, 'LogAddTrustedSource', `log.event`)
                assert.equal(log.args.whoAdded, admin, `log.args.whoAdded`)
                assert.equal(log.args.trustedSource, trustedSource, `log.args.trustedSource`)
            })

            it('should reflect the trusted source in the .isTrustedSource mapping', async () => {
                await predictionMkt.addTrustedSource(trustedSource, { from: admin })

                let isTrustedSource = await predictionMkt.isTrustedSource(trustedSource)
                assert.isTrue(isTrustedSource, `.isTrustedSource(${trustedSource})`)
            })
        })
    })

    //
    // .bet()
    //

    describe('.bet()', async () => {
        it('should not allow betting on a nonexistent question', async () => {
            await expectThrow( predictionMkt.bet(questionID, true, { from: accounts[1] }) )
        })

        it('should not allow betting with no money', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await expectThrow( predictionMkt.bet(questionID, true, { from: accounts[1] }) )
        })

        it('should not allow betting after the deadline', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await waitUntilBlock(0, betDeadlineBlock + 1)
            await expectThrow( predictionMkt.bet(questionID, true, { from: accounts[1], value: 1 }) )
        })

        describe('when a user sends a valid bet (for a question that exists, before the betDeadline, with funds)', async () => {
            let bettor = accounts[1]
            let betAmount = 1
            let betVote = true
            let expectedVote = (betVote === true) ? 1 : 2

            beforeEach(async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            })

            it('should emit one LogBet event', async () => {
                let betVote = true

                let betTx = await predictionMkt.bet(questionID, betVote, { from: accounts[1], value: 1 })
                assert.lengthOf(betTx.logs, 1, `betTx.logs`)

                let log = betTx.logs[0]
                assert.equal(log.event, 'LogBet', `log.event`)
                assert.equal(log.args.bettor, bettor, `log.args.bettor`)
                assert.equal(log.args.questionID, questionID, `log.args.questionID`)
                assert.equal(log.args.vote, expectedVote, `log.args.vote`)
                assert.equal(log.args.betAmount, betAmount, `log.args.betAmount`)
            })

            it('should reflect the bet data in the .bets mapping of the question (via .getBet())', async () => {
                let betVote = true

                let betTx = await predictionMkt.bet(questionID, betVote, { from: accounts[1], value: 1 })
                let [ _betVote, _betAmount, _withdrawn ] = await predictionMkt.getBet(questionID, bettor)
                assert.equal(_betVote, expectedVote, 'betVote')
                assert.equal(_betAmount, betAmount, 'betAmount')
                assert.isFalse(_withdrawn, 'withdrawn')
            })

            it('should reflect an increase in question.yesFunds if bet.vote == Vote.Yes', async () => {
                let betVote = true

                let questionData = await predictionMkt.questionsByID(questionID)
                let yesFunds = questionData[6]
                assert.equal(yesFunds, 0, 'question.yesFunds')

                await predictionMkt.bet(questionID, betVote, { from: bettor, value: betAmount })

                questionData = await predictionMkt.questionsByID(questionID)
                yesFunds = questionData[6]
                assert.equal(yesFunds, betAmount, 'question.yesFunds')
            })

            it('should reflect an increase in question.noFunds if bet.vote == Vote.No', async () => {
                let betVote = false

                let questionData = await predictionMkt.questionsByID(questionID)
                let noFunds = questionData[7]
                assert.equal(noFunds, 0, 'question.noFunds')

                await predictionMkt.bet(questionID, betVote, { from: bettor, value: betAmount })

                questionData = await predictionMkt.questionsByID(questionID)
                noFunds = questionData[7]
                assert.equal(noFunds, betAmount, 'question.noFunds')
            })
        })
    })

    //
    // .vote()
    //

    describe('.vote()', async () => {
        let admin = accounts[0]
        let voter = accounts[1]

        it('should not allow voting on a nonexistent question', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5

            await predictionMkt.addTrustedSource(voter, { from: admin })
            await waitUntilBlock(0, betDeadlineBlock + 1)
            await expectThrow( predictionMkt.vote(questionID, true, { from: voter }) )
        })

        it('should not allow voting by a user that is not a trusted source', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
            await waitUntilBlock(0, betDeadlineBlock + 1)
            await expectThrow( predictionMkt.vote(questionID, true, { from: voter }) )
        })

        it('should not allow voting before betDeadlineBlock', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
            await predictionMkt.addTrustedSource(voter, { from: admin })
            await expectThrow( predictionMkt.vote(questionID, true, { from: voter }) )
        })

        it('should not allow voting after voteDeadlineBlock', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
            await predictionMkt.addTrustedSource(voter, { from: admin })
            await waitUntilBlock(0, voteDeadlineBlock + 1)
            await expectThrow( predictionMkt.vote(questionID, true, { from: voter }) )
        })

        it('should not allow voting by the same user twice', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
            await predictionMkt.addTrustedSource(voter, { from: admin })
            await waitUntilBlock(0, betDeadlineBlock + 1)
            await predictionMkt.vote(questionID, true, { from: voter })
            await expectThrow( predictionMkt.vote(questionID, true, { from: voter }) )
        })

        describe('if a trusted source votes on a question after betDeadlineBlock and before voteDeadlineBlock', async () => {
            it('should not throw', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
                await predictionMkt.addTrustedSource(voter, { from: admin })
                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, true, { from: voter })
            })

            it('should emit one LogVote event', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5
                let vote = true
                let expectedVote = vote == true ? 1 : 2

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
                await predictionMkt.addTrustedSource(voter, { from: admin })
                await waitUntilBlock(0, betDeadlineBlock + 1)
                let voteTx = await predictionMkt.vote(questionID, true, { from: voter })

                assert.lengthOf(voteTx.logs, 1, `voteTx.logs`)

                let log = voteTx.logs[0]
                assert.equal(log.event, 'LogVote', `log.event`)
                assert.equal(log.args.trustedSource, voter, `log.args.trustedSource`)
                assert.equal(log.args.questionID, questionID, `log.args.questionID`)
                assert.equal(log.args.vote, expectedVote, `log.args.vote`)
            })

            it('should increment question.yesVotes if the vote is a yes', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5
                let vote = true

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
                await predictionMkt.addTrustedSource(voter, { from: admin })
                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, vote, { from: voter })

                let [ _exists, _question, _betDeadlineBlock, _voteDeadlineBlock, _yesVotes, _noVotes, _yesFunds, _noFunds ] = await predictionMkt.questionsByID(questionID)
                assert.equal(_yesVotes, 1, 'question.yesVotes')
            })

            it('should increment question.noVotes if the vote is a no', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5
                let vote = false

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
                await predictionMkt.addTrustedSource(voter, { from: admin })
                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, vote, { from: voter })

                let [ _exists, _question, _betDeadlineBlock, _voteDeadlineBlock, _yesVotes, _noVotes, _yesFunds, _noFunds ] = await predictionMkt.questionsByID(questionID)
                assert.equal(_noVotes, 1, 'question.noVotes')
            })

            it('should reflect a yes vote in questions.votes[...]', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5
                let vote = true

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
                await predictionMkt.addTrustedSource(voter, { from: admin })
                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, vote, { from: voter })

                let _vote = await predictionMkt.getVote(questionID, voter)
                assert.equal(_vote, 1, 'question.votes[...]')
            })

            it('should reflect a no vote in questions.votes[...]', async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5
                let vote = true

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: admin })
                await predictionMkt.addTrustedSource(voter, { from: admin })
                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, vote, { from: voter })

                let _vote = await predictionMkt.getVote(questionID, voter)
                assert.equal(_vote, 1, 'question.votes[...]')
            })
        })

    })

    //
    // .withdraw()
    //

    describe('.withdraw()', async () => {
        it('should not allow withdrawing from a nonexistent question', async () => {
            await expectThrow( predictionMkt.withdraw(questionID, { from: accounts[0] }) )
        })

        it('should not allow withdrawing before voteDeadlineBlock', async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await expectThrow( predictionMkt.withdraw(questionID, { from: accounts[0] }) )
        })

        it(`should not allow withdrawing by users who haven't bet`, async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await waitUntilBlock(0, voteDeadlineBlock + 1)
            await expectThrow( predictionMkt.withdraw(questionID, { from: accounts[0] }) )
        })

        it(`should not allow withdrawing by users who have already withdrawn`, async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await predictionMkt.bet(questionID, true, { from: accounts[0], value: 1 })
            await waitUntilBlock(0, voteDeadlineBlock + 1)
            await predictionMkt.withdraw(questionID, { from: accounts[0] })
            await expectThrow( predictionMkt.withdraw(questionID, { from: accounts[0] }) )
        })

        it(`should not allow withdrawing by users who bet "yes" when the "no" votes won`, async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5
            let vote = true
            let voter = accounts[1]

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await predictionMkt.addTrustedSource(voter, { from: accounts[0] })

            await predictionMkt.bet(questionID, vote, { from: accounts[0], value: 1 })

            await waitUntilBlock(0, betDeadlineBlock + 1)
            await predictionMkt.vote(questionID, !vote, { from: voter })

            await waitUntilBlock(0, voteDeadlineBlock + 1)
            await expectThrow( predictionMkt.withdraw(questionID, { from: accounts[0] }) )
        })

        it(`should not allow withdrawing by users who bet "no" when the "yes" votes won`, async () => {
            let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
            let voteDeadlineBlock = betDeadlineBlock + 5
            let vote = false
            let voter = accounts[1]

            await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
            await predictionMkt.addTrustedSource(voter, { from: accounts[0] })

            await predictionMkt.bet(questionID, vote, { from: accounts[0], value: 1 })

            await waitUntilBlock(0, betDeadlineBlock + 1)
            await predictionMkt.vote(questionID, !vote, { from: voter })

            await waitUntilBlock(0, voteDeadlineBlock + 1)
            await expectThrow( predictionMkt.withdraw(questionID, { from: accounts[0] }) )
        })

        describe('when a user who made a bet withdraws after voteDeadlineBlock, but nobody voted', async () => {
            let bettorBalanceAfterWithdraw, bettorBalanceAfterBet, totalGasCost, withdrawTx
            let betAmount = 1
            let bettor = accounts[0]
            let voter = accounts[1]
            let vote = true

            beforeEach(async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
                await predictionMkt.addTrustedSource(voter, { from: accounts[0] })

                await predictionMkt.bet(questionID, vote, { from: bettor, value: betAmount })
                bettorBalanceAfterBet = web3.eth.getBalance(bettor)

                await waitUntilBlock(0, voteDeadlineBlock + 1)
                withdrawTx = await predictionMkt.withdraw(questionID, { from: bettor })

                let gasPrice = (await web3.eth.getTransactionPromise(withdrawTx.tx)).gasPrice
                totalGasCost = gasPrice.times(withdrawTx.receipt.gasUsed)

                bettorBalanceAfterWithdraw = await web3.eth.getBalancePromise(bettor)
            })

            it('should refund the bet', async () => {
                assert( bettorBalanceAfterWithdraw.equals(bettorBalanceAfterBet.plus(betAmount).minus(totalGasCost)), `final balance` )
            })

            it('should emit one LogWithdraw event', async () => {
                assert.equal(withdrawTx.logs.length, 1, 'withdrawTx.logs.length')

                let log = withdrawTx.logs[0]
                assert.equal(log.event, 'LogWithdraw', 'log.event')
                assert.equal(log.args.who, accounts[0], 'log.args.who')
                assert.equal(log.args.questionID, questionID, 'log.args.questionID')
                assert.equal(log.args.amount, betAmount, 'log.args.amount')
            })

            it('should reflect the withdrawal in the question.bets mapping (via .getBet())', async () => {
                let [ _vote, _betAmount, _withdrawn ] = await predictionMkt.getBet(questionID, accounts[0])
                assert.isTrue(_withdrawn, 'bet.withdrawn')
            })
        })

        describe('when a user who made a bet withdraws after voteDeadlineBlock, but the votes were tied', async () => {
            let bettorBalanceAfterWithdraw, bettorBalanceAfterBet, totalGasCost, withdrawTx
            let betAmount = 1
            let bet = true
            let bettor = accounts[0]
            let voter1 = accounts[1]
            let voter2 = accounts[2]

            beforeEach(async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 5
                let voteDeadlineBlock = betDeadlineBlock + 5

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
                await predictionMkt.addTrustedSource(voter1, { from: accounts[0] })
                await predictionMkt.addTrustedSource(voter2, { from: accounts[0] })

                await predictionMkt.bet(questionID, bet, { from: bettor, value: betAmount })
                bettorBalanceAfterBet = web3.eth.getBalance(bettor)

                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, bet, { from: voter1 })
                await predictionMkt.vote(questionID, !bet, { from: voter2 })

                await waitUntilBlock(0, voteDeadlineBlock + 1)
                withdrawTx = await predictionMkt.withdraw(questionID, { from: bettor })
                let gasPrice = (await web3.eth.getTransactionPromise(withdrawTx.tx)).gasPrice
                totalGasCost = gasPrice.times(withdrawTx.receipt.gasUsed)

                bettorBalanceAfterWithdraw = await web3.eth.getBalancePromise(bettor)
            })

            it('should refund the bet', async () => {
                assert( bettorBalanceAfterWithdraw.equals(bettorBalanceAfterBet.plus(betAmount).minus(totalGasCost)), `final balance` )
            })

            it('should emit one LogWithdraw event', async () => {
                assert.equal(withdrawTx.logs.length, 1, 'withdrawTx.logs.length')

                let log = withdrawTx.logs[0]
                assert.equal(log.event, 'LogWithdraw', 'log.event')
                assert.equal(log.args.who, accounts[0], 'log.args.who')
                assert.equal(log.args.questionID, questionID, 'log.args.questionID')
                assert.equal(log.args.amount, betAmount, 'log.args.amount')
            })

            it('should reflect the withdrawal in the question.bets mapping (via .getBet())', async () => {
                let [ _vote, _betAmount, _withdrawn ] = await predictionMkt.getBet(questionID, accounts[0])
                assert.isTrue(_withdrawn, 'bet.withdrawn')
            })
        })

        describe('when a user who made a winning bet withdraws after voteDeadlineBlock', async () => {
            let bettor1BalanceAfterBet, bettor1BalanceAfterWithdraw, betAmount, totalGasCost, withdrawTx
            let bettor1 = accounts[0], bettor1Amount = 3
            let bettor2 = accounts[1], bettor2Amount = 3
            let bettor3 = accounts[2], bettor3Amount = 3
            let bettor1ExpectedWithdrawal = Math.floor((bettor1Amount + bettor2Amount + bettor3Amount) * (bettor1Amount / (bettor1Amount + bettor2Amount)))
            let voter1 = accounts[3]
            let voter2 = accounts[4]
            let voter3 = accounts[5]
            let winningVote = true

            beforeEach(async () => {
                let betDeadlineBlock = (await web3.eth.getBlockNumberPromise()) + 10
                let voteDeadlineBlock = betDeadlineBlock + 10

                await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: accounts[0] })
                await predictionMkt.addTrustedSource(voter1, { from: accounts[0] })
                await predictionMkt.addTrustedSource(voter2, { from: accounts[0] })
                await predictionMkt.addTrustedSource(voter3, { from: accounts[0] })

                await predictionMkt.bet(questionID, winningVote, { from: bettor1, value: bettor1Amount })
                await predictionMkt.bet(questionID, winningVote, { from: bettor2, value: bettor2Amount })
                await predictionMkt.bet(questionID, !winningVote, { from: bettor3, value: bettor3Amount })
                bettor1BalanceAfterBet = web3.eth.getBalance(bettor1)

                await waitUntilBlock(0, betDeadlineBlock + 1)
                await predictionMkt.vote(questionID, winningVote, { from: voter1 })
                await predictionMkt.vote(questionID, winningVote, { from: voter2 })
                await predictionMkt.vote(questionID, !winningVote, { from: voter3 })

                await waitUntilBlock(0, voteDeadlineBlock + 1)
                withdrawTx = await predictionMkt.withdraw(questionID, { from: bettor1 })
                let gasPrice = (await web3.eth.getTransactionPromise(withdrawTx.tx)).gasPrice
                totalGasCost = gasPrice.times(withdrawTx.receipt.gasUsed)

                bettor1BalanceAfterWithdraw = await web3.eth.getBalancePromise(bettor1)
            })

            it('should withdraw (totalFunds * percentage of winning stake)', async () => {
                assert( bettor1BalanceAfterWithdraw.equals(bettor1BalanceAfterBet.plus(bettor1ExpectedWithdrawal).minus(totalGasCost)), `final balance` )
            })

            it('should emit one LogWithdraw event', async () => {
                assert.equal(withdrawTx.logs.length, 1, 'withdrawTx.logs.length')

                let log = withdrawTx.logs[0]
                assert.equal(log.event, 'LogWithdraw', 'log.event')
                assert.equal(log.args.who, bettor1, 'log.args.who')
                assert.equal(log.args.questionID, questionID, 'log.args.questionID')
                assert.equal(log.args.amount, bettor1ExpectedWithdrawal, 'log.args.amount')
            })

            it('should reflect the withdrawal in the question.bets mapping (via .getBet())', async () => {
                let [ _vote, _betAmount, _withdrawn ] = await predictionMkt.getBet(questionID, bettor1)

                assert.isTrue(_withdrawn, 'bet.withdrawn')
            })
        })
    })
})


