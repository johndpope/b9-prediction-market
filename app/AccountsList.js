
import * as React from 'react'


class AccountsList extends React.Component
{
    render() {
        return (
            <div>
                <h3>Accounts</h3>

                <div>Current account: {this.props.currentAccount}</div>

                <ul>
                    {this.props.accounts.map(account => <li key={account}>{account}</li>)}
                </ul>
            </div>
        )
    }
}

export default AccountsList