
import { default as contract } from 'truffle-contract'

import predictionMarketArtifacts from '../build/contracts/PredictionMarket.json'
const PredictionMarket = contract(predictionMarketArtifacts)

function attachWeb3(web3) {
    PredictionMarket.setProvider(web3.currentProvider)
}

export {
    attachWeb3,
    PredictionMarket,
}