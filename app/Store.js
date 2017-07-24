import EventEmitter from 'events'
import * as data from './data'
import * as _ from 'lodash'

class Store extends EventEmitter
{
    constructor(web3, contracts) {
        super()

        // bind functions
        this.emitState = this.emitState.bind(this)
        this.getQuestions = this.getQuestions.bind(this)

        // store constructor args
        this.web3 = web3
        this.contracts = contracts

        // define initial state
        this.state = {
            currentAccount: null,
            accounts: [],
            questions: [],
        }

        // emit initial state
        this.emitState()
    }

    emitState() {
        this.emit('new state', this.state)
    }

    async setCurrentAccount(account) {
        this.state.currentAccount = account
        this.emitState()
    }

    async addQuestion(question, betDeadlineBlock, voteDeadlineBlock) {
        const predictionMkt = await this.contracts.PredictionMarket.deployed()
        await predictionMkt.addQuestion(question, betDeadlineBlock, voteDeadlineBlock, { from: this.state.currentAccount, gas: 200000 })
    }

    async getQuestions() {
        const predictionMkt = await this.contracts.PredictionMarket.deployed()

        const questionIDs = await predictionMkt.getAllQuestionIDs({ from: this.state.currentAccount })

        const questionPromises = questionIDs.map(id => predictionMkt.questionsByID(id, { from: this.state.currentAccount }))
        const questionsWithoutIDs = (await Promise.all(questionPromises)).map(data.questionTupleToObject)
        const questions = _.zip(questionIDs, questionsWithoutIDs).map(pair => {
            const [ id, question ] = pair
            return { id, ...question }
        })


        this.state.questions = questions

        this.emitState()
    }

    async getAccounts() {
        const accounts = await this.web3.eth.getAccountsPromise()
        this.state.accounts = accounts
        this.emitState()
    }
}

export default Store