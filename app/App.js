
import * as React from 'react'
import AccountsList from './AccountsList'
import QuestionsList from './QuestionsList'


class App extends React.Component
{
    render() {
        return (
            <div>
                <AccountsList accounts={this.props.appState.accounts} currentAccount={this.props.appState.currentAccount} />
                <QuestionsList questions={this.props.appState.questions} />
            </div>
        )
    }
}

export default App