
import * as React from 'react'


class QuestionsList extends React.Component
{
    render() {
        return (
            <div>
                <h3>Questions</h3>

                <table>
                    <thead>
                        <tr>
                            <th>Question</th>
                            <th>Bet deadline block</th>
                            <th>Vote deadline block</th>
                            <th>Yes votes</th>
                            <th>No votes</th>
                            <th>Yes funds</th>
                            <th>No funds</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.props.questions.map(question => {
                            return (
                                <tr>
                                    <td>{question.question}</td>
                                    <td>{question.betDeadlineBlock.toString()}</td>
                                    <td>{question.voteDeadlineBlock.toString()}</td>
                                    <td>{question.yesVotes.toString()}</td>
                                    <td>{question.noVotes.toString()}</td>
                                    <td>{question.yesFunds.toString()}</td>
                                    <td>{question.noFunds.toString()}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )
    }
}

export default QuestionsList